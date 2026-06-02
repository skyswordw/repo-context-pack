import { promises as fs } from "node:fs";
import path from "node:path";
import type { FileEntry, PackageManager } from "./types.js";

const DEFAULT_IGNORED_DIRS = new Set([
  ".git",
  ".hg",
  ".svn",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".turbo",
  ".vercel",
  ".cache",
  ".parcel-cache",
  "coverage",
  "dist",
  "build",
  "out",
  "target",
  "node_modules",
  "vendor",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".venv",
  "venv",
  ".tox",
  ".gradle",
  ".idea",
  ".vscode"
]);

const CONFIG_FILE_NAMES = new Set([
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "vite.config.js",
  "next.config.js",
  "next.config.mjs",
  "astro.config.mjs",
  "svelte.config.js",
  "tailwind.config.js",
  "eslint.config.js",
  ".eslintrc",
  ".prettierrc",
  "pyproject.toml",
  "requirements.txt",
  "uv.lock",
  "poetry.lock",
  "Cargo.toml",
  "go.mod",
  "Gemfile",
  "composer.json",
  "Dockerfile",
  "docker-compose.yml",
  "compose.yml",
  "Makefile",
  "justfile",
  ".env.example",
  ".env.sample",
  ".github/workflows"
]);

const DOC_PATTERNS = [/^readme\./i, /^contributing\./i, /^agents\.md$/i, /^claude\.md$/i, /^codex\.md$/i];
const TEST_PATTERNS = [
  /(^|\/)(__tests__|tests?|spec)\//i,
  /\.(test|spec)\.[cm]?[jt]sx?$/i,
  /_test\.go$/i,
  /test_.*\.py$/i
];
const ENTRY_PATTERNS = [
  /^src\/index\.[cm]?[jt]sx?$/i,
  /^src\/main\.[cm]?[jt]sx?$/i,
  /^src\/app\.[cm]?[jt]sx?$/i,
  /^src\/cli\.[cm]?[jt]s$/i,
  /^index\.[cm]?[jt]s$/i,
  /^main\.py$/i,
  /^app\.py$/i,
  /^cmd\/[^/]+\/main\.go$/i,
  /^src\/main\.rs$/i
];

export interface ScanResult {
  root: string;
  repoName: string;
  files: FileEntry[];
  configFiles: string[];
  entrypoints: string[];
  tests: string[];
  docs: string[];
  packageManager: PackageManager;
  ignoredDirs: string[];
  truncated: boolean;
}

export async function scanRepository(repoPath: string, maxFiles: number): Promise<ScanResult> {
  const root = path.resolve(repoPath);
  const stat = await fs.stat(root);
  if (!stat.isDirectory()) {
    throw new Error(`Repository path is not a directory: ${root}`);
  }

  const files: FileEntry[] = [];
  const ignoredDirs = new Set<string>();
  let truncated = false;

  async function walk(dir: string): Promise<void> {
    if (files.length >= maxFiles) {
      truncated = true;
      return;
    }

    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (files.length >= maxFiles) {
        truncated = true;
        return;
      }

      const absolute = path.join(dir, entry.name);
      const relative = toPosix(path.relative(root, absolute));

      if (entry.isDirectory()) {
        if (DEFAULT_IGNORED_DIRS.has(entry.name)) {
          ignoredDirs.add(relative);
          continue;
        }
        await walk(absolute);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const fileStat = await fs.stat(absolute);
      files.push({
        path: relative,
        size: fileStat.size,
        depth: relative.split("/").length - 1,
        ext: path.extname(entry.name).toLowerCase()
      });
    }
  }

  await walk(root);

  const filePaths = files.map((file) => file.path);

  return {
    root,
    repoName: path.basename(root),
    files,
    configFiles: filePaths.filter(isConfigFile).sort(),
    entrypoints: filePaths.filter((file) => ENTRY_PATTERNS.some((pattern) => pattern.test(file))).sort(),
    tests: filePaths.filter((file) => TEST_PATTERNS.some((pattern) => pattern.test(file))).sort(),
    docs: filePaths.filter(isDocFile).sort(),
    packageManager: detectPackageManager(filePaths),
    ignoredDirs: [...ignoredDirs].sort(),
    truncated
  };
}

function isConfigFile(file: string): boolean {
  const basename = path.posix.basename(file);
  if (CONFIG_FILE_NAMES.has(basename) || CONFIG_FILE_NAMES.has(file)) {
    return true;
  }
  return file.startsWith(".github/workflows/");
}

function isDocFile(file: string): boolean {
  const basename = path.posix.basename(file);
  return DOC_PATTERNS.some((pattern) => pattern.test(basename)) || file.startsWith("docs/");
}

function detectPackageManager(filePaths: string[]): PackageManager {
  const files = new Set(filePaths);
  if (files.has("pnpm-lock.yaml")) return "pnpm";
  if (files.has("yarn.lock")) return "yarn";
  if (files.has("bun.lockb") || files.has("bun.lock")) return "bun";
  if (files.has("package-lock.json")) return "npm";
  return "unknown";
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}
