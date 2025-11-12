import { FnlyRequest } from "fnly";
import { wish } from "../_utils.js";

export const GET = async (req: FnlyRequest) => {
  const { id } = req.params;
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello details route!,", id, wish: wish() })
  };
};
