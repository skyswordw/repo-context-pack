export type PackageManager = "npm" | "pnpm" | "yarn" | "bun" | "unknown";

export interface CliOptions {
  repo: string;
  out: string;
  force: boolean;
  format: "markdown" | "json";
  maxFiles: number;
}

export interface FileEntry {
  path: string;
  size: number;
  depth: number;
  ext: string;
}

export interface ScriptCommand {
  name: string;
  command: string;
  source: string;
  category: "dev" | "build" | "test" | "lint" | "format" | "deploy" | "db" | "other";
  risk: "low" | "medium" | "high";
  notes: string[];
}

export interface DependencySignal {
  name: string;
  source: string;
  kind: "runtime" | "dev" | "peer" | "optional";
}

export interface RiskSignal {
  title: string;
  severity: "low" | "medium" | "high";
  evidence: string;
  recommendation: string;
}

export interface RepoInsight {
  repoName: string;
  repoRoot: string;
  generatedAt: string;
  packageManager: PackageManager;
  languages: Array<{ name: string; files: number; percent: number }>;
  frameworks: string[];
  configFiles: string[];
  entrypoints: string[];
  tests: string[];
  docs: string[];
  scripts: ScriptCommand[];
  dependencies: DependencySignal[];
  risks: RiskSignal[];
  files: FileEntry[];
  ignoredDirs: string[];
  totalFiles: number;
  truncated: boolean;
}

export interface OutputFile {
  filename: string;
  content: string;
}
