import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  DependencySignal,
  RepoInsight,
  RiskSignal,
  ScriptCommand
} from "./types.js";
import type { ScanResult } from "./scanner.js";

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".mts": "TypeScript",
  ".cts": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".py": "Python",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".kt": "Kotlin",
  ".swift": "Swift",
  ".rb": "Ruby",
  ".php": "PHP",
  ".cs": "C#",
  ".cpp": "C++",
  ".cc": "C++",
  ".c": "C",
  ".h": "C/C++",
  ".html": "HTML",
  ".css": "CSS",
  ".scss": "CSS",
  ".md": "Markdown",
  ".mdx": "Markdown",
  ".json": "JSON",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".toml": "TOML",
  ".sql": "SQL",
  ".sh": "Shell",
  ".zsh": "Shell",
  ".bash": "Shell"
};

const FRAMEWORK_DEPENDENCIES: Record<string, string> = {
  react: "React",
  "react-dom": "React",
  next: "Next.js",
  vue: "Vue",
  nuxt: "Nuxt",
  svelte: "Svelte",
  "@sveltejs/kit": "SvelteKit",
  astro: "Astro",
  vite: "Vite",
  express: "Express",
  fastify: "Fastify",
  hono: "Hono",
  "@nestjs/core": "NestJS",
  prisma: "Prisma",
  drizzle: "Drizzle",
  sequelize: "Sequelize",
  mongoose: "Mongoose",
  playwright: "Playwright",
  vitest: "Vitest",
  jest: "Jest",
  pytest: "pytest",
  ruff: "Ruff",
  django: "Django",
  flask: "Flask",
  fastapi: "FastAPI",
  tauri: "Tauri",
  electron: "Electron",
  remotion: "Remotion",
  three: "Three.js"
};

const DANGEROUS_SCRIPT_PATTERNS: Array<{ pattern: RegExp; note: string }> = [
  { pattern: /\brm\s+-rf\b/, note: "contains recursive deletion" },
  { pattern: /\bsudo\b/, note: "requests elevated privileges" },
  { pattern: /\bcurl\b.*\|\s*(bash|sh)\b/, note: "pipes remote code into a shell" },
  { pattern: /\bwget\b.*\|\s*(bash|sh)\b/, note: "pipes remote code into a shell" },
  { pattern: /\bdrop\s+database\b/i, note: "may drop a database" },
  { pattern: /\bprisma\s+migrate\s+reset\b/, note: "may reset a database" },
  { pattern: /\bdocker\s+compose\s+down\b/, note: "stops local services" },
  { pattern: /\bterraform\s+apply\b/, note: "changes infrastructure" },
  { pattern: /\bkubectl\s+(delete|apply)\b/, note: "changes Kubernetes resources" },
  { pattern: /\bgh\s+repo\s+delete\b/, note: "can delete a GitHub repository" }
];

export async function analyzeRepository(scan: ScanResult): Promise<RepoInsight> {
  const packageJson = await readPackageJson(scan.root);
  const scripts = packageJson ? extractScripts(packageJson, "package.json") : [];
  const dependencies = packageJson ? extractDependencies(packageJson, "package.json") : [];
  const frameworks = inferFrameworks(scan, dependencies);
  const risks = inferRisks(scan, scripts);
  const languages = inferLanguages(scan);

  return {
    repoName: scan.repoName,
    repoRoot: scan.root,
    generatedAt: new Date().toISOString(),
    packageManager: scan.packageManager,
    languages,
    frameworks,
    configFiles: scan.configFiles,
    entrypoints: scan.entrypoints,
    tests: scan.tests,
    docs: scan.docs,
    scripts,
    dependencies,
    risks,
    files: scan.files,
    ignoredDirs: scan.ignoredDirs,
    totalFiles: scan.files.length,
    truncated: scan.truncated
  };
}

function inferLanguages(scan: ScanResult): RepoInsight["languages"] {
  const counts = new Map<string, number>();

  for (const file of scan.files) {
    const language = LANGUAGE_BY_EXTENSION[file.ext];
    if (!language) continue;
    counts.set(language, (counts.get(language) ?? 0) + 1);
  }

  const total = [...counts.values()].reduce((sum, value) => sum + value, 0) || 1;

  return [...counts.entries()]
    .map(([name, files]) => ({ name, files, percent: Math.round((files / total) * 100) }))
    .sort((a, b) => b.files - a.files || a.name.localeCompare(b.name));
}

function extractScripts(packageJson: PackageJson, source: string): ScriptCommand[] {
  if (!packageJson.scripts || typeof packageJson.scripts !== "object") {
    return [];
  }

  return Object.entries(packageJson.scripts)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([name, command]) => {
      const riskNotes = DANGEROUS_SCRIPT_PATTERNS.filter(({ pattern }) => pattern.test(command)).map(
        ({ note }) => note
      );
      const category = categorizeScript(name, command);
      const risk: ScriptCommand["risk"] =
        riskNotes.length > 0 || category === "deploy" || category === "db" ? "high" : "low";
      return {
        name,
        command,
        source,
        category,
        risk,
        notes: riskNotes
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function extractDependencies(packageJson: PackageJson, source: string): DependencySignal[] {
  const groups: Array<[keyof PackageJson, DependencySignal["kind"]]> = [
    ["dependencies", "runtime"],
    ["devDependencies", "dev"],
    ["peerDependencies", "peer"],
    ["optionalDependencies", "optional"]
  ];

  return groups.flatMap(([field, kind]) => {
    const deps = packageJson[field];
    if (!deps || typeof deps !== "object") return [];
    return Object.keys(deps)
      .sort()
      .map((name) => ({ name, source, kind }));
  });
}

function inferFrameworks(scan: ScanResult, dependencies: DependencySignal[]): string[] {
  const found = new Set<string>();

  for (const dep of dependencies) {
    const framework = FRAMEWORK_DEPENDENCIES[dep.name];
    if (framework) found.add(framework);
  }

  for (const file of scan.configFiles) {
    if (file.includes("next.config")) found.add("Next.js");
    if (file.includes("vite.config")) found.add("Vite");
    if (file.includes("astro.config")) found.add("Astro");
    if (file.includes("svelte.config")) found.add("SvelteKit");
    if (file === "Cargo.toml") found.add("Rust");
    if (file === "go.mod") found.add("Go");
    if (file === "pyproject.toml") found.add("Python");
    if (file === "docker-compose.yml" || file === "compose.yml") found.add("Docker Compose");
    if (file.startsWith(".github/workflows/")) found.add("GitHub Actions");
  }

  return [...found].sort();
}

function inferRisks(scan: ScanResult, scripts: ScriptCommand[]): RiskSignal[] {
  const risks: RiskSignal[] = [];
  const fileSet = new Set(scan.files.map((file) => file.path));

  const envFiles = scan.files
    .map((file) => file.path)
    .filter((file) => /^\.env($|\.)/.test(file) && !file.endsWith(".example") && !file.endsWith(".sample"));

  for (const envFile of envFiles) {
    risks.push({
      title: "Potential local secret file",
      severity: "high",
      evidence: envFile,
      recommendation: "Do not paste this file into prompts. Add a redacted .env.example if agents need variable names."
    });
  }

  for (const script of scripts.filter((item) => item.risk === "high")) {
    risks.push({
      title: `Review script before agent execution: ${script.name}`,
      severity: "high",
      evidence: `${script.source} -> ${script.command}`,
      recommendation: "Require explicit human approval before running this command."
    });
  }

  if (fileSet.has("package.json") && scan.packageManager === "unknown") {
    risks.push({
      title: "Package manager could not be inferred",
      severity: "medium",
      evidence: "package.json exists without a recognized lockfile",
      recommendation: "Tell agents which package manager to use before installing dependencies."
    });
  }

  if (scan.tests.length === 0) {
    risks.push({
      title: "No obvious tests detected",
      severity: "medium",
      evidence: "No test directories or *.test/spec files found during scan",
      recommendation: "Ask agents to add a focused smoke test or manual verification note with each change."
    });
  }

  if (scan.truncated) {
    risks.push({
      title: "Scan was truncated",
      severity: "medium",
      evidence: "The file limit was reached before the repository scan completed",
      recommendation: "Increase --max-files for a complete context pack."
    });
  }

  return risks.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

function categorizeScript(name: string, command: string): ScriptCommand["category"] {
  const value = `${name} ${command}`.toLowerCase();
  if (/(dev|serve|watch|start)/.test(value)) return "dev";
  if (/(build|compile|bundle)/.test(value)) return "build";
  if (/(test|spec|vitest|jest|pytest|playwright)/.test(value)) return "test";
  if (/(lint|eslint|ruff|check)/.test(value)) return "lint";
  if (/(format|prettier|fmt)/.test(value)) return "format";
  if (/(deploy|release|publish|vercel|netlify)/.test(value)) return "deploy";
  if (/(db|database|migrate|seed|prisma|drizzle)/.test(value)) return "db";
  return "other";
}

async function readPackageJson(root: string): Promise<PackageJson | null> {
  const packagePath = path.join(root, "package.json");
  try {
    const raw = await fs.readFile(packagePath, "utf8");
    return JSON.parse(raw) as PackageJson;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw new Error(`Could not read package.json: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function severityRank(severity: RiskSignal["severity"]): number {
  return { low: 1, medium: 2, high: 3 }[severity];
}

interface PackageJson {
  scripts?: Record<string, unknown>;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  peerDependencies?: Record<string, unknown>;
  optionalDependencies?: Record<string, unknown>;
}
