import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRepository } from "./analyzer.js";
import { generateOutputs } from "./generator.js";
import { scanRepository } from "./scanner.js";

test("scan and generate a context pack for the fixture repository", async () => {
  const scan = await scanRepository("fixtures/example-repo", 1000);
  const insight = await analyzeRepository(scan);
  const outputs = generateOutputs(insight, "markdown");

  assert.equal(insight.packageManager, "npm");
  assert.ok(insight.frameworks.includes("Vite"));
  assert.ok(insight.frameworks.includes("React"));
  assert.ok(insight.tests.includes("src/app.test.ts"));
  assert.ok(insight.risks.some((risk) => risk.title.includes("Review script")));
  assert.deepEqual(
    outputs.map((output) => output.filename),
    ["AGENTS.md", "agent-brief.md", "commands.md", "repo-map.md", "risk-report.md"]
  );
});
