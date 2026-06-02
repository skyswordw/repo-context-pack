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

test("flags nested env files by path without reading their contents", async () => {
  const scan = await scanRepository("fixtures/nested-env-repo", 1000);
  const insight = await analyzeRepository(scan);

  assert.ok(
    insight.risks.some(
      (risk) => risk.title === "Potential local secret file" && risk.evidence === "apps/web/.env"
    )
  );
  assert.ok(!JSON.stringify(insight).includes("SECRET_TOKEN"));
});

test("does not assume npm when package.json has no lockfile", async () => {
  const scan = await scanRepository("fixtures/no-lockfile-repo", 1000);
  const insight = await analyzeRepository(scan);

  assert.equal(insight.packageManager, "unknown");
  assert.ok(insight.risks.some((risk) => risk.title === "Package manager could not be inferred"));
});
