import { Opper } from "opperai";
import { tools, ToolName } from '@/lib/tools';
import { StreamChunk, Message } from "@/lib/types"


const opper = new Opper({
  httpBearer: process.env.OPPERAI_API_KEY!,
});

function generateToolPrompt() {
  return Object.entries(tools)
    .map(([name, tool]) => {
      return `- ${name}: ${tool.description}
  Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`;
    })
    .join('\n\n');
}

const systemPrompt = `You are a helpful assistant with access to tools.

Available tools:
${generateToolPrompt()}

CRITICAL INSTRUCTIONS:
1. When you need to use a tool, respond with ONLY raw JSON - no markdown, no explanations, no code blocks.
2. Do NOT say what you will do. Just call the tool immediately.
3. Do NOT wrap JSON in \`\`\`json blocks. Output raw JSON directly.
4. After tools are executed, you will see the results and can provide a natural language response.

Tool call format (output EXACTLY this, nothing else):
{
  "toolCalls": [
    {
      "id": "call_<unique_id>",
      "name": "<tool_name>",
      "input": { <tool_arguments> }
    }
  ]
}

Examples:
User: "What is 5 + 10?"
Assistant: {"toolCalls":[{"id":"call_1","name":"sum","input":{"numbers":[5,10]}}]}

User: "Hello!"
Assistant: Hello! How can I help you today?`;

export async function POST(req: Request) {
  try {
    const { messages: inputMessages } = await req.json();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          await streamWithTools({
            messages: inputMessages,
            controller,
            maxSteps: 5,
          });

          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          const errorChunk: StreamChunk = {
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          };
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(errorChunk)}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Request error:', error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

async function streamWithTools({
  messages,
  controller,
  currentStep = 0,
  maxSteps = 5,
}: {
  messages: Message[];
  controller: ReadableStreamDefaultController;
  currentStep?: number;
  maxSteps?: number;
}) {
  if (currentStep >= maxSteps) {
    const finishChunk: StreamChunk = {
      type: 'finish',
      reason: 'max_steps_reached',
      totalSteps: currentStep,
    };
    controller.enqueue(
      new TextEncoder().encode(`data: ${JSON.stringify(finishChunk)}\n\n`)
    );
    return;
  }

  const opperMessages = messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));

  const response = await opper.stream({
    model: "openai/gpt-4o",
    name: 'chat-with-tools',
    instructions: systemPrompt,
    input: opperMessages,
  });

  let fullText = '';
  let toolCalls: Array<{ id: string; name: string; input: unknown }> = [];
  let isCollectingJson = false;

  for await (const event of response.result) {
    if (!event.data.delta) continue;

    const delta = event.data.delta;

    if (typeof delta === 'string') {
      fullText += delta;

      if (!isCollectingJson && fullText.includes('{"toolCalls"')) {
        isCollectingJson = true;
        console.log('Started collecting JSON for tool calls');
      }

      if (!isCollectingJson) {
        const textChunk: StreamChunk = {
          type: 'text-delta',
          text: delta,
        };
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(textChunk)}\n\n`)
        );
      }
    }
  }

  try {
    let cleanedText = fullText.trim();

    const jsonMatch = cleanedText.match(/\{[\s\S]*"toolCalls"[\s\S]*\}/);
    if (jsonMatch) {
      cleanedText = jsonMatch[0];
    }

    const parsed = JSON.parse(cleanedText);

    if (parsed.toolCalls && Array.isArray(parsed.toolCalls)) {
      toolCalls = parsed.toolCalls;
    }
  } catch {


  }

  if (toolCalls.length > 0) {
    const toolResults: Array<{ toolCallId: string; toolName: string; output: unknown }> = [];

    for (const toolCall of toolCalls) {
      const toolCallChunk: StreamChunk = {
        type: 'tool-call',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        input: toolCall.input,
      };
      controller.enqueue(
        new TextEncoder().encode(`data: ${JSON.stringify(toolCallChunk)}\n\n`)
      );

      try {
        const tool = tools[toolCall.name as ToolName];
        if (!tool) {
          throw new Error(`Tool ${toolCall.name} not found`);
        }

        const output = await tool.execute(toolCall.input as never);

        const resultChunk: StreamChunk = {
          type: 'tool-result',
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          output,
        };
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(resultChunk)}\n\n`)
        );

        toolResults.push({
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          output,
        });
      } catch (error) {
        const errorChunk: StreamChunk = {
          type: 'tool-error',
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          error: error instanceof Error ? error.message : 'Tool execution failed',
        };
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(errorChunk)}\n\n`)
        );
      }
    }

    const stepFinishChunk: StreamChunk = {
      type: 'finish-step',
      stepNumber: currentStep,
    };
    controller.enqueue(
      new TextEncoder().encode(`data: ${JSON.stringify(stepFinishChunk)}\n\n`)
    );

    const updatedMessages: Message[] = [
      ...messages,
      {
        role: 'assistant',
        content: fullText,
        toolCalls: toolCalls,
      },
      {
        role: 'tool',
        content: JSON.stringify(toolResults),
        toolResults: toolResults,
      },
    ];

    await streamWithTools({
      messages: updatedMessages,
      controller,
      currentStep: currentStep + 1,
      maxSteps,
    });
  } else {
    const finishChunk: StreamChunk = {
      type: 'finish',
      reason: 'completed',
      totalSteps: currentStep + 1,
    };
    controller.enqueue(
      new TextEncoder().encode(`data: ${JSON.stringify(finishChunk)}\n\n`)
    );
  }
}