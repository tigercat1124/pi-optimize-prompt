import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_CONTEXT_CHARS, LOW_MAX_CHARS, MIN_CHARS, resolveContextChars, wantsContext, buildPayload, classifyInput, capContextChars, cleanReply, formatContext, isLevel, mentions, parseModelKey } from "./core.ts";

test("classifyInput", () => {
	assert.equal(classifyInput("authのバグを直して"), "optimize");
	assert.equal(classifyInput("\\ raw text here"), "escape");
	assert.equal(classifyInput("/var/folders/x/pi-clipboard.png 直して"), "optimize"); // pasted image path is not a command
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

test("formatContext keeps text turns, drops tool results, keeps newest within budget", () => {
	const msgs = [
		{ role: "user", content: "old turn" },
		{ role: "toolResult", content: [{ type: "text", text: "noise" }] },
		{ role: "assistant", content: [{ type: "thinking", thinking: "x" }, { type: "text", text: "use FooBar" }] },
		{ role: "user", content: "latest" },
	];
	assert.equal(formatContext(msgs), "user: old turn\n\nassistant: use FooBar\n\nuser: latest");
	assert.equal(formatContext(msgs, 20), "user: latest");
	assert.match(buildPayload("d", "n", "ctx"), /^<conversation_context-n>\nctx\n<\/conversation_context-n>\n\n<original_prompt-n>/);
});

test("capContextChars", () => {
	assert.equal(capContextChars(24000), 24000);
	assert.equal(capContextChars(96000, 32000), 16000);
	assert.equal(capContextChars(6000, 200000), 6000);
});

test("resolveContextChars falls back to the default for bad values", () => {
	for (const v of [0, 1, 12000]) assert.equal(resolveContextChars(v), v);
	for (const v of ["abc", "100", -1, 1.5, NaN, Infinity, null, undefined]) assert.equal(resolveContextChars(v), DEFAULT_CONTEXT_CHARS);
});

test("wantsContext skips drafts shorter than MIN_CHARS", () => {
	assert.equal(wantsContext("yes"), false);
	assert.equal(wantsContext(`  ${"a".repeat(MIN_CHARS - 1)}  `), false);
	assert.equal(wantsContext("a".repeat(MIN_CHARS)), true);
});
