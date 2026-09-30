import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { resolveOptions } from "../src/options.ts";

describe("resolveOptions", () => {
	test("has no extra extensions by default", () => {
		assert.deepEqual(resolveOptions().extensions, []);
	});

	test("maps sectioning commands to header depths", () => {
		assert.deepEqual(Object.fromEntries(resolveOptions().headerCommands), {
			part: 1,
			chapter: 1,
			section: 2,
			subsection: 3,
			subsubsection: 4,
			paragraph: 5,
			subparagraph: 6,
		});
	});

	test("treats \\textbf as strong", () => {
		assert.deepEqual([...resolveOptions().strongCommands], ["textbf"]);
	});

	test("recognizes textlint-disable and textlint-enable as directives", () => {
		assert.deepEqual(resolveOptions().commentDirectives, ["textlint-disable", "textlint-enable"]);
	});

	const lists = [
		"textCommands",
		"separateTextCommands",
		"captionCommands",
		"ignoreCommands",
		"blockCommands",
		"mathEnvironments",
		"opaqueEnvironments",
		"ignoreEnvironments",
		"listEnvironments",
	] as const;

	for (const key of lists) {
		test(`adds ${key} to the defaults instead of replacing them`, () => {
			const defaults = resolveOptions()[key];
			const merged = resolveOptions({ [key]: ["custom"] })[key];
			assert.deepEqual([...merged], [...defaults, "custom"]);
		});
	}

	test("adds commentDirectives to the defaults", () => {
		assert.deepEqual(resolveOptions({ commentDirectives: ["lint-off"] }).commentDirectives, [
			"textlint-disable",
			"textlint-enable",
			"lint-off",
		]);
	});

	test("uses the given extensions", () => {
		assert.deepEqual(resolveOptions({ extensions: [".ltx"] }).extensions, [".ltx"]);
	});
});
