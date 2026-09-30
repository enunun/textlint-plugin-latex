import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { resolveOptions } from "../src/options.ts";
import { blockSummary, findAll, outline, parse } from "./helpers.ts";

const r = String.raw;

describe("headers", () => {
	const depths: [string, number][] = [
		["part", 1],
		["chapter", 1],
		["section", 2],
		["subsection", 3],
		["subsubsection", 4],
		["paragraph", 5],
		["subparagraph", 6],
	];
	for (const [name, depth] of depths) {
		test(`\\${name} becomes a header of depth ${depth}`, () => {
			const headers = findAll(parse(`\\${name}{見出し}\n`), "Header");
			assert.deepEqual(
				headers.map((header) => [header.raw, header.depth, header.children?.map((child) => child.raw)]),
				[[`\\${name}{見出し}`, depth, ["見出し"]]],
			);
		});
	}

	test("a starred sectioning command is a header too", () => {
		assert.deepEqual(blockSummary(r`\section*{記法}`), [r`Header \section*{記法}`]);
	});

	test("the title is the last {...} argument; the short title is not checked", () => {
		const header = findAll(parse(r`\section[短い題]{長い題名}`), "Header")[0];
		assert.deepEqual(header?.children?.map((child) => child.raw), ["長い題名"]);
	});

	test("the title is checked like a sentence", () => {
		const header = findAll(parse(r`\section{群\(G\)の\emph{定義}}`), "Header")[0];
		assert.deepEqual(header?.children?.map((child) => child.type), ["Str", "Code", "Str", "Emphasis"]);
	});

	test("a sectioning command without a title is an empty header", () => {
		assert.deepEqual(outline(parse(r`\section`)), ["Document", '  Header "\\\\section"']);
	});

	test("a header ends the paragraph before it", () => {
		assert.deepEqual(blockSummary("前の段落である．\n\\section{節}\n後の段落である．\n"), [
			"Paragraph 前の段落である．",
			r`Header \section{節}`,
			"Paragraph 後の段落である．",
		]);
	});
});

describe("paragraphs", () => {
	test("lines without a blank line between them form one paragraph", () => {
		assert.deepEqual(blockSummary("一行目である．\n二行目である．\n"), ["Paragraph 一行目である．\n二行目である．"]);
	});

	test("a blank line separates paragraphs", () => {
		assert.deepEqual(blockSummary("一つ目である．\n\n\n二つ目である．\n"), ["Paragraph 一つ目である．", "Paragraph 二つ目である．"]);
	});

	test("a paragraph spans from its first to its last inline node", () => {
		assert.deepEqual(blockSummary("  \\label{a}本文である．\\index{b}  \n"), [r`Paragraph \label{a}本文である．\index{b}`]);
	});

	test("a paragraph without prose is dropped", () => {
		assert.deepEqual(blockSummary("\\(x\\) \\label{a}\n\n本文である．\n"), ["Paragraph 本文である．"]);
	});

	test("prose inside a text command keeps the paragraph", () => {
		assert.deepEqual(blockSummary(r`\emph{強調}`), [r`Paragraph \emph{強調}`]);
	});

	test("a paragraph of whitespace only is dropped", () => {
		assert.deepEqual(blockSummary("~\n\n本文である．\n"), ["Paragraph 本文である．"]);
	});
});

describe("block commands", () => {
	test("\\par separates paragraphs like a blank line", () => {
		assert.deepEqual(blockSummary(r`前である．\par 後である．`), ["Paragraph 前である．", "Paragraph 後である．"]);
	});

	for (const name of resolveOptions().blockCommands) {
		test(`\\${name} separates paragraphs`, () => {
			assert.deepEqual(blockSummary(`前である．\\${name}{x}後である．`), [
				"Paragraph 前である．",
				`HtmlBlock \\${name}{x} =`,
				"Paragraph 後である．",
			]);
		});
	}

	test("the blockCommands option adds a command", () => {
		assert.deepEqual(blockSummary(r`前である．\separator 後である．`, { blockCommands: ["separator"] }), [
			"Paragraph 前である．",
			r`HtmlBlock \separator =`,
			"Paragraph 後である．",
		]);
	});

	test("a starred block command is a block command too", () => {
		assert.deepEqual(blockSummary(r`前である．\newpage*後である．`), [
			"Paragraph 前である．",
			r`HtmlBlock \newpage* =`,
			"Paragraph 後である．",
		]);
	});
});

describe("environments", () => {
	test("the body of an unknown environment is checked as blocks", () => {
		assert.deepEqual(outline(parse("\\begin{Thm}[名前]\\label{Thm:a}\n\t定理である．\n\n\t続きである．\n\\end{Thm}\n")), [
			"Document",
			'  Paragraph "\\\\label{Thm:a}\\n\\t定理である．"',
			'    Html "\\\\label{Thm:a}" =""',
			'    Str "\\n\\t"',
			'    Str "定理である．"',
			'  Paragraph "続きである．"',
			'    Str "続きである．"',
		]);
	});

	test("an environment ends the paragraph before it and starts a new one after it", () => {
		assert.deepEqual(blockSummary("前である．\\begin{proof}証明である．\\end{proof}後である．"), [
			"Paragraph 前である．",
			"Paragraph 証明である．",
			"Paragraph 後である．",
		]);
	});

	test("environments nest", () => {
		assert.deepEqual(blockSummary(r`\begin{figure}\begin{center}中央である．\end{center}\end{figure}`), ["Paragraph 中央である．"]);
	});

	test("a starred environment is handled like its base name", () => {
		assert.deepEqual(blockSummary(r`\begin{itemize*}\item 項目である．\end{itemize*}`), [
			r`List \begin{itemize*}\item 項目である．\end{itemize*}`,
		]);
	});
});

describe("lists", () => {
	test("each \\item becomes a list item holding its blocks", () => {
		assert.deepEqual(outline(parse("\\begin{itemize}\n\t\\item 一つ目である．\n\n\t続きである．\n\t\\item 二つ目である．\n\\end{itemize}\n")), [
			"Document",
			'  List "\\\\begin{itemize}\\n\\t\\\\item 一つ目である．\\n\\n\\t続きである．\\n\\t\\\\item 二つ目である．\\n\\\\end{itemize}"',
			'    ListItem "\\\\item 一つ目である．\\n\\n\\t続きである．"',
			'      Paragraph "一つ目である．"',
			'        Str "一つ目である．"',
			'      Paragraph "続きである．"',
			'        Str "続きである．"',
			'    ListItem "\\\\item 二つ目である．"',
			'      Paragraph "二つ目である．"',
			'        Str "二つ目である．"',
		]);
	});

	for (const name of resolveOptions().listEnvironments) {
		test(`${name} is a list`, () => {
			assert.equal(findAll(parse(`\\begin{${name}}\\item 項目である．\\end{${name}}`), "ListItem").length, 1);
		});
	}

	test("enumerate is ordered; itemize and description are not", () => {
		const ordered = (name: string) => findAll(parse(`\\begin{${name}}\\item a\\end{${name}}`), "List")[0]?.ordered;
		assert.deepEqual(["enumerate", "itemize", "description"].map(ordered), [true, false, false]);
	});

	test("the label of \\item[...] is not checked", () => {
		const item = findAll(parse(r`\begin{description}\item[用語] 説明である．\end{description}`), "ListItem")[0];
		assert.deepEqual(outline(item!), ['ListItem "\\\\item[用語] 説明である．"', '  Paragraph "説明である．"', '    Str "説明である．"']);
	});

	test("text before the first \\item is not checked", () => {
		assert.deepEqual(findAll(parse(r`\begin{itemize}前置き\item 項目である．\end{itemize}`), "Str").map((str) => str.raw), ["項目である．"]);
	});

	test("an item without content spans the \\item command", () => {
		assert.deepEqual(outline(parse(r`\begin{itemize}\item\end{itemize}`)), [
			"Document",
			'  List "\\\\begin{itemize}\\\\item\\\\end{itemize}"',
			'    ListItem "\\\\item"',
		]);
	});

	test("a list without items is an empty list", () => {
		assert.deepEqual(outline(parse(r`\begin{itemize}\end{itemize}`)), ["Document", '  List "\\\\begin{itemize}\\\\end{itemize}"']);
	});

	test("lists nest", () => {
		const text = r`\begin{itemize}\item 外である．\begin{enumerate}\item 内である．\end{enumerate}\end{itemize}`;
		assert.deepEqual(
			findAll(parse(text), "ListItem").map((item) => item.raw),
			[r`\item 外である．\begin{enumerate}\item 内である．\end{enumerate}`, r`\item 内である．`],
		);
	});

	test("a list ends the paragraph before it", () => {
		assert.deepEqual(blockSummary(r`以下を満たす：\begin{itemize}\item a\end{itemize}`), [
			"Paragraph 以下を満たす：",
			r`List \begin{itemize}\item a\end{itemize}`,
		]);
	});

	test("the listEnvironments option adds a list environment", () => {
		assert.deepEqual(blockSummary(r`\begin{steps}\item 手順である．\end{steps}`, { listEnvironments: ["steps"] }), [
			r`List \begin{steps}\item 手順である．\end{steps}`,
		]);
	});

	test("\\item outside a list separates paragraphs", () => {
		assert.deepEqual(blockSummary(r`前である．\item 後である．`), ["Paragraph 前である．", r`HtmlBlock \item =`, "Paragraph 後である．"]);
	});
});

describe("code blocks", () => {
	const cases: [string, string][] = [
		["\\begin{verbatim}\nx = 1\n\\end{verbatim}", "\nx = 1\n"],
		["\\begin{verbatim*}\nx = 1\n\\end{verbatim*}", "\nx = 1\n"],
		["\\begin{lstlisting}[language=C]\nint x;\n\\end{lstlisting}", "\nint x;\n"],
		["\\begin{minted}{python}\nx = 1\n\\end{minted}", "\nx = 1\n"],
	];
	for (const [text, value] of cases) {
		test(`${text.slice(0, text.indexOf("}") + 1)} becomes a code block`, () => {
			assert.deepEqual(outline(parse(text)), ["Document", `  CodeBlock ${JSON.stringify(text)} =${JSON.stringify(value)}`]);
		});
	}

	test("a code block ends the paragraph before it", () => {
		assert.deepEqual(blockSummary("次のとおりである．\n\\begin{verbatim}\nx\n\\end{verbatim}\n"), [
			"Paragraph 次のとおりである．",
			"CodeBlock \\begin{verbatim}\nx\n\\end{verbatim} =\nx\n",
		]);
	});
});
