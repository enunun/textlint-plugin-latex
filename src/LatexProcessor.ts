import type {
	TextlintMessage,
	TextlintPluginOptions,
	TextlintPluginPostProcessResult,
	TextlintPluginPreProcessResult,
	TextlintPluginProcessor,
} from "@textlint/types";
import { convert } from "./convert.ts";
import { type LatexPluginOptions, type ResolvedOptions, resolveOptions } from "./options.ts";

export class LatexProcessor implements TextlintPluginProcessor {
	config: TextlintPluginOptions;
	private readonly options: ResolvedOptions;

	constructor(config: LatexPluginOptions = {}) {
		this.config = config as TextlintPluginOptions;
		this.options = resolveOptions(config);
	}

	availableExtensions(): string[] {
		return [".tex", ...this.options.extensions];
	}

	processor(_extension: string) {
		const options = this.options;
		return {
			preProcess(text: string, _filePath?: string): TextlintPluginPreProcessResult {
				return convert(text, options);
			},
			postProcess(messages: TextlintMessage[], filePath?: string): TextlintPluginPostProcessResult {
				return { messages, filePath: filePath ?? "<latex>" };
			},
		};
	}
}
