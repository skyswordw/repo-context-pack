import assert from "node:assert/strict";
import test from "node:test";
import { parseArgs } from "./cli.js";

test("parseArgs defaults to current directory and markdown output", () => {
  const options = parseArgs([]);
  assert.equal(options.out, "agent-context");
  assert.equal(options.format, "markdown");
  assert.equal(options.force, false);
});

test("parseArgs supports repo, out, json, force, and max-files", () => {
  const options = parseArgs(["--repo", "fixtures/example-repo", "--out", "tmp/out", "--json", "--force", "--max-files", "42"]);
  assert.equal(options.repo, "fixtures/example-repo");
  assert.equal(options.out, "tmp/out");
  assert.equal(options.format, "json");
  assert.equal(options.force, true);
  assert.equal(options.maxFiles, 42);
});
