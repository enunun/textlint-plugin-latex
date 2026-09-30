import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { resolveOptions } from "../src/options.ts";
import { blockSummary, findAll, inlineSummary, parse } from "./helpers.ts";

const r = String.raw;

/** Returns the value of the only Code node in `math` placed in a sentence. */
const codeValue = (math: string) => {
	const codes = findAll(parse(`${math}である．`), "Code");
	assert.equal(codes.length, 1);
	return codes[0]?.value;
};

describe("inline math", () => {
	test("\\(...\\) is Code inside the sentence", () => {
		assert.deepEqual(inlineSummary(r`群\(G\)の元である．`), ["Str 群", r`Code \(G\) =G`, "Str の元である．"]);
	});

	test("$...$ is Code inside the sentence", () => {
		assert.deepEqual(inlineSummary("群$G$の元である．"), ["Str 群", "Code $G$ =G", "Str の元である．"]);
	});

	test("letters and digits are kept in the value", () => {
		assert.equal(codeValue(r`\(ab12\)`), "ab12");
	});

	test("every other symbol counts as one x, and spaces count as nothing", () => {
		assert.equal(codeValue(r`\(a + b, c\)`), "axbxc");
	});

	test("every command counts as one x, and its arguments are counted", () => {
		assert.equal(codeValue(r`\(\cdot \frac{a}{b}\)`), "xxab");
	});

	test("superscripts and subscripts count their contents", () => {
		assert.equal(codeValue(r`\(x^{2}_i\)`), "x2i");
	});

	test("\\left and \\right delimiters count as one x each", () => {
		assert.equal(codeValue(r`\(\left( a \right)\)`), "xax");
	});

	test("\\bigl and \\bigr delimiters count as one x each", () => {
		assert.equal(codeValue(r`\(\bigl( a \bigr)\)`), "xax");
	});

	test("text inside math counts as a command with its letters and digits", () => {
		assert.equal(codeValue(r`\(\text{if a, b}\)`), "xifaxb");
	});

	test("empty math counts as one x", () => {
		assert.equal(codeValue(r`\(\)`), "x");
	});
});

describe("display math", () => {
	test("\\[...\\] stays inside the sentence as Code whose value is x", () => {
		assert.deepEqual(inlineSummary("とすると，\n\\[a = b\\]\nである．"), [
			"Str とすると，",
			"Str \n",
			r`Code \[a = b\] =x`,
			"Str \n",
			"Str である．",
		]);
	});

	test("$$...$$ stays inside the sentence", () => {
		assert.deepEqual(inlineSummary("とすると$$a$$である．"), ["Str とすると", "Code $$a$$ =x", "Str である．"]);
	});

	const environments = [
		"equation",
		"equation*",
		"align",
		"align*",
		"alignat",
		"alignat*",
		"gather",
		"gather*",
		"multline",
		"multline*",
		"flalign",
		"flalign*",
	];
	for (const name of environments) {
		test(`${name} stays inside the sentence`, () => {
			// alignat takes the number of columns as its argument
			const argument = name.startsWith("alignat") ? "{1}" : "";
			const math = `\\begin{${name}}${argument}a = b\\end{${name}}`;
			assert.deepEqual(inlineSummary(`とすると${math}である．`), ["Str とすると", `Code ${math} =x`, "Str である．"]);
		});
	}

	test("the mathEnvironments option adds an environment", () => {
		const math = r`\begin{dmath}a = b\end{dmath}`;
		assert.deepEqual(inlineSummary(`とすると${math}である．`, { mathEnvironments: ["dmath"] }), [
			"Str とすると",
			`Code ${math} =x`,
			"Str である．",
		]);
	});

	test("an environment not listed is not math", () => {
		assert.deepEqual(blockSummary(r`とすると\begin{dmath}a\end{dmath}である．`), ["Paragraph とすると", "Paragraph a", "Paragraph である．"]);
	});
});

describe("opaque environments", () => {
	for (const name of resolveOptions().opaqueEnvironments) {
		test(`${name} is not checked and stays inside the sentence`, () => {
			const body = `\\begin{${name}}中身である．\\end{${name}}`;
			assert.deepEqual(inlineSummary(`次の${body}を見よ．`), ["Str 次の", `Code ${body} =x`, "Str を見よ．"]);
		});
	}

	test("a starred opaque environment is opaque too", () => {
		const body = r`\begin{tabular*}{5cm}{c}中身\end{tabular*}`;
		assert.deepEqual(inlineSummary(`次の${body}を見よ．`), ["Str 次の", `Code ${body} =x`, "Str を見よ．"]);
	});

	test("the opaqueEnvironments option adds an environment", () => {
		const body = r`\begin{diagram}中身\end{diagram}`;
		assert.deepEqual(inlineSummary(`次の${body}を見よ．`, { opaqueEnvironments: ["diagram"] }), ["Str 次の", `Code ${body} =x`, "Str を見よ．"]);
	});
});

describe("ignored environments", () => {
	test("the comment environment is skipped", () => {
		const body = r`\begin{comment}下書きである．\end{comment}`;
		assert.deepEqual(inlineSummary(`本文${body}である．`), ["Str 本文", `Html ${body} =`, "Str である．"]);
	});

	test("the ignoreEnvironments option adds an environment", () => {
		const body = r`\begin{draft}下書きである．\end{draft}`;
		assert.deepEqual(inlineSummary(`本文${body}である．`, { ignoreEnvironments: ["draft"] }), ["Str 本文", `Html ${body} =`, "Str である．"]);
	});
});
