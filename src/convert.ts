import latexUtensils from "latex-utensils";
import type { latexParser as LatexParser } from "latex-utensils";
import type { TxtDocumentNode } from "@textlint/ast-node-types";
import type { ResolvedOptions } from "./options.ts";

const { latexParser } = latexUtensils;

type LNode = LatexParser.Node;
type LComment = LatexParser.Comment;

/** A TxtAST node under construction. The finished tree is returned as `TxtDocumentNode`. */
interface AstNode {
	type: string;
	range: [number, number];
	loc: { start: { line: number; column: number }; end: { line: number; column: number } };
	raw: string;
	value?: string;
	children?: AstNode[];
	[key: string]: unknown;
}

/** Nodes whose raw text is plain prose and may be merged into one `Str`. */
type RunPiece = LatexParser.TextString | LatexParser.Space | LatexParser.Softbreak | LatexParser.ActiveCharacter;

/** One-character commands that print a character, such as `\%`. */
const escapedCharacters: Record<string, string> = {
	"%": "%",
	"&": "&",
	"#": "#",
	$: "$",
	_: "_",
	"{": "{",
	"}": "}",
	" ": " ",
	",": " ",
	";": " ",
	":": " ",
	"!": "",
	"-": "",
};

/**
 * Converts a LaTeX document into textlint's AST (TxtAST).
 *
 * The mapping keeps what prose rules need:
 * - Text between commands becomes `Str`, and blank lines separate `Paragraph`s.
 * - Inline and display math become `Code` inside the surrounding paragraph,
 *   so a sentence that continues after a displayed formula stays one sentence.
 * - `itemize`/`enumerate`/`description` become `List` > `ListItem` > `Paragraph`.
 * - Other environments (theorems, proofs, figures, ...) are transparent containers:
 *   their bodies become blocks of the enclosing level.
 * - Arguments of text commands (`\emph{...}`) are checked as part of the sentence;
 *   footnotes are checked as separate paragraphs.
 * - Captions become `Header`s, since they are titles rather than sentences.
 * - `% textlint-disable` and other directive comments become `Comment` nodes.
 */
export function convert(text: string, options: ResolvedOptions): TxtDocumentNode {
	return new Converter(text, options).convert();
}

class Converter {
	private readonly text: string;
	private readonly options: ResolvedOptions;
	private readonly lineStarts: number[];
	private comments: LComment[] = [];
	/** Comments already placed inside paragraphs. The others are inserted between blocks at the end. */
	private readonly placedComments = new Set<LComment>();
	/** Blocks of footnotes and captions found in the paragraph being built; emitted right after it. */
	private separateBlocks: AstNode[] = [];

	constructor(text: string, options: ResolvedOptions) {
		this.text = text;
		this.options = options;
		this.lineStarts = [0];
		for (let i = 0; i < text.length; i++) {
			if (text[i] === "\n") {
				this.lineStarts.push(i + 1);
			}
		}
	}

	convert(): TxtDocumentNode {
		const ast = latexParser.parse(this.text, { enableComment: true });
		this.comments = ast.comment ?? [];
		const documentEnv = ast.content.find(
			(node): node is LatexParser.Environment => node.kind === "env" && node.name === "document",
		);
		const children = this.blocks(documentEnv ? documentEnv.content : ast.content);
		const root: AstNode = { ...this.node("Document", 0, this.text.length), children };
		for (const comment of this.comments) {
			if (!this.placedComments.has(comment) && (!documentEnv || this.contains(documentEnv, comment)) && this.isDirective(comment)) {
				insertByRange(root, this.commentNode(comment));
			}
		}
		return root as unknown as TxtDocumentNode;
	}

	// ---------------------------------------------------------------- blocks

	/** Converts a sequence of nodes at block level: paragraphs separated by blank lines and block elements. */
	private blocks(nodes: LNode[]): AstNode[] {
		const out: AstNode[] = [];
		let segment: LNode[] = [];
		const flush = () => {
			const saved = this.separateBlocks;
			this.separateBlocks = [];
			out.push(...this.paragraph(this.inlines(segment)), ...this.separateBlocks);
			this.separateBlocks = saved;
			segment = [];
		};
		for (const node of nodes) {
			const block = this.block(node);
			if (block === undefined) {
				segment.push(node);
				continue;
			}
			flush();
			out.push(...block);
		}
		flush();
		return out;
	}

	/** Returns the blocks for `node`, or `undefined` if `node` is inline content. */
	private block(node: LNode): AstNode[] | undefined {
		switch (node.kind) {
			case "parbreak":
				return [];
			case "env.verbatim":
			case "env.minted":
			case "env.lstlisting":
				return [{ ...this.located("CodeBlock", node), value: node.content }];
			case "command": {
				const name = baseName(node.name);
				const depth = this.options.headerCommands.get(name);
				if (depth !== undefined) {
					const title = lastGroup(node);
					return [{ ...this.located("Header", node), depth, children: title ? this.inlines(title.content) : [] }];
				}
				if (this.options.blockCommands.has(name)) {
					return [{ ...this.located("HtmlBlock", node), value: "" }];
				}
				return undefined;
			}
			case "env": {
				const name = baseName(node.name);
				if (name === "document") {
					return this.blocks(node.content);
				}
				if (this.options.listEnvironments.has(name)) {
					return [this.list(node)];
				}
				if (
					this.options.mathEnvironments.has(name) ||
					this.options.opaqueEnvironments.has(name) ||
					this.options.ignoreEnvironments.has(name)
				) {
					return undefined;
				}
				return this.blocks(node.content);
			}
			default:
				return undefined;
		}
	}

	private list(env: LatexParser.Environment): AstNode {
		const items: AstNode[] = [];
		let current: { item: LatexParser.Command; content: LNode[] } | undefined;
		const close = () => {
			if (!current) {
				return;
			}
			const end = lastEnd(current.content) ?? current.item.location.end.offset;
			const children = this.blocks(current.content);
			items.push({ ...this.node("ListItem", current.item.location.start.offset, end), children });
		};
		for (const node of env.content) {
			if (node.kind === "command" && node.name === "item") {
				close();
				current = { item: node, content: [] };
			} else if (current) {
				current.content.push(node);
			}
		}
		close();
		return { ...this.located("List", env), ordered: env.name === "enumerate", children: items };
	}

	/** Wraps inline nodes into a paragraph, unless they contain no prose at all. */
	private paragraph(inlines: AstNode[]): AstNode[] {
		const first = inlines[0];
		const last = inlines.at(-1);
		if (!first || !last || !inlines.some(hasProse)) {
			return [];
		}
		return [{ ...this.node("Paragraph", first.range[0], last.range[1]), children: inlines }];
	}

	// ---------------------------------------------------------------- inlines

	/** Converts a sequence of nodes inside a paragraph. Adjacent text is merged into one `Str`. */
	private inlines(nodes: LNode[]): AstNode[] {
		const out: AstNode[] = [];
		let run: { start: number; end: number } | undefined;
		const closeRun = () => {
			if (run) {
				out.push(...this.strs(run.start, run.end));
				run = undefined;
			}
		};
		for (const node of nodes) {
			if (isRunPiece(node)) {
				if (!node.location) {
					// spaces and line breaks carry no location; they are covered by the run around them
					continue;
				}
				const start = node.location.start.offset;
				const end = node.location.end.offset;
				if (run && !this.hasCommentBetween(run.end, start)) {
					run.end = end;
				} else {
					closeRun();
					run = { start, end };
				}
				continue;
			}
			closeRun();
			out.push(...this.inline(node));
		}
		closeRun();
		return this.fillGaps(out);
	}

	/**
	 * Fills the source between adjacent nodes, so that the nodes cover their paragraph without gaps.
	 * Sentence splitters read a paragraph character by character and stop at a character no node covers.
	 * Whitespace becomes a whitespace-only `Str`; comments and other skipped source become invisible nodes.
	 */
	private fillGaps(nodes: AstNode[]): AstNode[] {
		const out: AstNode[] = [];
		for (const node of nodes) {
			const previous = out.at(-1);
			if (previous && previous.range[1] < node.range[0]) {
				out.push(...this.gap(previous.range[1], node.range[0]));
			}
			out.push(node);
		}
		return out;
	}

	private gap(start: number, end: number): AstNode[] {
		const out: AstNode[] = [];
		let position = start;
		const skipped = (to: number) => {
			if (position < to) {
				const node = this.node("Str", position, to);
				out.push(node.raw.trim() === "" ? { ...node, value: node.raw } : { ...node, type: "Html", value: "" });
			}
		};
		for (const comment of this.comments) {
			const commentStart = comment.location.start.offset;
			if (commentStart < start || end <= commentStart) {
				continue;
			}
			skipped(commentStart);
			this.placedComments.add(comment);
			if (this.isDirective(comment)) {
				const node = this.commentNode(comment);
				out.push(node);
				position = node.range[1];
			} else {
				// a comment and its line break print nothing
				position = Math.min(comment.location.end.offset, end);
				out.push({ ...this.node("Html", commentStart, position), value: "" });
			}
		}
		skipped(end);
		return out;
	}

	/**
	 * Returns one `Str` per source line of the text between `start` and `end`.
	 * The line breaks and indentation between them are filled by `fillGaps` with whitespace-only `Str`s,
	 * so a rule that matches within one `Str` does not take a line break for a space in the text.
	 */
	private strs(start: number, end: number): AstNode[] {
		const out: AstNode[] = [];
		const pattern = /[ \t]*\n[ \t]*/g;
		const raw = this.text.slice(start, end);
		let lineStart = 0;
		for (const match of raw.matchAll(pattern)) {
			if (match.index > lineStart) {
				out.push(this.str(start + lineStart, start + match.index));
			}
			lineStart = match.index + match[0].length;
		}
		if (raw.length > lineStart) {
			out.push(this.str(start + lineStart, end));
		}
		return out;
	}

	private str(start: number, end: number): AstNode {
		const node = this.node("Str", start, end);
		// `~` is a non-breaking space
		return { ...node, value: node.raw.replaceAll("~", " ") };
	}

	private inline(node: LNode): AstNode[] {
		switch (node.kind) {
			case "inlineMath":
				return [{ ...this.located("Code", node), value: mathValue(node) }];
			case "displayMath":
			case "env.math.align":
			case "env.math.aligned":
				return [this.displayed(node)];
			case "env": {
				const name = baseName(node.name);
				if (this.options.ignoreEnvironments.has(name)) {
					return [this.invisible(node)];
				}
				// math and opaque environments; block environments never reach here
				return [this.displayed(node)];
			}
			case "arg.group":
			case "arg.optional":
				return this.inlines(node.content);
			case "command.label":
				return node.name === "label" ? [this.invisible(node)] : [{ ...this.located("Code", node), value: node.label }];
			case "command.url":
				return [{ ...this.located("Code", node), value: node.url }];
			case "command.href":
				return [{ ...this.located("Link", node), url: node.url, children: this.inlines(node.content) }];
			case "verb":
				return [{ ...this.located("Code", node), value: node.content }];
			case "linebreak":
				return [{ ...this.located("Break", node) }];
			case "command":
				return this.command(node);
			default:
				// superscripts, alignment tabs, \def, and other non-prose tokens
				return "location" in node && node.location ? [this.invisible({ location: node.location })] : [];
		}
	}

	private command(node: LatexParser.Command): AstNode[] {
		const name = baseName(node.name);
		const escaped = escapedCharacters[node.name];
		if (escaped !== undefined) {
			// not a `Str`: rules expect the value of a `Str` to have the length of its source
			return escaped === "" ? [this.invisible(node)] : [{ ...this.located("Code", node), value: escaped }];
		}
		if (this.options.ignoreCommands.has(name)) {
			return [this.invisible(node)];
		}
		const group = lastGroup(node);
		if (group && (this.options.textCommands.has(name) || this.options.strongCommands.has(name))) {
			const type = this.options.strongCommands.has(name) ? "Strong" : "Emphasis";
			return [{ ...this.located(type, node), children: this.inlines(group.content) }];
		}
		if (group && this.options.captionCommands.has(name)) {
			this.separateBlocks.push({ ...this.located("Header", node), depth: 6, children: this.inlines(group.content) });
			return [this.invisible(node)];
		}
		if (group && this.options.separateTextCommands.has(name)) {
			this.separateBlocks.push(...this.blocks(group.content));
			return [this.invisible(node)];
		}
		return [{ ...this.located("Code", node), value: name }];
	}

	/**
	 * Display math and other displayed material become `Code` whose value is one character `x`.
	 * It is set apart from the text, so it counts as one word of the sentence around it.
	 */
	private displayed(node: { location: LatexParser.Location }): AstNode {
		return { ...this.located("Code", node), value: "x" };
	}

	// ---------------------------------------------------------------- comments

	/**
	 * Whether a comment is a directive such as `% textlint-disable`.
	 * Other comments are left out of the AST: a `%` at the end of a line only joins the lines,
	 * and a `Comment` node would split the sentence around it.
	 */
	private isDirective(comment: LComment): boolean {
		return this.options.commentDirectives.some((directive) => comment.content.includes(directive));
	}

	private hasCommentBetween(start: number, end: number): boolean {
		return this.comments.some((comment) => comment.location.start.offset >= start && comment.location.start.offset < end);
	}

	private commentNode(comment: LComment): AstNode {
		const start = comment.location.start.offset;
		// the location of a comment includes the line break after it
		const end = this.text[comment.location.end.offset - 1] === "\n" ? comment.location.end.offset - 1 : comment.location.end.offset;
		return { ...this.node("Comment", start, end), value: comment.content };
	}

	private contains(node: { location: LatexParser.Location }, comment: LComment): boolean {
		return node.location.start.offset <= comment.location.start.offset && comment.location.end.offset <= node.location.end.offset;
	}

	// ---------------------------------------------------------------- node builders

	private invisible(node: { location: LatexParser.Location }): AstNode {
		return { ...this.located("Html", node), value: "" };
	}

	private located(type: string, node: { location: LatexParser.Location }): AstNode {
		return this.node(type, node.location.start.offset, node.location.end.offset);
	}

	private node(type: string, start: number, end: number): AstNode {
		return {
			type,
			range: [start, end],
			loc: { start: this.position(start), end: this.position(end) },
			raw: this.text.slice(start, end),
		};
	}

	private position(offset: number): { line: number; column: number } {
		let low = 0;
		let high = this.lineStarts.length - 1;
		while (low < high) {
			const mid = (low + high + 1) >> 1;
			if ((this.lineStarts[mid] ?? 0) <= offset) {
				low = mid;
			} else {
				high = mid - 1;
			}
		}
		return { line: low + 1, column: offset - (this.lineStarts[low] ?? 0) };
	}
}

function isRunPiece(node: LNode): node is RunPiece {
	return node.kind === "text.string" || node.kind === "space" || node.kind === "softbreak" || node.kind === "activeCharacter";
}

function baseName(name: string): string {
	return name.endsWith("*") ? name.slice(0, -1) : name;
}

function lastGroup(node: { args: (LatexParser.OptionalArg | LatexParser.Group)[] }): LatexParser.Group | undefined {
	return node.args.findLast((arg): arg is LatexParser.Group => arg.kind === "arg.group");
}

function lastEnd(nodes: LNode[]): number | undefined {
	for (let i = nodes.length - 1; i >= 0; i--) {
		const location = nodes[i]?.location;
		if (location) {
			return location.end.offset;
		}
	}
	return undefined;
}

/** Whether a converted inline node shows prose to the reader. */
function hasProse(node: AstNode): boolean {
	if (node.type === "Str") {
		return typeof node.value === "string" && node.value.trim() !== "";
	}
	return node.children?.some(hasProse) ?? false;
}

/**
 * Inline math becomes `Code` whose value approximates the printed formula: letters and digits are kept,
 * and every other symbol or command counts as one character `x`.
 * This keeps sentence-length rules close to what the reader sees,
 * and keeps commas in formulas away from comma-counting rules.
 */
function mathValue(node: LatexParser.InlineMath): string {
	let value = "";
	const visit = (nodes: LNode[]) => {
		for (const child of nodes) {
			switch (child.kind) {
				case "math.character":
					value += /^[A-Za-z0-9]$/.test(child.content) ? child.content : child.content.trim() === "" ? "" : "x";
					break;
				case "text.string":
					value += child.content.replace(/[^A-Za-z0-9]/g, "x");
					break;
				case "command":
				case "command.text":
					value += "x";
					if ("args" in child) {
						visit(child.args);
					} else {
						visit([child.arg]);
					}
					break;
				case "superscript":
				case "subscript":
					if (child.arg) {
						visit([child.arg]);
					}
					break;
				default:
					if ("content" in child && Array.isArray(child.content)) {
						visit(child.content);
					}
			}
		}
	};
	visit(node.content);
	return value === "" ? "x" : value;
}

/** Inserts `child` into the deepest node whose range contains it, keeping children ordered by position. */
function insertByRange(parent: AstNode, child: AstNode): void {
	const start = child.range[0];
	const children = (parent.children ??= []);
	for (const node of children) {
		if (node.children && node.range[0] <= start && start < node.range[1]) {
			insertByRange(node, child);
			return;
		}
	}
	const index = children.findIndex((node) => node.range[0] > start);
	if (index === -1) {
		children.push(child);
	} else {
		children.splice(index, 0, child);
	}
}
