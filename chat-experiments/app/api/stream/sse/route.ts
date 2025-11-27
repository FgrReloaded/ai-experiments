import { Opper } from "opperai";
import { writeFile } from "fs/promises";
import path from "path";

const opper = new Opper({
  httpBearer: process.env.OPPERAI_API_KEY!,
});


// const prompts = `User will ask you some question, understand the user intention and answer the question.

// Available functions:
// - sum of numbers (sum) - args: {num1: number, num2: number, num3: number, ...} - can accept any number of arguments
// - difference of numbers (diff) - args: {num1: number, num2: number, num3: number, ...} - can accept any number of arguments
// - product of numbers (prod) - args: {num1: number, num2: number, num3: number, ...} - can accept any number of arguments

// IMPORTANT: Always respond with valid JSON only.

// For normal questions, respond with:
// <json>
//   "type": "text",
//   "message": "your answer here"
// </json>

// For function calls, respond with:
// <json>
//   "type": "function_call",
//   "prompt": "user's original question",
//   "function_call": "function name",
//   "function_args": {"arg1": value1, "arg2": value2}
// </json>

// Ask the user for any dynamic variables or values needed.`

const prompts = `You are a helpful assistant that can answer questions and help with tasks.`;

export async function POST(req: Request) {
  try {
    const { messages, name } = await req.json();
    const response = await opper.stream({
      model: "openai/gpt-4o-mini",
      name,
      instructions: prompts,
      input: messages,
    });
    const stream = new ReadableStream({
      async start(controller) {
        for await (const event of response.result) {
          if (!(event.data.delta)) continue;
          const data = `${JSON.stringify(event.data.delta)}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
        }
        controller.close();
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
    console.log(error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
