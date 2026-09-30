# @enunun/textlint-plugin-latex

A textlint plugin that converts LaTeX documents into textlint's AST (TxtAST), built on latex-utensils. It is designed for math-heavy Japanese writing: display math stays inside the surrounding sentence, lists become List/ListItem/Paragraph, and theorem-like environments are transparent. Written in TypeScript (ESM); `lib/` is the build output.

# RTK (Rust Token Killer)

Prefix every shell command with `rtk`, including each command in an `&&` chain — it is always safe (a dedicated filter cuts noisy output for tests, builds, git, and more; anything without one passes through unchanged). The full command reference is in the global `~/.claude/RTK.md` (already loaded, if set up). Meta commands: `rtk gain` (savings so far), `rtk discover` (missed opportunities in past sessions), `rtk proxy <cmd>` (run unfiltered, for debugging).

## Working conventions

- `git commit` runs the lefthook hooks. If they fail, fix the reported issues. Do not use `--no-verify`.

- Run `mise run check` after making changes.
- Quality is assured by unit tests. Every behavior described in README.md ("LaTeXの要素の扱い" and "オプション") has a test, and every entry of the built-in lists in `src/options.ts` is tested by a table-driven test. When you add or change a behavior, update README.md and add or change the test in the same commit.
- `pnpm test` (`mise run test`) fails unless line, branch, and function coverage of `src/` are all 100%. Do not lower the thresholds or add coverage-ignore comments; test the branch, or remove it if it is unreachable.
- Tests run on Node's built-in test runner with native TypeScript support (`node --test`). Import local modules with the `.ts` extension; `tsc` rewrites them to `.js` in `lib/`.
- Parse LaTeX in tests through `parse()` in `test/helpers.ts`. It also asserts the AST invariants: `raw` equals the source slice of `range` and `loc` matches it, children lie inside their parent in order, the children of a `Paragraph` cover it without gaps (sentence-splitter stops at the first uncovered character), and a `Str` keeps `value` the same length as `raw` (rules map positions inside a `Str` by index).
- When changing how an element is converted, also check the effect on real rules in `test/rules.test.ts`, not only the AST shape.

## Code map

- `src/index.ts`: plugin entry point (`{ Processor }`).
- `src/LatexProcessor.ts`: textlint plugin processor (extensions, preProcess/postProcess).
- `src/convert.ts`: LaTeX AST (latex-utensils) → TxtAST conversion.
- `src/options.ts`: plugin options and the built-in lists of commands and environments.
- `test/helpers.ts`: `parse()` with the invariant checks, summaries for assertions, and `lint()` running preset-ja-technical-writing through `@textlint/kernel`.
- `test/*.test.ts`: one file per area of the specification (processor, options, document, blocks, inlines, math, comments, rules). `test/fixtures/`: LaTeX inputs.
- `.github/workflows/ci.yml`: runs `mise run check` on pull requests and on manual dispatch.

# Artifact Cleanup

## Golden Rule

**Whenever you produce an artifact, always run the `system-development-skills:finalize-artifacts` skill to clean it up before reporting the work as done.**

An artifact is any deliverable you create or substantially rewrite: documents, READMEs, code and code comments, config files, scripts, commit messages, PR descriptions, and so on.

- Invoke the skill via the Skill tool (`system-development-skills:finalize-artifacts`) after the artifact is written and before the final reply.
- The skill edits the artifact files in place. Do not append a changelog of the cleanup to the artifact; in the final reply, mention what changed in a sentence or two at most unless the user asks for a full report.
- Skip it only for replies that produce no artifact (answering questions, explaining code, running read-only commands).
- Provided by the `enunun/system-development-skills` plugin (see `extraKnownMarketplaces`/`enabledPlugins` in `.claude/settings.json`).
