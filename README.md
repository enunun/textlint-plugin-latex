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
| 地の文 | 段落の中の文字列．空行か`\par`で段落を分ける． |
| 行の途中の改行と字下げ | 空白だけの文字列．前後の行は別の文字列になる． |
| `~` | 空白として扱う． |
| `\chapter`，`\section`などの見出し | 見出し．見出しの文字列を検査する． |
| `\(...\)`，`$...$` | 文中のコード．値は数式の見た目の長さに近い文字列． |
| 別行立ての数式 | 前後の地の文と同じ段落の中のコード．値は`x`の1文字． |
| `itemize`，`enumerate`，`description` | 箇条書き．`\item`ごとに項目を分ける． |
| `\item[...]`のラベル | 検査しない． |
| 最初の`\item`より前の文字列 | 検査しない． |
| `verbatim`，`lstlisting`，`minted` | コードブロック． |
| `comment`環境 | 検査しない．文の区切りにもしない． |
| そのほかの環境(定理，証明，図など) | 環境の区切りで段落を分け，中身を検査する． |
| `{...}` | 中身を文の一部として検査する． |
| `\emph`，`\textit`などの文字修飾 | 引数を強調として文の中で検査する． |
| `\textbf` | 引数を太字として文の中で検査する． |
| `\href{URL}{文字列}` | リンク．文字列を検査する． |
| `\footnote` | 引数を別の段落として検査する． |
| `\caption` | 引数を見出しとして検査する(句点を求めない)． |
| `\label`，`\index`など何も出力しない命令 | 検査しない．文の区切りにもしない． |
| `\\` | 改行． |
| `\%`，`\&`などのエスケープ | 文中のコード．値はその文字． |
| `\url`，`\verb` | 文中のコード．値は中身． |
| `\ref`，`\cref`など | 文中のコード．値は参照先のラベル． |
| `\cite`などそのほかの命令 | 文中のコード．値は命令名． |
| `%`コメント | 検査しない．文の区切りにもしない． |
| `% textlint-disable`などの指示 | textlintのコメントとして残す． |
| `\begin{document}`より前と`\end{document}`より後 | 検査しない． |

行内の数式の値は，英字と数字をそのまま残し，ほかの記号や命令を1文字の`x`に置き換えた文字列である．
たとえば`\(a, b \in G\)`の値は`axbxG`になる．

`%`コメントによる指示は，段落の途中にあれば段落の中に，数式の中や段落の末尾にあれば段落の直後に置く．
textlintは指示の位置だけを使うので，どちらの場合も指示の後ろから検査を止める．

構文解析できない文書(対応しない`}`があるなど)では，その位置を示すエラーを出す．
改行コードはLFとCRLFのどちらでもよい．

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
| `mathEnvironments` | 別行立ての数式として扱う環境 | `alignat` |
| `opaqueEnvironments` | 中身を検査せず，数式と同じく文の一部とする環境 | `tabular`，`prooftree` |
| `ignoreEnvironments` | 検査もせず，文の一部にもしない環境 | なし |
| `listEnvironments` | 箇条書きとして扱う環境 | `itemize`，`enumerate`，`description` |
| `commentDirectives` | textlintへの指示とみなす`%`コメントの目印 | `textlint-disable` |

`equation`，`align`，`gather`，`multline`，`flalign`と，それらの`*`付きの環境は，構文解析器が数式として認識する．
`comment`環境は，構文解析器がつねに読み飛ばす．
`*`付きの命令や環境は，`*`を除いた名前で一覧と照合する．

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
| `mise run test` | 単体テストを実行し，網羅率を検査する． |
| `mise run lint` | 型検査と，Markdownの文書の検査を行う． |
| `mise run check` | リント，単体テスト，ビルドをまとめて実行する(CIと同じ)． |

### テスト

仕様は単体テストで保証する．
「LaTeXの要素の扱い」と「オプション」に書いた仕様は，それぞれ対応するテストがある．
組み込みの一覧(命令や環境)は，一覧のすべての項目をテストする．

- テストはNode.jsの組み込みのテストランナーで，TypeScriptのまま実行する．
- `mise run test`は`src/`の行，分岐，関数の網羅率を計測し，どれかが100%未満なら失敗する．
- 変換結果を得るテストは，構文木の性質もあわせて検査する．たとえば，位置情報は元の文書と一致し，段落の子要素はすきまなく段落を覆う．

``` text
src/
  index.ts            プラグインの入口．
  LatexProcessor.ts   textlintのプラグインとしての処理(拡張子と変換の呼び出し)．
  convert.ts          LaTeXの構文木からtextlintの構文木への変換．
  options.ts          オプションと，組み込みの命令・環境の一覧．
test/
  helpers.ts          変換と構文木の性質の検査，校正の実行などの補助関数．
  processor.test.ts   プラグインの入口と処理．
  options.test.ts     オプションの既定値と追加．
  document.test.ts    文書全体(本文の範囲，改行コード，構文エラー)．
  blocks.test.ts      見出し，段落，段落を区切る命令，環境，箇条書き，コードブロック．
  inlines.test.ts     文字列，エスケープ，文字修飾，何も出力しない命令，参照，脚注，キャプション．
  math.test.ts        数式と，数式と同じく扱う環境，読み飛ばす環境．
  comments.test.ts    %コメントとtextlintへの指示．
  rules.test.ts       preset-ja-technical-writingを使った校正結果．
  fixtures/           テスト用のLaTeX文書．
```

### Claude Codeで開発する場合

- `.claude/settings.json`のフックが，Bashツールの呼び出しを[rtk](https://github.com/rtk-ai/rtk)経由に書き換え，出力を絞り込む．
- `.claude/settings.json`は，[enunun/system-development-skills](https://github.com/enunun/system-development-skills)をプラグインのマーケットプレイスとして参照する．
- `.devcontainer/claude-home/`と`.devcontainer/rtk-home/`は，コンテナ作成時に自動生成され，コンテナ内の`/root/.claude`などにバインドマウントされる．
  資格情報や履歴を含むため，`.gitignore`で除外している．

## ライセンス

MIT
