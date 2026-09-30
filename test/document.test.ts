import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { blockSummary, findAll, outline, parse } from "./helpers.ts";

const fixture = (name: string) => readFileSync(new URL(`fixtures/${name}`, import.meta.url), "utf8");

describe("document", () => {
	test("covers the whole source", () => {
		const text = "\\documentclass{article}\n\\begin{document}\n本文である．\n\\end{document}\n";
		const ast = parse(text);
		assert.equal(ast.type, "Document");
		assert.deepEqual(ast.range, [0, text.length]);
	});

	test("checks only the body of the document environment", () => {
		const text = "\\documentclass{article}\n\\title{題名}\n\\begin{document}\n本文である．\n\\end{document}\n";
		assert.deepEqual(blockSummary(text), ["Paragraph 本文である．"]);
	});

	test("checks the whole file when it has no document environment", () => {
		assert.deepEqual(blockSummary("\\section{節}\n本文である．\n"), ["Header \\section{節}", "Paragraph 本文である．"]);
	});

	test("converts an empty file into an empty document", () => {
		assert.deepEqual(outline(parse("")), ["Document"]);
	});

	test("converts a file without prose into an empty document", () => {
		assert.deepEqual(outline(parse("\\newpage\n\\(x\\)\n")), ["Document", '  HtmlBlock "\\\\newpage" =""']);
	});

	test("keeps positions in a file with CRLF line breaks", () => {
		const ast = parse("一文目である．\r\n二文目である．\r\n");
		assert.deepEqual(
			findAll(ast, "Str").map((str) => [str.raw, str.loc.start.line, str.loc.start.column]),
			[
				["一文目である．", 1, 0],
				["\r\n", 1, 7],
				["二文目である．", 2, 0],
			],
		);
	});

	test("reports a syntax error with its position", () => {
		assert.throws(() => parse("本文である．\n}\n"), {
			message: /^Cannot parse the LaTeX document at line 2, column 1: /,
		});
	});

	test("converts a whole chapter", () => {
		assert.deepEqual(outline(parse(fixture("document.tex"))), [
			"Document",
			'  Header "\\\\chapter{群}"',
			'    Str "群"',
			'  Header "\\\\section{定義}"',
			'    Str "定義"',
			'  Paragraph "\\\\label{Def:group}\\n\\t集合\\\\(G\\\\)と写像\\\\(\\\\cdot \\\\colon G \\\\times G \\\\to G\\\\)の組\\\\(\\\\paren{G, \\\\cdot}\\\\)が%\\n\\t\\\\term[ぐん]{群}であるとは，以下の条件をすべて満たすことをいう："',
			'    Html "\\\\label{Def:group}" ="\"',
			'    Str "\\n\\t"',
			'    Str "集合"',
			'    Code "\\\\(G\\\\)" ="G"',
			'    Str "と写像"',
			'    Code "\\\\(\\\\cdot \\\\colon G \\\\times G \\\\to G\\\\)" ="xxGxGxG"',
			'    Str "の組"',
			'    Code "\\\\(\\\\paren{G, \\\\cdot}\\\\)" ="xGxx"',
			'    Str "が"',
			'    Html "%\\n" ="\"',
			'    Str "\\t"',
			'    Code "\\\\term[ぐん]{群}" ="term"',
			'    Str "であるとは，以下の条件をすべて満たすことをいう："',
			'  List "\\\\begin{enumerate}\\n\\t\\t\\\\item 任意の\\\\(a, b, c \\\\in G\\\\)に対し\\\\(\\\\paren{a \\\\cdot b} \\\\cdot c = a \\\\cdot \\\\paren{b \\\\cdot c}\\\\)である．\\n\\t\\t\\\\item ある\\\\(e \\\\in G\\\\)が存在し，任意の\\\\(a \\\\in G\\\\)に対し\\\\(a \\\\cdot e = e \\\\cdot a = a\\\\)である．\\n\\t\\\\end{enumerate}"',
			'    ListItem "\\\\item 任意の\\\\(a, b, c \\\\in G\\\\)に対し\\\\(\\\\paren{a \\\\cdot b} \\\\cdot c = a \\\\cdot \\\\paren{b \\\\cdot c}\\\\)である．"',
			'      Paragraph "任意の\\\\(a, b, c \\\\in G\\\\)に対し\\\\(\\\\paren{a \\\\cdot b} \\\\cdot c = a \\\\cdot \\\\paren{b \\\\cdot c}\\\\)である．"',
			'        Str "任意の"',
			'        Code "\\\\(a, b, c \\\\in G\\\\)" ="axbxcxG"',
			'        Str "に対し"',
			'        Code "\\\\(\\\\paren{a \\\\cdot b} \\\\cdot c = a \\\\cdot \\\\paren{b \\\\cdot c}\\\\)" ="xaxbxcxaxxbxc"',
			'        Str "である．"',
			'    ListItem "\\\\item ある\\\\(e \\\\in G\\\\)が存在し，任意の\\\\(a \\\\in G\\\\)に対し\\\\(a \\\\cdot e = e \\\\cdot a = a\\\\)である．"',
			'      Paragraph "ある\\\\(e \\\\in G\\\\)が存在し，任意の\\\\(a \\\\in G\\\\)に対し\\\\(a \\\\cdot e = e \\\\cdot a = a\\\\)である．"',
			'        Str "ある"',
			'        Code "\\\\(e \\\\in G\\\\)" ="exG"',
			'        Str "が存在し，任意の"',
			'        Code "\\\\(a \\\\in G\\\\)" ="axG"',
			'        Str "に対し"',
			'        Code "\\\\(a \\\\cdot e = e \\\\cdot a = a\\\\)" ="axexexaxa"',
			'        Str "である．"',
			'  Paragraph "\\\\(b, b\'\\\\)がともに\\\\(a\\\\)の逆元であるとすると，\\n\\t\\\\begin{equation*}\\n\\t\\tb = b \\\\cdot \\\\paren{a \\\\cdot b\'} = \\\\paren{b \\\\cdot a} \\\\cdot b\' = b\'\\n\\t\\\\end{equation*}\\n\\tである．\\n\\tしたがって逆元は一意である\\\\footnote{単位元の一意性も同様に示せる．}．"',
			"    Code \"\\\\(b, b'\\\\)\" =\"bxbx\"",
			'    Str "がともに"',
			'    Code "\\\\(a\\\\)" ="a"',
			'    Str "の逆元であるとすると，"',
			'    Str "\\n\\t"',
			"    Code \"\\\\begin{equation*}\\n\\t\\tb = b \\\\cdot \\\\paren{a \\\\cdot b'} = \\\\paren{b \\\\cdot a} \\\\cdot b' = b'\\n\\t\\\\end{equation*}\" =\"x\"",
			'    Str "\\n\\t"',
			'    Str "である．"',
			'    Str "\\n\\t"',
			'    Str "したがって逆元は一意である"',
			'    Html "\\\\footnote{単位元の一意性も同様に示せる．}" ="\"',
			'    Str "．"',
			'  Paragraph "単位元の一意性も同様に示せる．"',
			'    Str "単位元の一意性も同様に示せる．"',
			'  HtmlBlock "\\\\includegraphics{group.pdf}" =""',
			'  Header "\\\\caption{群の例}"',
			'    Str "群の例"',
			'  CodeBlock "\\\\begin{verbatim}\\nx = 1\\n\\\\end{verbatim}" ="\\nx = 1\\n"',
		]);
	});
});
