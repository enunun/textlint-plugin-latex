/**
 * Options of the plugin, given in the textlint configuration:
 *
 * ```json
 * { "plugins": { "@enunun/latex": { "textCommands": ["term"] } } }
 * ```
 *
 * Every list is added to the built-in defaults; it does not replace them.
 */
export interface LatexPluginOptions {
	/** File extensions handled in addition to `.tex`. */
	extensions?: string[];
	/**
	 * Commands whose last `{...}` argument is prose that belongs to the surrounding sentence,
	 * such as `\emph{...}`. The argument is checked; the command itself is not.
	 */
	textCommands?: string[];
	/** Commands whose last `{...}` argument is prose that forms its own paragraphs, such as `\footnote{...}`. */
	separateTextCommands?: string[];
	/** Commands whose last `{...}` argument is a title without a final period, such as `\caption{...}`. */
	captionCommands?: string[];
	/** Commands that print nothing, such as `\label` and `\index`. They are skipped. */
	ignoreCommands?: string[];
	/** Commands that stand between paragraphs, such as `\newpage` and `\input`. */
	blockCommands?: string[];
	/**
	 * Environments treated as display math: they become part of the surrounding sentence.
	 * Environments recognized by the parser (`equation`, `align`, `\[...\]`, ...) need not be listed.
	 */
	mathEnvironments?: string[];
	/** Environments whose body is not prose, such as `tabular`. They are treated like display math. */
	opaqueEnvironments?: string[];
	/**
	 * Environments that are skipped entirely: neither checked nor part of the sentence around them.
	 * The `comment` environment is always skipped.
	 */
	ignoreEnvironments?: string[];
	/** Environments whose body is split into items by `\item`. */
	listEnvironments?: string[];
	/** Words that mark a `%` comment as a directive for textlint, kept in the AST as a `Comment`. */
	commentDirectives?: string[];
}

export interface ResolvedOptions {
	extensions: string[];
	textCommands: Set<string>;
	strongCommands: Set<string>;
	separateTextCommands: Set<string>;
	captionCommands: Set<string>;
	ignoreCommands: Set<string>;
	blockCommands: Set<string>;
	headerCommands: Map<string, number>;
	mathEnvironments: Set<string>;
	opaqueEnvironments: Set<string>;
	ignoreEnvironments: Set<string>;
	listEnvironments: Set<string>;
	commentDirectives: string[];
}

const headerDepths: Record<string, number> = {
	part: 1,
	chapter: 1,
	section: 2,
	subsection: 3,
	subsubsection: 4,
	paragraph: 5,
	subparagraph: 6,
};

const defaults = {
	textCommands: [
		"emph",
		"textit",
		"textsl",
		"textsc",
		"textrm",
		"textsf",
		"textup",
		"textmd",
		"textnormal",
		"underline",
		"mbox",
		"text",
	],
	strongCommands: ["textbf"],
	separateTextCommands: ["footnote", "footnotetext", "marginpar"],
	captionCommands: ["caption", "subcaption"],
	ignoreCommands: [
		// cross-references and indexes that print nothing
		"label",
		"index",
		"glossary",
		"nocite",
		"hypertarget",
		"phantomsection",
		"addcontentsline",
		// spacing and layout
		"noindent",
		"indent",
		"centering",
		"raggedright",
		"raggedleft",
		"vspace",
		"hspace",
		"vfill",
		"hfill",
		"smallskip",
		"medskip",
		"bigskip",
		"nopagebreak",
		"leavevmode",
		"relax",
		"protect",
		"null",
		"strut",
		"@",
		"/",
		// font declarations such as {\bf ...}
		"bf",
		"it",
		"em",
		"rm",
		"sf",
		"tt",
		"sc",
		"sl",
		"bfseries",
		"itshape",
		"mdseries",
		"normalfont",
		"rmfamily",
		"sffamily",
		"ttfamily",
		"upshape",
		"scshape",
		"slshape",
		"tiny",
		"scriptsize",
		"footnotesize",
		"small",
		"normalsize",
		"large",
		"Large",
		"LARGE",
		"huge",
		"Huge",
	],
	blockCommands: [
		"item",
		"maketitle",
		"tableofcontents",
		"listoffigures",
		"listoftables",
		"newpage",
		"clearpage",
		"cleardoublepage",
		"pagebreak",
		"input",
		"include",
		"appendix",
		"frontmatter",
		"mainmatter",
		"backmatter",
		"bibliography",
		"bibliographystyle",
		"printbibliography",
		"printindex",
		"includegraphics",
	],
	// the parser recognizes equation, align, gather, multline, and flalign, but not alignat
	mathEnvironments: ["alignat"],
	opaqueEnvironments: [
		"tabular",
		"tabularx",
		"array",
		"picture",
		"tikzpicture",
		"tikzcd",
		"CD",
		"thebibliography",
		"prooftree",
		"forest",
		"algorithmic",
	],
	ignoreEnvironments: [],
	listEnvironments: ["itemize", "enumerate", "description"],
	commentDirectives: ["textlint-disable", "textlint-enable"],
} satisfies Record<string, string[]>;

/** Merges user options into the defaults. Starred variants (`\section*`) share their base name. */
export function resolveOptions(options: LatexPluginOptions = {}): ResolvedOptions {
	const merge = (base: string[], extra: string[] | undefined) => new Set([...base, ...(extra ?? [])]);
	return {
		extensions: options.extensions ?? [],
		textCommands: merge(defaults.textCommands, options.textCommands),
		strongCommands: new Set(defaults.strongCommands),
		separateTextCommands: merge(defaults.separateTextCommands, options.separateTextCommands),
		captionCommands: merge(defaults.captionCommands, options.captionCommands),
		ignoreCommands: merge(defaults.ignoreCommands, options.ignoreCommands),
		blockCommands: merge(defaults.blockCommands, options.blockCommands),
		headerCommands: new Map(Object.entries(headerDepths)),
		mathEnvironments: merge(defaults.mathEnvironments, options.mathEnvironments),
		opaqueEnvironments: merge(defaults.opaqueEnvironments, options.opaqueEnvironments),
		ignoreEnvironments: merge(defaults.ignoreEnvironments, options.ignoreEnvironments),
		listEnvironments: merge(defaults.listEnvironments, options.listEnvironments),
		commentDirectives: [...defaults.commentDirectives, ...(options.commentDirectives ?? [])],
	};
}
