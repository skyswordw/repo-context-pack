import { promises as fs } from "node:fs";
import path from "node:path";
import type { OutputFile } from "./types.js";

export async function writeOutputs(outDir: string, outputs: OutputFile[], force: boolean): Promise<string[]> {
  const absoluteOut = path.resolve(outDir);
  await ensureWritableDirectory(absoluteOut, force);

  const written: string[] = [];
  for (const output of outputs) {
    const target = path.join(absoluteOut, output.filename);
    await fs.writeFile(target, output.content, "utf8");
    written.push(target);
  }

  return written;
}

async function ensureWritableDirectory(outDir: string, force: boolean): Promise<void> {
  try {
    const stat = await fs.stat(outDir);
    if (!stat.isDirectory()) {
      throw new Error(`Output path exists and is not a directory: ${outDir}`);
    }

    const entries = await fs.readdir(outDir);
    if (entries.length > 0 && !force) {
      throw new Error(`Output directory is not empty: ${outDir}. Pass --force to overwrite generated files.`);
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      await fs.mkdir(outDir, { recursive: true });
      return;
    }
    throw error;
  }
}
