import { createRequire } from "node:module";
import { TextlintKernel } from "@textlint/kernel";
import type { TxtDocumentNode } from "@textlint/ast-node-types";
import type { TextlintMessage } from "@textlint/types";
import plugin, { type LatexPluginOptions } from "../src/index.ts";

const require = createRequire(import.meta.url);

/** Returns the default export of a CommonJS module compiled from ES modules. */
function interop<T>(module: T | { default: T }): T {
	return typeof module === "object" && module !== null && "default" in module ? module.default : module;
}

interface Preset {
	rules: Record<string, unknown>;
	rulesConfig: Record<string, unknown>;
}

const technicalWriting = interop(require("textlint-rule-preset-ja-technical-writing") as Preset);

/** Options of preset-ja-technical-writing used in the tests: full-width comma and period. */
const technicalWritingOptions: Record<string, unknown> = {
	"sentence-length": { max: 100 },
	"max-ten": { touten: "，", kuten: "．" },
	"ja-no-mixed-period": { periodMark: "．" },
	"no-mix-dearu-desumasu": { preferInBody: "である", preferInList: "である", strict: false },
};

export function parse(text: string, options: LatexPluginOptions = {}): TxtDocumentNode {
	const processor = new plugin.Processor(options);
	return processor.processor(".tex").preProcess(text) as TxtDocumentNode;
}

/** Lints `text` as a `.tex` file with preset-ja-technical-writing and the comment filter. */
export async function lint(text: string, options: LatexPluginOptions = {}): Promise<TextlintMessage[]> {
	const kernel = new TextlintKernel();
	const rules = Object.entries(technicalWriting.rules).map(([ruleId, rule]) => ({
		ruleId,
		rule: interop(rule) as never,
		options: (technicalWritingOptions[ruleId] ?? technicalWriting.rulesConfig[ruleId]) as never,
	}));
	const result = await kernel.lintText(text, {
		ext: ".tex",
		filePath: "test.tex",
		plugins: [{ pluginId: "latex", plugin, options: options as never }],
		rules,
		filterRules: [{ ruleId: "comments", rule: interop(require("textlint-filter-rule-comments")) as never }],
	});
	return result.messages;
}

/** Summarizes messages as `ruleId@line:column` (both 1-based) for compact assertions. */
export function summary(messages: TextlintMessage[]): string[] {
	return messages.map((message) => `${message.ruleId}@${message.loc.start.line}:${message.loc.start.column}`);
}
