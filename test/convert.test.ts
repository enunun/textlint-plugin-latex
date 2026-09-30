import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test as testAst } from "@textlint/ast-tester";
import type { TxtNode, TxtParentNode } from "@textlint/ast-node-types";
import { parse } from "./helpers.ts";

const documentSource = readFileSync(new URL("fixtures/document.tex", import.meta.url), "utf8");

/** Lists nodes as `type:raw` in document order, for compact assertions. */
function outline(node: TxtNode, depth = 0): string[] {
	const line = `${"  ".repeat(depth)}${node.type}${node.type === "Document" ? "" : ` ${JSON.stringify(node.raw)}`}`;
	const children = "children" in node ? (node as TxtParentNode).children.flatMap((child) => outline(child, depth + 1)) : [];
	return [line, ...children];
}

function findAll(node: TxtNode, type: string): TxtNode[] {
	const found = node.type === type ? [node] : [];
	const children = "children" in node ? (node as TxtParentNode).children : [];
	return [...found, ...children.flatMap((child) => findAll(child, type))];
}

describe("AST", () => {
	test("is a valid TxtAST", () => {
		testAst(parse(documentSource) as unknown as Record<string, unknown>);
	});

	test("keeps raw, range, and loc consistent with the source", () => {
		const ast = parse(documentSource);
		const lines = documentSource.split("\n");
		for (const node of findAll(ast, "Str")) {
			assert.equal(documentSource.slice(node.range[0], node.range[1]), node.raw);
			const line = `${lines[node.loc.start.line - 1] ?? ""}\n`;
			assert.equal(line.slice(node.loc.start.column, node.loc.start.column + 1), node.raw.slice(0, 1));
		}
	});

	test("children of a paragraph cover it without gaps", () => {
		const ast = parse(documentSource);
		for (const paragraph of findAll(ast, "Paragraph") as TxtParentNode[]) {
			let position = paragraph.range[0];
			for (const child of paragraph.children) {
				assert.equal(child.range[0], position, `gap before ${JSON.stringify(child.raw)}`);
				position = child.range[1];
			}
			assert.equal(position, paragraph.range[1]);
		}
	});

	test("skips the preamble", () => {
		const ast = parse(documentSource);
		assert.ok(ast.range[0] === 0 && ast.range[1] === documentSource.length);
		assert.ok(!ast.children.some((child) => child.raw.includes("usepackage")));
	});
});

describe("blocks", () => {
	test("sectioning commands become headers", () => {
		const headers = findAll(parse("\\chapter{群}\n\\section*{定義}\n\\subsection{例}\n"), "Header");
		assert.deepEqual(
			headers.map((header) => [header.raw, (header as TxtNode & { depth: number }).depth]),
			[
				["\\chapter{群}", 1],
				["\\section*{定義}", 2],
				["\\subsection{例}", 3],
			],
		);
	});

	test("a blank line separates paragraphs", () => {
		const paragraphs = findAll(parse("一つ目である．\n続きである．\n\n二つ目である．\n"), "Paragraph");
		assert.deepEqual(
			paragraphs.map((paragraph) => paragraph.raw),
			["一つ目である．\n続きである．", "二つ目である．"],
		);
	});

	test("theorem-like environments are transparent", () => {
		const ast = parse("\\begin{Thm}[名前]\\label{Thm:a}\n\t定理である．\n\\end{Thm}\n");
		assert.deepEqual(outline(ast), [
			"Document",
			'  Paragraph "\\\\label{Thm:a}\\n\\t定理である．"',
			'    Html "\\\\label{Thm:a}"',
			'    Str "\\n\\t"',
			'    Str "定理である．"',
		]);
	});

	test("list environments become lists with one paragraph per item", () => {
		const ast = parse("以下を満たす：\n\\begin{itemize}\n\t\\item 一つ目である．\n\t\\item 二つ目である．\n\\end{itemize}\n");
		assert.deepEqual(outline(ast), [
			"Document",
			'  Paragraph "以下を満たす："',
			'    Str "以下を満たす："',
			'  List "\\\\begin{itemize}\\n\\t\\\\item 一つ目である．\\n\\t\\\\item 二つ目である．\\n\\\\end{itemize}"',
			'    ListItem "\\\\item 一つ目である．"',
			'      Paragraph "一つ目である．"',
			'        Str "一つ目である．"',
			'    ListItem "\\\\item 二つ目である．"',
			'      Paragraph "二つ目である．"',
			'        Str "二つ目である．"',
		]);
	});

	test("verbatim becomes a code block", () => {
		const blocks = findAll(parse(documentSource), "CodeBlock");
		assert.equal(blocks.length, 1);
		assert.equal((blocks[0] as TxtNode & { value: string }).value, "\nx = 1\n");
	});

	test("captions become headers and figures do not merge into paragraphs", () => {
		const ast = parse("図を示す．\n\\begin{figure}\n\t\\centering\n\t\\caption{群の例}\n\\end{figure}\n");
		assert.deepEqual(
			ast.children.map((child) => `${child.type} ${child.raw}`),
			["Paragraph 図を示す．", "Header \\caption{群の例}"],
		);
	});
});

describe("inlines", () => {
	test("display math stays inside the sentence", () => {
		const ast = parse("とすると，\n\\begin{equation*}\n\ta = b\n\\end{equation*}\nである．\n");
		assert.equal(ast.children.length, 1);
		assert.deepEqual(
			(ast.children[0] as TxtParentNode).children.map((child) => child.type),
			["Str", "Str", "Code", "Str", "Str"],
		);
	});

	test("inline math is code whose value approximates the printed formula", () => {
		const codes = findAll(parse("\\(a, b \\in G\\)と$x^2$である．\n"), "Code") as (TxtNode & { value: string })[];
		assert.deepEqual(
			codes.map((code) => code.value),
			["axbxG", "x2"],
		);
	});

	test("text commands are checked as part of the sentence", () => {
		const ast = parse("これは\\emph{重要}で\\textbf{太字}の\\term[よみ]{用語}である．\n", { textCommands: ["term"] });
		const paragraph = ast.children[0] as TxtParentNode;
		assert.deepEqual(
			paragraph.children.map((child) => child.type),
			["Str", "Emphasis", "Str", "Strong", "Str", "Emphasis", "Str"],
		);
		assert.equal((paragraph.children[5] as TxtParentNode).children[0]?.raw, "用語");
	});

	test("unknown commands become code", () => {
		const codes = findAll(parse("\\cite{book}と\\Cref{Def:a}を参照する．\n"), "Code");
		assert.deepEqual(
			codes.map((code) => code.raw),
			["\\cite{book}", "\\Cref{Def:a}"],
		);
	});

	test("footnotes become separate paragraphs", () => {
		const ast = parse("本文である\\footnote{脚注である．}．\n");
		assert.deepEqual(
			ast.children.map((child) => `${child.type} ${child.raw}`),
			["Paragraph 本文である\\footnote{脚注である．}．", "Paragraph 脚注である．"],
		);
	});

	test("escaped characters and non-breaking spaces", () => {
		const paragraph = parse("100\\%の図~1である．\n").children[0] as TxtParentNode;
		assert.deepEqual(
			paragraph.children.map((child) => `${child.type} ${(child as TxtNode & { value: string }).value}`),
			["Str 100", "Code %", "Str の図 1である．"],
		);
	});

	test("a line break inside a paragraph is a whitespace-only Str", () => {
		const strs = findAll(parse("定義する：\n\tまず，\n"), "Str");
		assert.deepEqual(
			strs.map((str) => str.raw),
			["定義する：", "\n\t", "まず，"],
		);
	});
});

describe("comments", () => {
	test("a comment that joins lines is invisible", () => {
		const ast = parse("記号は「%\n\\(x\\)」と書く．\n");
		const paragraph = ast.children[0] as TxtParentNode;
		assert.deepEqual(
			paragraph.children.map((child) => `${child.type} ${child.raw}`),
			["Str 記号は「", "Html %\n", "Code \\(x\\)", "Str 」と書く．"],
		);
	});

	test("directive comments become Comment nodes", () => {
		const ast = parse("% textlint-disable\n本文である．\n% textlint-enable\n\n段落である．\n");
		const comments = findAll(ast, "Comment") as (TxtNode & { value: string })[];
		assert.deepEqual(
			comments.map((comment) => comment.value),
			[" textlint-disable", " textlint-enable"],
		);
	});
});
