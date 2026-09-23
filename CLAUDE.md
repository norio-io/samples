# CLAUDE.md

静的なWebサイトの制作サンプル集。`main` の内容を GitHub Pages で公開する。

リポジトリの読み手に向けた説明は `README.md` にある。本書は、このリポジトリで作業するときの手順と制約を扱う。

## ディレクトリ

`<制作種別>/<業種の抽象名>/` の2階層とする。ブランド名は用いない。

- 第1階層は制作種別（`booking` / `lp` / `ec` / `corporate` / `store`）
- 第2階層は業種を表す抽象名（`photo-studio` / `law-office` / `dental-clinic` など）

複数ページ構成のサンプルは、第2階層の下にページごとのディレクトリを置き、`index.html` を配置する。URLに `.html` を出さないためである。スタイルは `css/style.css` にまとめる。

```
corporate/dental-clinic/
├── index.html
├── about/index.html
├── news/index.html
├── news/<日付>/index.html
└── css/style.css
```

## 制作の制約

- 外部ライブラリ、外部フォント、ビルド工程を用いない。HTML / CSS / JavaScript のみで構成する
- 図版はSVGをインラインで記述する。画像ファイルは写真が必要な場合に限り `img/` へ置く
- レスポンシブ対応とし、スマートフォン幅で横スクロールを出さない
- ページ冒頭に架空である旨の帯を表示する
- 数値、レビュー、実績、氏名、連絡先はすべて架空とする

## 検証

公開サイト `norio-io.github.io` へは作業環境から到達できない。検証は、生成したファイルをローカルのHTTPサーバで配信し、Playwright で行う。

### 幅とフォントサイズ

全ページを、幅 1755 / 1440 / 1024 / 768 / 390 px と、`body` のフォントサイズ 15px / 19px の組み合わせで確認する。

フォントサイズを変えて確認するのは、作業環境のChromiumにヒラギノ角ゴが無く、日本語が代替フォントで描画されるためである。文字幅が実機より狭くなり、既定サイズだけの確認では実機でのはみ出しを見逃す。

### はみ出しの判定

`document.documentElement.scrollWidth` の比較だけでは、カードや枠の内部で起きたはみ出しを検出できない。幅を持つ要素（カード、表、図版、リスト）のセレクタを列挙し、要素単位で2種類を判定する。

```js
for (const sel of SELECTORS) {
  document.querySelectorAll(sel).forEach(el => {
    const b = el.getBoundingClientRect()
    if (b.right > document.documentElement.clientWidth + 1) { /* 右にはみ出し */ }
    if (el.scrollWidth > el.clientWidth + 1)                 { /* 内部あふれ */ }
  })
}
```

### コントラスト

WCAG 2.1 達成基準 1.4.3 の 4.5:1 を満たすこと。`getComputedStyle` で描画色を取得し、祖先をたどって最初の不透明な背景色を求めて比を算出する。設計上の色指定ではなく、描画結果で判定する。

### リンク

全ページの `a[href]` を列挙し、それぞれへリクエストして 200 を確認する。

## CSS で繰り返し踏んだ問題

- `.foot p { margin: 0 }`（詳細度 0,1,1）は `.foot__link { margin-bottom: … }`（0,1,0）に勝つ。後から足した規則が効かないときは、まず詳細度を比較する
- `.gnav ul { margin: 0 }` は `.wrap { margin-inline: auto }` による中央寄せを打ち消す。上下のマージンだけを消す場合は `margin-block: 0` を用いる
- 表の幅を内容に依存させない場合は、`table-layout: fixed` と列幅の明示を併用する

## サンプルを追加したときに併せて更新するもの

- `index.html` の該当セクションにカードを追加し、セクション見出しの件数を更新する
- `README.md` の一覧表に行を追加する
- サンプルのディレクトリに `README.md` を置き、題材の由来、画面構成、実装したことを書く

## CI / CD

- `main` への統合が、そのまま GitHub Pages の公開になる。`main` への直接 push は Ruleset `main protection` により禁止しており、変更はプルリクエストを経由する。
- 必須ステータスチェックは、Ruleset がジョブ名で参照する。CI を追加した時点で、そのジョブ名を Ruleset の必須ステータスチェックに登録する。ジョブ名を変更する場合は Ruleset 側の更新が必須であり、一致しない場合はプルリクエストがマージ不能となる。
- 変更されたファイルに応じて起動するジョブ（`paths` 指定のあるワークフロー）は、必須ステータスチェックに追加しない。対象外のプルリクエストではジョブが起動せず、チェックが Expected のまま残ってマージ不能となるため。

### 表示検証（`display-check`）

- 「検証」節のはみ出し、コントラスト、リンクに加え、ページ読み込み時のコンソールエラーを検査する。`.github/workflows/ci.yml` の `display-check` ジョブが全プルリクエストと `main` への push で実行する。
- 検証用の道具は `scripts/` に置き、依存は `scripts/package.json` で管理する。サンプル本体はこの依存を用いない。
- 検査対象は `<制作種別>/<業種>/` 配下の `index.html` とする。一覧（リポジトリ直下）と、第1階層のみのリダイレクト（`cafe/` `corp/` `shop/`、`booking/` など）は対象外。
- ローカルでは次の1コマンドで実行する。作業環境では Playwright 同梱版の Chromium が無いため、`CHROMIUM_PATH` で既存の Chromium を指定する。`PAGES` に正規表現を渡すと対象ページを絞れる。

```sh
npm --prefix scripts ci && CHROMIUM_PATH=/opt/pw-browsers/chromium npm --prefix scripts run check
```

- 違反はページ、幅、フォントサイズ、セレクタ、計測値を出力し、終了コード 1 で終わる。画像背景上の文字など判定できないものは「注意」として出し、失敗にはしない。

## 依存関係の更新

- 本リポジトリはパッケージを持たない。Renovate は GitHub Actions のバージョン更新のみを起票する。設定は `renovate.json` に置き、`renovate-config` ジョブ（`.github/workflows/renovate-config.yml`）で検証する。
- 自動マージは有効にしない。
- Renovate が作成したプルリクエストには `by: renovate` と `type: dependency-upgrade` の2枚のラベルが付与される。

## 開発の進め方

### ブランチの命名

- 作業ブランチは `feature/` を接頭辞とし、`main` へプルリクエストを作成してマージする。
- イシューに紐づく作業は `feature/issue-<イシュー番号>` とする。
- イシューに紐づかない作業は `feature/<短い説明>` とする。

### コミットおよびタイトルの書式

`{絵文字} {prefix}: {説明}` とし、説明は日本語の終止形で記載する。コミット、プルリクエストのタイトル、イシューのタイトルのいずれも同一の書式を用いる。

| prefix | emoji | 用途 |
|---|---|---|
| feat | ✨ | 機能の追加、変更 |
| fix | 🐛 | バグ修正 |
| chore | 🛠️ | 設定、依存、ツール系 |
| refactor | ♻️ | 動作を変えないコード変更 |
| docs | 📚 | ドキュメント |
| test | ✅ | テストの追加、修正 |

- サンプルの追加は `feat`、表示崩れや不具合の修正は `fix`、`.github/` などの開発インフラの変更は `chore` とする。
- この書式を導入する前のコミットは、絵文字と prefix を持たない。遡って書き換えない。

### ラベル

ラベルは `.github/labels.json` で定義し、`.github/workflows/labels.yml` で反映する。`main` への統合時に自動で反映されるほか、Actions から手動でも実行できる。

| 接頭辞 | 用途 |
|---|---|
| `type:` | 作業の種類。イシューとプルリクエストに必ず1枚付与する |
| `status:` | 進行上の状態 |
| `theme:` | 対象領域 |
| `by:` | 作成元（自動化ツール） |

### レビュー

- レビュースレッドの解決はレビュー者が行う。実装者は解決しない。
- 指摘への対応を終えた場合は、スレッドへ返信して反映内容を伝えるにとどめる。

### その他

- 原則として 1イシュー 1プルリクエストとする。実装上の依存により単独で検証できない場合に限り、1プルリクエストで複数のイシューを解決し、本文に `Closes #N` を列挙する。
- コミットメッセージおよびプルリクエストの記述言語は日本語とする。
- コミットには `Co-Authored-By` を残す。コミットメッセージおよびプルリクエストの本文には、セッションURLなど第三者にとって意味を持たない行を含めない。
