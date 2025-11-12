import fs from "fs/promises";

export const isFileExists = async (path: string) => {
  try {
    await fs.stat(path);
    return true;
  } catch {
    return false;
  }
};
