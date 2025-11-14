import { FnlyRequest } from "fnly";

export const GET = async (req: FnlyRequest) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello from route fnly!" })
  };
};

export const POST = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello from post route fnly!" })
  };
};

export const PUT = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello from put route fnly!" })
  };
};

export const DELETE = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello from delete route fnly!" })
  };
};
