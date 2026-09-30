import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { resolveOptions } from "../src/options.ts";
import { blockSummary, findAll, inlineSummary, outline, parse } from "./helpers.ts";

const r = String.raw;

describe("text", () => {
	test("text between commands is one Str per source line", () => {
		assert.deepEqual(inlineSummary("一行目の\n\t\t二行目である．"), ["Str 一行目の", "Str \n\t\t", "Str 二行目である．"]);
	});

	test("the line break and indentation between lines are a whitespace-only Str", () => {
		assert.deepEqual(inlineSummary("一行目の  \n  二行目である．"), ["Str 一行目の", "Str   \n  ", "Str 二行目である．"]);
	});

	test("CRLF line breaks are whitespace between Strs", () => {
		assert.deepEqual(inlineSummary("一行目の\r\n二行目である．"), ["Str 一行目の", "Str \r\n", "Str 二行目である．"]);
	});

	test("spaces inside a line stay in the Str", () => {
		assert.deepEqual(inlineSummary("English words here．"), ["Str English words here．"]);
	});

	test("~ is a non-breaking space inside the Str", () => {
		assert.deepEqual(inlineSummary("図~1である．"), ["Str 図~1である． =図 1である．"]);
	});

	test("whitespace between a command and text is a whitespace-only Str", () => {
		assert.deepEqual(inlineSummary(r`\cite{a} を参照する．`), [r`Code \cite{a} =cite`, "Str  ", "Str を参照する．"]);
	});
});

describe("escaped characters", () => {
	const printed: [string, string][] = [
		["%", "%"],
		["&", "&"],
		["#", "#"],
		["$", "$"],
		["_", "_"],
		["{", "{"],
		["}", "}"],
		[" ", " "],
		[",", " "],
		[";", " "],
		[":", " "],
	];
	for (const [character, value] of printed) {
		test(`\\${character} is Code whose value is ${JSON.stringify(value)}`, () => {
			assert.deepEqual(inlineSummary(`前\\${character}後である．`), ["Str 前", `Code \\${character} =${value}`, "Str 後である．"]);
		});
	}

	for (const character of ["!", "-"]) {
		test(`\\${character} prints nothing`, () => {
			assert.deepEqual(inlineSummary(`前\\${character}後である．`), ["Str 前", `Html \\${character} =`, "Str 後である．"]);
		});
	}
});

describe("groups", () => {
	test("the content of a {...} group is part of the sentence", () => {
		assert.deepEqual(inlineSummary(r`前{\bf 太字}後である．`), ["Str 前", "Html { =", r`Html \bf =`, "Str  ", "Str 太字", "Html } =", "Str 後である．"]);
	});

	test("an empty group prints nothing", () => {
		assert.deepEqual(inlineSummary(r`前{}後である．`), ["Str 前", "Html {} =", "Str 後である．"]);
	});
});

describe("text commands", () => {
	for (const name of resolveOptions().textCommands) {
		test(`\\${name}{...} is Emphasis whose children are checked`, () => {
			const emphasis = findAll(parse(`前\\${name}{強調}後である．`), "Emphasis");
			assert.deepEqual(emphasis.map((node) => outline(node)), [[`Emphasis ${JSON.stringify(`\\${name}{強調}`)}`, '  Str "強調"']]);
		});
	}

	test("\\textbf{...} is Strong", () => {
		assert.deepEqual(outline(findAll(parse(r`前\textbf{太字}後である．`), "Strong")[0]!), ['Strong "\\\\textbf{太字}"', '  Str "太字"']);
	});

	test("the checked argument is the last {...}; optional arguments are not checked", () => {
		const emphasis = findAll(parse(r`\term[よみ]{用語}である．`, { textCommands: ["term"] }), "Emphasis")[0];
		assert.deepEqual(emphasis?.children?.map((child) => child.raw), ["用語"]);
	});

	test("the textCommands option adds a command", () => {
		assert.deepEqual(inlineSummary(r`\term{用語}である．`, { textCommands: ["term"] }), [r`Emphasis \term{用語}`, "Str である．"]);
	});

	test("a text command without a {...} argument is Code", () => {
		assert.deepEqual(inlineSummary(r`前\emph 後である．`), ["Str 前", r`Code \emph =emph`, "Str  ", "Str 後である．"]);
	});

	test("text commands nest", () => {
		const emphasis = findAll(parse(r`\emph{外\textbf{内}}である．`), "Emphasis")[0];
		assert.deepEqual(outline(emphasis!), ['Emphasis "\\\\emph{外\\\\textbf{内}}"', '  Str "外"', '  Strong "\\\\textbf{内}"', '    Str "内"']);
	});
});

describe("ignored commands", () => {
	for (const name of resolveOptions().ignoreCommands) {
		test(`\\${name} prints nothing`, () => {
			const text = /^[A-Za-z]+$/.test(name) ? `前\\${name}{x}後である．` : `前\\${name}後である．`;
			const html = findAll(parse(text), "Html");
			assert.equal(html.length, 1);
			assert.equal(html[0]?.value, "");
			assert.ok(html[0]?.raw.startsWith(`\\${name}`));
		});
	}

	test("\\label prints nothing", () => {
		assert.deepEqual(inlineSummary(r`本文である．\label{a}`), ["Str 本文である．", r`Html \label{a} =`]);
	});

	test("a starred ignored command prints nothing", () => {
		assert.deepEqual(inlineSummary(r`前\vspace*{1em}後である．`), ["Str 前", r`Html \vspace*{1em} =`, "Str 後である．"]);
	});

	test("the ignoreCommands option adds a command", () => {
		assert.deepEqual(inlineSummary(r`前\foo{x}後である．`, { ignoreCommands: ["foo"] }), ["Str 前", r`Html \foo{x} =`, "Str 後である．"]);
	});
});

describe("references and other commands", () => {
	for (const name of ["ref", "eqref", "autoref", "cref"]) {
		test(`\\${name}{...} is Code whose value is the label`, () => {
			assert.deepEqual(inlineSummary(`\\${name}{Def:a}を見よ．`), [`Code \\${name}{Def:a} =Def:a`, "Str を見よ．"]);
		});
	}

	test("\\url{...} is Code whose value is the URL", () => {
		assert.deepEqual(inlineSummary(r`\url{https://example.com}を見よ．`), [r`Code \url{https://example.com} =https://example.com`, "Str を見よ．"]);
	});

	test("\\href{...}{...} is a Link whose text is checked", () => {
		const link = findAll(parse(r`\href{https://example.com}{説明}を見よ．`), "Link")[0];
		assert.equal(link?.url, "https://example.com");
		assert.deepEqual(link?.children?.map((child) => child.raw), ["説明"]);
	});

	test("\\verb is Code whose value is its content", () => {
		assert.deepEqual(inlineSummary(r`\verb|x = 1|と書く．`), [r`Code \verb|x = 1| =x = 1`, "Str と書く．"]);
	});

	test("\\\\ is a Break", () => {
		assert.deepEqual(inlineSummary(r`一行目\\二行目である．`), ["Str 一行目", r`Break \\`, "Str 二行目である．"]);
	});

	test("an unknown command is Code whose value is its name", () => {
		assert.deepEqual(inlineSummary(r`\LaTeX{}と\cite[p.~3]{book}と\S 1である．`), [
			r`Code \LaTeX{} =LaTeX`,
			"Str と",
			r`Code \cite[p.~3]{book} =cite`,
			"Str と",
			r`Code \S =S`,
			"Str  ",
			"Str 1である．",
		]);
	});

	test("a starred unknown command is Code whose value is its base name", () => {
		assert.deepEqual(inlineSummary(r`\foo*である．`), [r`Code \foo* =foo`, "Str である．"]);
	});

	test("^ and _ outside math print nothing", () => {
		assert.deepEqual(inlineSummary("x^2である．"), ["Str x", "Html ^ =", "Str 2である．"]);
		assert.deepEqual(inlineSummary("x_2である．"), ["Str x", "Html _ =", "Str 2である．"]);
	});
});

describe("footnotes and other separate text", () => {
	for (const name of resolveOptions().separateTextCommands) {
		test(`\\${name}{...} is checked as a separate paragraph`, () => {
			assert.deepEqual(blockSummary(`本文である\\${name}{別の文である．}．`), [
				`Paragraph 本文である\\${name}{別の文である．}．`,
				"Paragraph 別の文である．",
			]);
		});
	}

	test("the footnote leaves no mark in the sentence", () => {
		assert.deepEqual(inlineSummary(r`本文である\footnote{a}．`.replace("a", "")), ["Str 本文である", r`Html \footnote{} =`, "Str ．"]);
	});

	test("a footnote with several paragraphs becomes several paragraphs", () => {
		assert.deepEqual(blockSummary("本文である\\footnote{一つ目である．\n\n二つ目である．}．"), [
			"Paragraph 本文である\\footnote{一つ目である．\n\n二つ目である．}．",
			"Paragraph 一つ目である．",
			"Paragraph 二つ目である．",
		]);
	});

	test("a footnote inside a footnote comes after the outer footnote", () => {
		assert.deepEqual(blockSummary(r`本文である\footnote{外である\footnote{内である．}．}．`), [
			r`Paragraph 本文である\footnote{外である\footnote{内である．}．}．`,
			r`Paragraph 外である\footnote{内である．}．`,
			"Paragraph 内である．",
		]);
	});

	test("a footnote in a list item stays in the item", () => {
		const item = findAll(parse(r`\begin{itemize}\item 項目である\footnote{注である．}．\end{itemize}`), "ListItem")[0];
		assert.deepEqual(item?.children?.map((child) => child.raw), [r`項目である\footnote{注である．}．`, "注である．"]);
	});

	test("the separateTextCommands option adds a command", () => {
		assert.deepEqual(blockSummary(r`本文である\sidenote{注である．}．`, { separateTextCommands: ["sidenote"] }), [
			r`Paragraph 本文である\sidenote{注である．}．`,
			"Paragraph 注である．",
		]);
	});
});

describe("captions", () => {
	for (const name of resolveOptions().captionCommands) {
		test(`\\${name}{...} is a header of depth 6`, () => {
			const header = findAll(parse(`\\begin{figure}\\${name}{図の説明}\\end{figure}`), "Header")[0];
			assert.deepEqual([header?.raw, header?.depth, header?.children?.map((child) => child.raw)], [`\\${name}{図の説明}`, 6, ["図の説明"]]);
		});
	}

	test("a caption in running text comes after the paragraph", () => {
		assert.deepEqual(blockSummary(r`表を示す\caption{表の説明}．`), [
			r`Paragraph 表を示す\caption{表の説明}．`,
			r`Header \caption{表の説明}`,
		]);
	});

	test("the captionCommands option adds a command", () => {
		assert.deepEqual(blockSummary(r`\begin{figure}\figcaption{説明}\end{figure}`, { captionCommands: ["figcaption"] }), [
			r`Header \figcaption{説明}`,
		]);
	});
});
