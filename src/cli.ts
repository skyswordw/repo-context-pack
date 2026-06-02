#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { analyzeRepository } from "./analyzer.js";
import { generateOutputs } from "./generator.js";
import { scanRepository } from "./scanner.js";
import type { CliOptions } from "./types.js";
import { writeOutputs } from "./writer.js";

const DEFAULT_MAX_FILES = 7000;

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const scan = await scanRepository(options.repo, options.maxFiles);
  const insight = await analyzeRepository(scan);
  const outputs = generateOutputs(insight, options.format);
  const written = await writeOutputs(options.out, outputs, options.force);

  console.log(`Generated ${written.length} file${written.length === 1 ? "" : "s"} in ${options.out}`);
  for (const file of written) {
    console.log(`- ${file}`);
  }

  if (insight.risks.some((risk) => risk.severity === "high")) {
    console.log("\nHigh-risk signals were found. See risk-report.md before allowing agents to run commands.");
  }
}

export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    repo: process.cwd(),
    out: "agent-context",
    force: false,
    format: "markdown",
    maxFiles: DEFAULT_MAX_FILES
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg) continue;

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg === "--json") {
      options.format = "json";
      continue;
    }

    if (arg === "--repo" || arg === "-r") {
      options.repo = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--out" || arg === "-o") {
      options.out = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--max-files") {
      const value = Number.parseInt(readValue(args, index, arg), 10);
      if (!Number.isFinite(value) || value < 1) {
        throw new Error("--max-files must be a positive integer");
      }
      options.maxFiles = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    options.repo = arg;
  }

  return options;
}

function readValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function printHelp(): void {
  console.log(`repo-context-pack

Generate a compact context pack for coding agents entering an unfamiliar repository.

Usage:
  repo-context-pack [repo] [options]

Options:
  -r, --repo <path>       Repository to scan. Defaults to current directory.
  -o, --out <path>        Output directory. Defaults to ./agent-context.
      --json              Write repo-context.json instead of Markdown files.
      --max-files <n>     Maximum files to scan. Defaults to ${DEFAULT_MAX_FILES}.
      --force             Allow writing into a non-empty output directory.
  -h, --help              Show this help.

Examples:
  repo-context-pack
  repo-context-pack --repo ../my-app --out ./context-pack
  repo-context-pack ../my-app --json --force
`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
