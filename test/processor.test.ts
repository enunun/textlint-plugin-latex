import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { TxtDocumentNode } from "@textlint/ast-node-types";
import plugin, { LatexProcessor } from "../src/index.ts";

describe("plugin entry point", () => {
	test("exports the processor as the textlint plugin", () => {
		assert.deepEqual(Object.keys(plugin), ["Processor"]);
		assert.equal(plugin.Processor, LatexProcessor);
	});
});

describe("LatexProcessor", () => {
	test("handles .tex files", () => {
		assert.deepEqual(new LatexProcessor().availableExtensions(), [".tex"]);
	});

	test("handles the extensions given in options as well", () => {
		assert.deepEqual(new LatexProcessor({ extensions: [".ltx", ".sty"] }).availableExtensions(), [".tex", ".ltx", ".sty"]);
	});

	test("keeps the options as its config", () => {
		const options = { textCommands: ["term"] };
		assert.equal(new LatexProcessor(options).config, options);
	});

	test("preProcess converts the text into a Document", () => {
		const ast = new LatexProcessor().processor(".tex").preProcess("本文である．\n") as TxtDocumentNode;
		assert.equal(ast.type, "Document");
	});

	test("preProcess applies the options", () => {
		const { preProcess } = new LatexProcessor({ ignoreCommands: ["foo"] }).processor(".tex");
		const ast = preProcess("\\foo 本文である．\n") as TxtDocumentNode;
		const paragraph = ast.children[0];
		assert.equal(paragraph && "children" in paragraph ? paragraph.children[0]?.type : undefined, "Html");
	});

	test("postProcess passes the messages and the file path through", () => {
		const { postProcess } = new LatexProcessor().processor(".tex");
		assert.deepEqual(postProcess([], "a.tex"), { messages: [], filePath: "a.tex" });
	});

	test("postProcess names the file <latex> when no path is given", () => {
		const { postProcess } = new LatexProcessor().processor(".tex");
		assert.deepEqual(postProcess([]), { messages: [], filePath: "<latex>" });
	});
});
