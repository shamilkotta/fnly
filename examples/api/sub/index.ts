import { nanoid } from "nanoid";

export async function GET() {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello sub root route!", id: nanoid() })
  };
}
