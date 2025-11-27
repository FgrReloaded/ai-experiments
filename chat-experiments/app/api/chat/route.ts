import { Opper } from "opperai";

const opper = new Opper({
  httpBearer: process.env.OPPERAI_API_KEY!,
});

const prompts = `User will ask you some question, understand the user intention and answer the question.

Available functions:
- sum of two numbers (sum) - args: {num1: number, num2: number, ...}
- difference of two numbers (diff) - args: {num1: number, num2: number, ...}
- product of two numbers (prod) - args: {num1: number, num2: number, ...}

IMPORTANT: Always respond with valid JSON only.

For normal questions, respond with:
{
  "type": "text",
  "message": "your answer here"
}

For function calls, respond with:
{
  "type": "function_call",
  "prompt": "user's original question",
  "function_call": "function name",
  "function_args": {"arg1": value1, "arg2": value2}
}

Ask the user for any dynamic variables or values needed.
`

export async function POST(req: Request) {
  try {
    const { messages, name } = await req.json();
    const response = await opper.call({
      model: "openai/gpt-4o-mini",
      name,
      instructions: prompts,
      input: messages,
    });

    const responseJson = JSON.parse(response.message as string);
    const structuredResponse = {
      type: responseJson.type,
      message: responseJson.message,
      function_call: responseJson.function_call,
      function_args: responseJson.function_args as Record<string, number>,
      result: null as number | null,
    }

    structuredResponse.result = manageToolCalls(structuredResponse);

    return Response.json({ response: structuredResponse });
  } catch (error) {
    console.log(error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

function manageToolCalls(structuredResponse: { type: string, message: string, function_call: string, function_args: Record<string, number>, result: number | null }): number | null {
  if (structuredResponse.type === "function_call") {
    switch (structuredResponse.function_call) {
      case "sum":
        return sum(structuredResponse.function_args);
      case "diff":
        return diff(structuredResponse.function_args);
      case "prod":
        return prod(structuredResponse.function_args);
      default:
        return null;
    }
  }
  return null;
}

function sum(args: Record<string, number>) {
  return Object.values(args).reduce((acc, curr) => acc + curr, 0);
}

function diff(args: Record<string, number>) {
  return Object.values(args).reduce((acc, curr)=> acc - curr, 0);
}

function prod(args: Record<string, number>) {
  return Object.values(args).reduce((acc, curr)=> acc * curr, 1);
}
