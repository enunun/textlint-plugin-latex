import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { blockSummary, findAll, inlineSummary, outline, parse } from "./helpers.ts";

const r = String.raw;

describe("ordinary comments", () => {
	test("a comment that joins lines prints nothing, including its line break", () => {
		assert.deepEqual(inlineSummary("記号は「%\n\\(x\\)」と書く．"), ["Str 記号は「", "Html %\n =", r`Code \(x\) =x`, "Str 」と書く．"]);
	});

	test("a comment inside text ends the Str before it", () => {
		assert.deepEqual(inlineSummary("前の文% 注記\n後の文である．"), ["Str 前の文", "Html % 注記\n =", "Str 後の文である．"]);
	});

	test("the indentation after a comment is whitespace", () => {
		assert.deepEqual(inlineSummary("前の文%\n\t後の文である．"), ["Str 前の文", "Html %\n =", "Str \t", "Str 後の文である．"]);
	});

	test("a comment line does not separate paragraphs", () => {
		assert.deepEqual(blockSummary("前の文である．\n% 注記\n後の文である．\n"), ["Paragraph 前の文である．\n% 注記\n後の文である．"]);
	});

	test("a comment between paragraphs is left out", () => {
		assert.deepEqual(outline(parse("前の段落である．\n\n% 注記\n\n後の段落である．\n")), [
			"Document",
			'  Paragraph "前の段落である．"',
			'    Str "前の段落である．"',
			'  Paragraph "後の段落である．"',
			'    Str "後の段落である．"',
		]);
	});
});

describe("directive comments", () => {
	test("a directive between paragraphs is a Comment between them", () => {
		assert.deepEqual(blockSummary("前である．\n\n% textlint-disable\n\n後である．\n% textlint-enable\n"), [
			"Paragraph 前である．",
			"Comment % textlint-disable = textlint-disable",
			"Paragraph 後である．",
			"Comment % textlint-enable = textlint-enable",
		]);
	});

	test("a directive after the last text of a paragraph comes right after the paragraph", () => {
		assert.deepEqual(blockSummary("本文である．% textlint-disable\n"), ["Paragraph 本文である．", "Comment % textlint-disable = textlint-disable"]);
	});

	test("a directive inside a paragraph is a Comment inside it", () => {
		assert.deepEqual(inlineSummary("前である．\n% textlint-disable\n後である．"), [
			"Str 前である．",
			"Str \n",
			"Comment % textlint-disable = textlint-disable",
			"Str \n",
			"Str 後である．",
		]);
	});

	test("the Comment does not include the line break, with LF or CRLF", () => {
		for (const lineBreak of ["\n", "\r\n"]) {
			const comment = findAll(parse(`% textlint-disable${lineBreak}本文である．${lineBreak}`), "Comment")[0];
			assert.deepEqual([comment?.raw, comment?.value], ["% textlint-disable", " textlint-disable"]);
		}
	});

	test("a directive at the end of the file is a Comment", () => {
		assert.deepEqual(blockSummary("本文である．\n\n% textlint-enable"), ["Paragraph 本文である．", "Comment % textlint-enable = textlint-enable"]);
	});

	test("a directive inside math comes right after the paragraph", () => {
		const text = "とすると，\n\\begin{equation}\n\ta % textlint-disable\n\\end{equation}\nである．\n";
		assert.deepEqual(blockSummary(text), [
			"Paragraph とすると，\n\\begin{equation}\n\ta % textlint-disable\n\\end{equation}\nである．",
			"Comment % textlint-disable = textlint-disable",
		]);
	});

	test("a directive inside a list item is a Comment in the item", () => {
		const item = findAll(parse("\\begin{itemize}\n\\item 項目である．\n\n% textlint-disable\n\\end{itemize}\n"), "ListItem")[0];
		assert.deepEqual(item?.children?.map((child) => child.type), ["Paragraph", "Comment"]);
	});

	test("a directive between words of a header title is a Comment in the header", () => {
		const header = findAll(parse("\\section{前% textlint-disable\n後}\n"), "Header")[0];
		assert.deepEqual(header?.children?.map((child) => child.type), ["Str", "Comment", "Str", "Str"]);
	});

	test("a directive in the preamble is left out", () => {
		const text = "\\documentclass{article}\n% textlint-disable\n\\begin{document}\n本文である．\n\\end{document}\n";
		assert.deepEqual(findAll(parse(text), "Comment"), []);
	});

	test("a directive after the document environment is left out", () => {
		const text = "\\begin{document}\n本文である．\n\\end{document}\n% textlint-disable\n";
		assert.deepEqual(findAll(parse(text), "Comment"), []);
	});

	test("a directive in a file without a document environment is kept wherever it is", () => {
		assert.deepEqual(blockSummary("% textlint-disable\n\\section{節}\n"), [
			"Comment % textlint-disable = textlint-disable",
			r`Header \section{節}`,
		]);
	});

	test("the commentDirectives option adds a directive", () => {
		assert.deepEqual(blockSummary("% lint-off\n\n本文である．\n", { commentDirectives: ["lint-off"] }), [
			"Comment % lint-off = lint-off",
			"Paragraph 本文である．",
		]);
	});
});
