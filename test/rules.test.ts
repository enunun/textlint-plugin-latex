import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { lint, summary } from "./helpers.ts";

describe("with preset-ja-technical-writing", () => {
	test("a sentence continued after display math has its period", async () => {
		const messages = await lint("\\(b\\)が逆元であるとすると，\n\\begin{equation*}\n\tb = b'\n\\end{equation*}\nである．\n");
		assert.deepEqual(summary(messages), []);
	});

	test("each list item is its own sentence", async () => {
		const item = "任意の\\(a, b, c \\in G\\)に対し\\(\\paren{a \\cdot b} \\cdot c = a \\cdot \\paren{b \\cdot c}\\)が成り立つことを条件とする．";
		const source = `群であるとは，次の条件を満たすことである．\n\\begin{enumerate}\n\t\\item ${item}\n\t\\item ${item}\n\\end{enumerate}\n`;
		assert.deepEqual(summary(await lint(source)), []);
	});

	test("reports an error at its position in the source", async () => {
		const messages = await lint("一文目である．\n\t\\(x\\)は二文目である。\n");
		assert.deepEqual(summary(messages), ["ja-no-mixed-period@2:14"]);
	});

	test("reads sentences across line breaks", async () => {
		const messages = await lint("Aである．\nまた，Bである．\nまた，Cである．\n");
		assert.deepEqual(summary(messages), ["no-doubled-conjunction@3:1"]);
	});

	test("a comment that joins lines does not split the sentence", async () => {
		assert.deepEqual(summary(await lint("記号は「%\n\\(x\\)」と書く．\n")), []);
	});

	test("prose in footnotes is checked", async () => {
		const messages = await lint("本文である\\footnote{脚注である。}．\n");
		assert.deepEqual(summary(messages), ["ja-no-mixed-period@1:21"]);
	});

	test("textlint-disable comments suppress errors", async () => {
		const messages = await lint("% textlint-disable\nここは文である。\n% textlint-enable\n\nここは文である。\n");
		assert.deepEqual(summary(messages), ["ja-no-mixed-period@5:8"]);
	});
});
