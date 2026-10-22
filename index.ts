/**
 * Prompt optimizer.
 * - Auto: every submitted prompt is optimized first (toggle: /optimize-auto). Prefix "\" to skip once.
 * - Manual: Alt+O or /optimize rewrites the editor text so you can review before sending.
 * - Model: /optimize-model picks the model (default: current session model).
 * - Level: /optimize-level sets how eagerly auto mode runs: low (short prompts only), medium (default), high (everything but commands).
 * Any failure falls back to your original text. Config: ~/.pi/agent/optimize-prompt.json
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DEFAULT_LEVEL, LEVELS, type Level, SYSTEM, buildPayload, classifyInput, cleanReply, isLevel, matchesAny, parseModelKey } from "./core.ts";

const CONFIG_PATH = join(homedir(), ".pi", "agent", "optimize-prompt.json");
const TIMEOUT_MS = 30_000;
const SESSION_MODEL = "(current session model)";

export type Config = { auto: boolean; model?: string; level: Level; exclude?: string[] };

export function loadConfig(path: string = CONFIG_PATH): Config {
	try {
		if (existsSync(path)) {
			const parsed = { auto: true, ...JSON.parse(readFileSync(path, "utf8")) } as Record<string, unknown>;
			const out: Config = {
				auto: typeof parsed.auto === "boolean" ? parsed.auto : true,
				level: isLevel(parsed.level) ? parsed.level : DEFAULT_LEVEL, // unknown level falls back to the default
			};
			if (typeof parsed.model === "string") out.model = parsed.model;
			if (Array.isArray(parsed.exclude)) {
				const e = parsed.exclude.filter((x): x is string => typeof x === "string");
				if (e.length) out.exclude = e;
			}
			return out;
		}
	} catch {}
	return { auto: true, level: DEFAULT_LEVEL };
}
const saveConfig = (c: Config) => {
	const tmp = `${CONFIG_PATH}.${randomBytes(4).toString("hex")}.tmp`; // write+rename so a crash cannot leave a half-written config
	writeFileSync(tmp, JSON.stringify(c, null, 2));
	renameSync(tmp, CONFIG_PATH);
};

const CACHE_MAX = 100; // session-only cache: identical prompts reuse the previous rewrite
const rewriteCache = new Map<string, string>();
const stats = { requests: 0, hits: 0, input: 0, output: 0, cost: 0 };
let lastRewrite: string | undefined; // editor text before the last successful /optimize, for /optimize-undo

function pickModel(ctx: ExtensionContext) {
	const key = loadConfig().model;
	if (!key) return ctx.model;
	const [provider, id] = parseModelKey(key);
	return ctx.modelRegistry.find(provider, id) ?? ctx.model;
}

/** Returns the rewritten prompt, or null on any failure / unsafe rewrite (caller keeps the original). */
async function rewrite(ctx: ExtensionContext, draft: string, signal?: AbortSignal): Promise<string | null> {
	const cached = rewriteCache.get(draft);
	if (cached !== undefined) {
		stats.hits++;
		return cached;
	}
	const model = pickModel(ctx);
	if (!model) return null;
	const nonce = randomBytes(6).toString("hex");
	const timeout = AbortSignal.timeout(TIMEOUT_MS);
	try {
		const r = await ctx.modelRegistry.complete(
			model,
			{
				systemPrompt: SYSTEM,
				messages: [
					{ role: "user", content: [{ type: "text", text: buildPayload(draft, nonce) }], timestamp: Date.now() },
				],
			},
			{ signal: signal ? AbortSignal.any([signal, timeout]) : timeout },
		);
		stats.requests++;
		stats.input += r.usage.input;
		stats.output += r.usage.output;
		stats.cost += r.usage.cost.total;
		if (r.stopReason === "aborted" || r.stopReason === "error") return null;
		const raw = r.content.flatMap((c) => (c.type === "text" ? [c.text] : [])).join("\n");
		const out = cleanReply(raw, draft, nonce);
		if (out !== null) {
			if (rewriteCache.size >= CACHE_MAX) {
				const oldest = rewriteCache.keys().next().value;
				if (oldest !== undefined) rewriteCache.delete(oldest);
			}
			rewriteCache.set(draft, out);
		}
		return out;
	} catch {
		return null;
	}
}

/** Rewrite the editor draft; returns null after notifying on empty draft or failure. */
async function optimizeDraft(ctx: ExtensionContext): Promise<{ draft: string; out: string } | null> {
	const draft = ctx.ui.getEditorText().trim();
	if (!draft) {
		ctx.ui.notify("Editor is empty", "error");
		return null;
	}
	ctx.ui.notify("Optimizing prompt…", "info");
	const out = await rewrite(ctx, draft);
	if (!out) {
		ctx.ui.notify("Optimize failed; original kept", "error");
		return null;
	}
	return { draft, out };
}

async function optimizeEditor(ctx: ExtensionContext) {
	const r = await optimizeDraft(ctx);
	if (!r) return;
	if (r.out === r.draft) return ctx.ui.notify("Optimize: no change", "info");
	lastRewrite = r.draft;
	ctx.ui.setEditorText(r.out);
	ctx.ui.notify("Optimized. Edit and submit. (/optimize-undo restores)", "info");
}

async function previewEditor(ctx: ExtensionContext) {
	const r = await optimizeDraft(ctx);
	if (!r) return;
	ctx.ui.notify(r.out === r.draft ? "Preview: no change" : `Preview:\n${r.out}`, "info");
}

export default function (pi: ExtensionAPI) {
	pi.on("input", async (event, ctx) => {
		const c = loadConfig();
		if (event.source === "extension" || !c.auto) return { action: "continue" };
		if (matchesAny(event.text, c.exclude)) return { action: "continue" };
		const kind = classifyInput(event.text, c.level);
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

	pi.registerCommand("optimize-preview", {
		description: "Show the optimized prompt without changing the editor",
		handler: async (_a, ctx) => previewEditor(ctx),
	});

	pi.registerCommand("optimize-undo", {
		description: "Restore the editor text replaced by the last /optimize",
		handler: async (_a, ctx) => {
			if (lastRewrite === undefined) return ctx.ui.notify("Nothing to undo", "error");
			ctx.ui.setEditorText(lastRewrite);
			lastRewrite = undefined;
			ctx.ui.notify("Restored previous editor text", "info");
		},
	});

	pi.registerCommand("optimize-stats", {
		description: "Show optimizer request and token counts for this session",
		handler: async (_a, ctx) => {
			ctx.ui.notify(
				`Optimize stats: ${stats.requests} requests (${stats.hits} cache hits), ` +
					`${stats.input} in / ${stats.output} out tokens, ~$${stats.cost.toFixed(4)}`,
				"info",
			);
		},
	});

	pi.registerCommand("optimize-auto", {
		description: "Toggle auto-optimize on submit (on|off)",
		handler: async (args, ctx) => {
			const c = loadConfig();
			const a = args.trim();
			if (a === "on") c.auto = true;
			else if (a === "off") c.auto = false;
			else c.auto = !c.auto;
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
}
