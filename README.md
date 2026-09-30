# @enunun/textlint-plugin-latex

LaTeXの文書を[textlint](https://textlint.org/)で校正するためのプラグイン．
数式の多い文書でも，文の区切りを読者が読むとおりに扱う．

- 別行立ての数式(`equation`，`align`，`\[...\]`など)は，前後の地の文と同じ文の一部として扱う．たとえば「〜とすると，［数式］である．」は1つの文になる．
- `itemize`，`enumerate`，`description`は箇条書きとして扱い，各項目を別の段落にする．
- 定理や証明などの環境は，中身を通常の段落として検査する．
- `\emph{...}`などの引数は文の一部として，脚注は別の段落として検査する．
- `% textlint-disable`などのコメントで，範囲を指定して検査を止められる．

LaTeXの構文解析には[latex-utensils](https://github.com/tamuratak/latex-utensils)を使う．

## インストール

npmには公開していない．GitHubのリポジトリを指定してインストールする．

``` sh
pnpm add -D textlint github:enunun/textlint-plugin-latex
```

版を固定する場合は，`github:enunun/textlint-plugin-latex#v0.1.0`のようにタグを付ける．

## 設定

`.textlintrc.yml`でプラグインを有効にする．

``` yaml
plugins:
  '@enunun/latex': true
```

オプションを指定する場合は，次のように書く．

``` yaml
plugins:
  '@enunun/latex':
    textCommands:
      - term
    opaqueEnvironments:
      - prooftree
```

## LaTeXの要素の扱い

| LaTeXの要素 | textlintでの扱い |
| --- | --- |
| 地の文 | 段落の中の文字列．空行で段落を分ける． |
| `\chapter`，`\section`などの見出し | 見出し．見出しの文字列を検査する． |
| `\(...\)`，`$...$` | 文中のコード．値は数式の見た目の長さに近い文字列で，英数字以外の記号や命令を`x`に置き換える． |
| 別行立ての数式 | 前後の地の文と同じ段落の中のコード．値は`x`の1文字． |
| `itemize`，`enumerate`，`description` | 箇条書き．`\item`ごとに項目を分ける． |
| `verbatim`，`lstlisting`，`minted` | コードブロック． |
| そのほかの環境(定理，証明，図など) | 環境の区切りで段落を分け，中身を検査する． |
| `\emph`，`\textit`などの文字修飾 | 引数を強調として文の中で検査する．`\textbf`は太字として扱う． |
| `\footnote` | 引数を別の段落として検査する． |
| `\caption` | 引数を見出しとして検査する(句点を求めない)． |
| `\label`，`\index`など何も出力しない命令 | 検査しない．文の区切りにもしない． |
| `\cite`，`\cref`などそのほかの命令 | 文中のコード．値は命令名(`\ref`や`\cref`では参照先のラベル)． |
| `%`コメント | 検査しない．`textlint-disable`などの指示だけをtextlintのコメントとして残す． |
| `\begin{document}`より前 | 検査しない． |

## オプション

どのオプションも，組み込みの一覧に追加される．組み込みの一覧は[src/options.ts](src/options.ts)を参照．

| オプション | 内容 | 組み込みの例 |
| --- | --- | --- |
| `extensions` | `.tex`に加えて扱う拡張子 | なし |
| `textCommands` | 引数を文の一部として検査する命令 | `emph`，`textit`，`underline` |
| `separateTextCommands` | 引数を別の段落として検査する命令 | `footnote`，`marginpar` |
| `captionCommands` | 引数を見出しとして検査する命令 | `caption` |
| `ignoreCommands` | 何も出力しない命令 | `label`，`index`，`vspace`，`bf` |
| `blockCommands` | 段落を区切る命令 | `newpage`，`input`，`includegraphics` |
| `mathEnvironments` | 別行立ての数式として扱う環境 | なし(`equation`などは構文解析器が認識する) |
| `opaqueEnvironments` | 中身を検査せず，数式と同じく文の一部とする環境 | `tabular`，`prooftree` |
| `ignoreEnvironments` | 検査もせず，文の一部にもしない環境 | `comment` |
| `listEnvironments` | 箇条書きとして扱う環境 | `itemize`，`enumerate`，`description` |
| `commentDirectives` | textlintへの指示とみなす`%`コメントの目印 | `textlint-disable` |

自分で定義した命令や環境は，内容に合わせてこれらのオプションに追加する．
たとえば，用語を太字にして索引に載せる`\term[よみ]{用語}`は`textCommands`に，
証明図を組む環境は`opaqueEnvironments`に追加する．

## ルールの設定について

- 箇条書きの前の段落は，「以下の条件を満たす：」のように「：」で終わることが多い．
  箇条書きは別の段落になるので，文末の句点を求めるルールはこの段落を句点の抜けとして報告する．
  preset-ja-technical-writingの`ja-no-mixed-period`を使う場合は，`allowPeriodMarks`に「：」を加えるとよい．
- 強調(`\emph`など)の中の文字列は，強調を引用として扱うルールでは検査されない．
  Markdownの`*...*`と同じ扱いである．

## 開発

開発用コンテナ(`.devcontainer/`)の中で，次のタスクを使う．

| コマンド | 内容 |
| --- | --- |
| `mise run setup` | 依存パッケージをインストールし，Gitのフックを設定する． |
| `mise run build` | `src/`を`lib/`へビルドする． |
| `mise run test` | 単体テストを実行する． |
| `mise run lint` | 型検査と，Markdownの文書の検査を行う． |
| `mise run check` | リント，単体テスト，ビルドをまとめて実行する(CIと同じ)． |

テストはNode.jsの組み込みのテストランナーで，TypeScriptのまま実行する．

``` text
src/
  index.ts            プラグインの入口．
  LatexProcessor.ts   textlintのプラグインとしての処理(拡張子と変換の呼び出し)．
  convert.ts          LaTeXの構文木からtextlintの構文木への変換．
  options.ts          オプションと，組み込みの命令・環境の一覧．
test/
  convert.test.ts     変換結果の構文木の検査．
  rules.test.ts       preset-ja-technical-writingを使った校正結果の検査．
  fixtures/           テスト用のLaTeX文書．
```

### Claude Codeで開発する場合

- `.claude/settings.json`のフックが，Bashツールの呼び出しを[rtk](https://github.com/rtk-ai/rtk)経由に書き換え，出力を絞り込む．
- `.claude/settings.json`は，[enunun/system-development-skills](https://github.com/enunun/system-development-skills)をプラグインのマーケットプレイスとして参照する．
- `.devcontainer/claude-home/`と`.devcontainer/rtk-home/`は，コンテナ作成時に自動生成され，コンテナ内の`/root/.claude`などにバインドマウントされる．
  資格情報や履歴を含むため，`.gitignore`で除外している．

## ライセンス

MIT
