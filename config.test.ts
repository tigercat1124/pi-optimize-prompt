import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadConfig } from "./index.ts";

const dir = mkdtempSync(join(tmpdir(), "optimize-prompt-"));
const path = join(dir, "optimize-prompt.json");

test("loadConfig returns defaults for a missing file", () => {
	assert.deepEqual(loadConfig(join(dir, "missing.json")), { auto: true, level: "medium" });
});

test("loadConfig returns defaults for broken JSON", () => {
	writeFileSync(path, "not json {");
	assert.deepEqual(loadConfig(path), { auto: true, level: "medium" });
});

test("loadConfig falls back to the default level on an unknown value", () => {
	writeFileSync(path, JSON.stringify({ auto: false, level: "extreme" }));
	assert.deepEqual(loadConfig(path), { auto: false, level: "medium" });
});

test("loadConfig parses a valid file", () => {
	writeFileSync(path, JSON.stringify({ auto: false, model: "openrouter/anthropic/claude", level: "high" }));
	assert.deepEqual(loadConfig(path), { auto: false, model: "openrouter/anthropic/claude", level: "high" });
});
