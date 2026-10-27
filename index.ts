/**
 * Prompt optimizer.
 * - Auto: every submitted prompt is optimized first (toggle: /optimize-auto). Prefix "\" to skip once.
 * - Manual: Alt+O or /optimize rewrites the editor text so you can review before sending.
 * - Model: /optimize-model picks the model (default: current session model).
 * - Level: /optimize-level sets how eagerly auto mode runs: low (short prompts only), medium (default), high (everything but commands).
 * - Context: recent session text is sent as reference; /optimize-context sets the max chars (default 48000, 0 = none).
 * Any failure falls back to your original text. Config: ~/.pi/agent/optimize-prompt.json
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { CONTEXT_CHOICES, DEFAULT_LEVEL, capContextChars, LEVELS, type Level, SYSTEM, buildPayload, classifyInput, cleanReply, formatContext, isLevel, parseModelKey, resolveContextChars, wantsContext } from "./core.ts";

const CONFIG_PATH = join(homedir(), ".pi", "agent", "optimize-prompt.json");
const TIMEOUT_MS = 30_000;
const SESSION_MODEL = "(current session model)";

type Config = { auto: boolean; model?: string; level: Level; contextChars?: number };

function loadConfig(): Config {
	try {
		if (existsSync(CONFIG_PATH)) {
			const c = { auto: true, ...JSON.parse(readFileSync(CONFIG_PATH, "utf8")) };
			return { ...c, level: isLevel(c.level) ? c.level : DEFAULT_LEVEL }; // unknown level falls back to the default
		}
	} catch {}
	return { auto: true, level: DEFAULT_LEVEL };
}
const saveConfig = (c: Config) => writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2));

function pickModel(ctx: ExtensionContext) {
	const key = loadConfig().model;
	if (!key) return ctx.model;
	const [provider, id] = parseModelKey(key);
	return ctx.modelRegistry.find(provider, id) ?? ctx.model;
}

/** Returns the rewritten prompt, or null on any failure / unsafe rewrite (caller keeps the original). */
async function rewrite(ctx: ExtensionContext, draft: string, signal?: AbortSignal): Promise<string | null> {
	const model = pickModel(ctx);
	if (!model) return null;
	const nonce = randomBytes(6).toString("hex");
	const timeout = AbortSignal.timeout(TIMEOUT_MS);
	try {
		const context = wantsContext(draft)
			? formatContext(
					ctx.sessionManager.getBranch().flatMap((e) => (e.type === "message" ? [e.message] : [])),
					capContextChars(resolveContextChars(loadConfig().contextChars), model.contextWindow),
				)
			: "";
		const r = await ctx.modelRegistry.complete(
			model,
			{
				systemPrompt: SYSTEM,
				messages: [
					{ role: "user", content: [{ type: "text", text: buildPayload(draft, nonce, context) }], timestamp: Date.now() },
				],
			},
			{ signal: signal ? AbortSignal.any([signal, timeout]) : timeout },
		);
		if (r.stopReason === "aborted" || r.stopReason === "error") return null;
		const raw = r.content
			.filter((c): c is { type: "text"; text: string } => c.type === "text")
			.map((c) => c.text)
			.join("\n");
		return cleanReply(raw, draft, nonce);
	} catch {
		return null;
	}
}

async function optimizeEditor(ctx: ExtensionContext) {
	const draft = ctx.ui.getEditorText().trim();
	if (!draft) return ctx.ui.notify("Editor is empty", "error");
	ctx.ui.notify("Optimizing prompt…", "info");
	const out = await rewrite(ctx, draft);
	if (!out) return ctx.ui.notify("Optimize failed; original kept", "error");
	if (out === draft) return ctx.ui.notify("Optimize: no change", "info");
	ctx.ui.setEditorText(out);
	ctx.ui.notify("Optimized. Edit and submit.", "info");
}

export default function (pi: ExtensionAPI) {
	pi.on("input", async (event, ctx) => {
		if (event.source === "extension" || !loadConfig().auto) return { action: "continue" };
		const kind = classifyInput(event.text, loadConfig().level);
		if (kind === "skip") return { action: "continue" };
		if (kind === "escape")
			return { action: "transform", text: event.text.replace(/^\s*\\/, ""), images: event.images };

		const original = event.text.trim();
		ctx.ui.notify("Optimizing prompt…", "info");
		const out = await rewrite(ctx, event.text, ctx.signal);
		if (!out) {
			ctx.ui.notify("Optimize failed: sending your original prompt", "warning");
			return { action: "continue" };
		}
		if (out === original) {
			ctx.ui.notify("Optimize: no change (sending your original prompt)", "info");
			return { action: "continue" };
		}
		ctx.ui.notify(`Original:\n${original}`, "info"); // pi echoes the optimized text as the user message
		return { action: "transform", text: out, images: event.images };
	});

	pi.registerCommand("optimize", { description: "Optimize the prompt in the editor", handler: async (_a, ctx) => optimizeEditor(ctx) });
	pi.registerShortcut("alt+o", { description: "Optimize prompt", handler: optimizeEditor });

	pi.registerCommand("optimize-auto", {
		description: "Toggle auto-optimize on submit (on|off)",
		handler: async (args, ctx) => {
			const c = loadConfig();
			const a = args.trim();
			c.auto = a === "on" ? true : a === "off" ? false : !c.auto;
			saveConfig(c);
			ctx.ui.notify(`Auto-optimize: ${c.auto ? "ON" : "OFF"}`, "info");
		},
	});

	pi.registerCommand("optimize-model", {
		description: "Choose the model used for optimizing",
		handler: async (_a, ctx) => {
			const ids = ctx.modelRegistry.getAvailable().map((m) => `${m.provider}/${m.id}`);
			const pick = await ctx.ui.select("Optimizer model", [SESSION_MODEL, ...ids]);
			if (!pick) return;
			const c = loadConfig();
			c.model = pick === SESSION_MODEL ? undefined : pick;
			saveConfig(c);
			ctx.ui.notify(`Optimizer model: ${c.model ?? SESSION_MODEL}`, "info");
		},
	});

	pi.registerCommand("optimize-level", {
		description: "Set how eagerly auto-optimize runs (low|medium|high)",
		handler: async (args, ctx) => {
			const a = args.trim();
			const pick = isLevel(a) ? a : await ctx.ui.select("Optimize level", [...LEVELS]);
			if (!pick) return;
			const c = loadConfig();
			c.level = pick as Level;
			saveConfig(c);
			ctx.ui.notify(`Optimize level: ${c.level}`, "info");
		},
	});

	pi.registerCommand("optimize-context", {
		description: "Set max session-context chars sent to the optimizer (number, or pick)",
		handler: async (args, ctx) => {
			const a = args.trim();
			const n = Number(a);
			const pick = a ? n : Number(await ctx.ui.select("Max context chars", CONTEXT_CHOICES.map(String)));
			if (!Number.isInteger(pick) || pick < 0) return a ? ctx.ui.notify("Usage: /optimize-context <chars, 0 = off>", "error") : undefined;
			const c = loadConfig();
			c.contextChars = pick;
			saveConfig(c);
			ctx.ui.notify(`Optimizer context: ${pick ? `${pick} chars (capped to the model window)` : "OFF"}`, "info");
		},
	});
}
