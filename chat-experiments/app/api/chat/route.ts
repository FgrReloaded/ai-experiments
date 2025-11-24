import { Opper } from "opperai";

const opper = new Opper({
  httpBearer: process.env.OPPERAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const response = await opper.call({
      model: "openai/gpt-4o-mini",
      name: "train_speed_calculation",
      instructions: "You are a helpful assistant that can answer questions and help with tasks.",
      input: messages,
    });
    return Response.json({ response });
  } catch (error) {
    console.log(error);
    return new Response("Internal Server Error", { status: 500 });
  }
}



 