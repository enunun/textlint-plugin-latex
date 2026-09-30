import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test as testAst } from "@textlint/ast-tester";
import { TextlintKernel } from "@textlint/kernel";
import type { TxtDocumentNode, TxtNode } from "@textlint/ast-node-types";
import type { TextlintMessage } from "@textlint/types";
import plugin, { type LatexPluginOptions } from "../src/index.ts";

const require = createRequire(import.meta.url);

/** A TxtAST node with the optional properties the plugin sets. */
export type Node = TxtNode & { value?: string; children?: Node[]; depth?: number; ordered?: boolean; url?: string };

/**
 * Converts `text` with the plugin and asserts the invariants every converted tree must satisfy.
 * Every test that parses LaTeX goes through here, so each input is also an invariant test.
 */
export function parse(text: string, options: LatexPluginOptions = {}): Node {
	const processor = new plugin.Processor(options);
	const ast = processor.processor(".tex").preProcess(text) as TxtDocumentNode;
	assertInvariants(ast as unknown as Node, text);
	return ast as unknown as Node;
}

/**
 * The invariants of the converted tree:
 * - it is a valid TxtAST (`@textlint/ast-tester`);
 * - `raw` is the source slice of `range`, and `loc` points at the same positions;
 * - children lie inside their parent and are ordered by position;
 * - the children of a `Paragraph` cover it without gaps (sentence splitters stop at an uncovered character);
 * - the `value` of a `Str` has the length of its `raw` (rules map positions inside a `Str` by index).
 */
export function assertInvariants(root: Node, text: string): void {
	testAst(root as unknown as Record<string, unknown>);
	const lineStarts = [0, ...[...text.matchAll(/\n/g)].map((match) => match.index + 1)];
	const position = (offset: number) => {
		const line = lineStarts.findLastIndex((start) => start <= offset);
		return { line: line + 1, column: offset - (lineStarts[line] ?? 0) };
	};
	const visit = (node: Node) => {
		assert.equal(node.raw, text.slice(node.range[0], node.range[1]), `raw of ${node.type}`);
		assert.deepEqual(node.loc, { start: position(node.range[0]), end: position(node.range[1]) }, `loc of ${node.type}`);
		if (node.type === "Str") {
			assert.equal(node.value?.length, node.raw.length, `value length of Str ${JSON.stringify(node.raw)}`);
		}
		let previousStart = node.range[0];
		for (const child of node.children ?? []) {
			assert.ok(node.range[0] <= child.range[0] && child.range[1] <= node.range[1], `${child.type} inside ${node.type}`);
			assert.ok(previousStart <= child.range[0], `${child.type} ordered in ${node.type}`);
			previousStart = child.range[0];
		}
		if (node.type === "Paragraph") {
			let covered = node.range[0];
			for (const child of node.children ?? []) {
				assert.equal(child.range[0], covered, `gap before ${JSON.stringify(child.raw)} in ${JSON.stringify(node.raw)}`);
				covered = child.range[1];
			}
			assert.equal(covered, node.range[1], `gap at the end of ${JSON.stringify(node.raw)}`);
		}
		for (const child of node.children ?? []) {
			visit(child);
		}
	};
	visit(root);
}

/** Lists the tree as indented `Type raw` lines, with `=value` when the value differs from raw. */
export function outline(node: Node, depth = 0): string[] {
	const value = node.value !== undefined && node.value !== node.raw ? ` =${JSON.stringify(node.value)}` : "";
	const line = `${"  ".repeat(depth)}${node.type}${node.type === "Document" ? "" : ` ${JSON.stringify(node.raw)}`}${value}`;
	return [line, ...(node.children ?? []).flatMap((child) => outline(child, depth + 1))];
}

/** Returns the nodes of `type` in document order. */
export function findAll(node: Node, type: string): Node[] {
	return [...(node.type === type ? [node] : []), ...(node.children ?? []).flatMap((child) => findAll(child, type))];
}

/** Returns `Type raw` (and `=value` when it differs) for each child of the only paragraph in `text`. */
export function inlineSummary(text: string, options: LatexPluginOptions = {}): string[] {
	const paragraphs = findAll(parse(text, options), "Paragraph");
	assert.equal(paragraphs.length, 1, `one paragraph in ${JSON.stringify(text)}`);
	return (paragraphs[0]?.children ?? []).map(describe);
}

/** Returns `Type raw` (and `=value` when it differs) for each top-level block of `text`. */
export function blockSummary(text: string, options: LatexPluginOptions = {}): string[] {
	return (parse(text, options).children ?? []).map(describe);
}

function describe(node: Node): string {
	const value = node.value !== undefined && node.value !== node.raw ? ` =${node.value}` : "";
	return `${node.type} ${node.raw}${value}`;
}

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
