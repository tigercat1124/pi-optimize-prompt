import assert from "node:assert/strict";
import { test } from "node:test";
import { LOW_MAX_CHARS, buildPayload, classifyInput, cleanReply, isLevel, matchesAny, mentions, parseModelKey } from "./core.ts";

test("classifyInput", () => {
	assert.equal(classifyInput("fix the auth bug"), "optimize");
	assert.equal(classifyInput("\\ raw text here"), "escape");
	assert.equal(classifyInput("/var/folders/x/pi-clipboard.png fix this"), "optimize"); // pasted image path is not a command
	for (const t of ["ok", "/model", "!ls -la /tmp", "   short "]) assert.equal(classifyInput(t), "skip");
});

test("mentions ignores order, detects change", () => {
	assert.equal(mentions("b @x.ts and @a/y.ts"), mentions("@a/y.ts then @x.ts"));
	assert.notEqual(mentions("@x.ts"), mentions("x.ts"));
});

test("cleanReply", () => {
	const n = "abc123";
	assert.equal(cleanReply(buildPayload("fix it", n), "fix it", n), "fix it"); // copied wrapper stripped
	assert.equal(cleanReply("  Fix the bug.  ", "fix", n), "Fix the bug.");
	assert.equal(cleanReply("", "fix", n), null);
	assert.equal(cleanReply("see @a.ts", "see @b.ts", n), null); // mention changed
	assert.equal(cleanReply("see @a.ts", "see @a.ts", n), "see @a.ts");
});

test("matchesAny", () => {
	assert.equal(matchesAny("fix auth", ["auth", "other"]), true);
	assert.equal(matchesAny("fix auth", ["^deploy"]), false);
	assert.equal(matchesAny("fix auth", ["(", "auth"]), true); // invalid regex ignored
	assert.equal(matchesAny("fix auth", []), false);
	assert.equal(matchesAny("fix auth"), false);
});

test("parseModelKey keeps slashes in id", () => {
	assert.deepEqual(parseModelKey("openrouter/anthropic/claude"), ["openrouter", "anthropic/claude"]);
});

test("classifyInput levels", () => {
	const mid8 = "a".repeat(8);
	const lowMax = "a".repeat(LOW_MAX_CHARS);
	// default level is medium
	assert.equal(classifyInput(lowMax + "b"), "optimize");
	assert.equal(classifyInput(mid8, "medium"), "optimize");
	assert.equal(classifyInput("a".repeat(7), "medium"), "skip");
	// low: only 8..LOW_MAX_CHARS chars
	assert.equal(classifyInput("a".repeat(7), "low"), "skip");
	assert.equal(classifyInput(mid8, "low"), "optimize");
	assert.equal(classifyInput(lowMax, "low"), "optimize");
	assert.equal(classifyInput(lowMax + "b", "low"), "skip");
	// high: short text too, empty and commands still skipped
	assert.equal(classifyInput("ok", "high"), "optimize");
	assert.equal(classifyInput("   ", "high"), "skip");
	for (const lv of ["low", "medium", "high"] as const) {
		assert.equal(classifyInput("/model", lv), "skip");
		assert.equal(classifyInput("!ls -la /tmp", lv), "skip");
		assert.equal(classifyInput("\\ raw", lv), "escape");
	}
});

test("isLevel", () => {
	assert.ok(isLevel("low") && isLevel("medium") && isLevel("high"));
	assert.ok(!isLevel("extreme") && !isLevel(undefined));
});
