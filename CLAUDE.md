# CLAUDE.md

静的なWebサイトの制作サンプル集。公開先は GitHub Pages。

リポジトリの読み手に向けた説明は `README.md` にある。本書は、このリポジトリで作業するときの手順と制約を扱う。

## push の手順

**このリポジトリで git コマンドを実行しない。** 認証情報は作業者のMacのキーチェーンにあり、commit と push はMac上のプロセスが行う。合図のファイルを置くまでが作業範囲である。

1. 変更するファイルをすべて書き終える
2. リポジトリの親ディレクトリの `.commitmsg` にコミットメッセージを書く
3. 同じ階層に `.pushnow` を置く。これが合図となる
4. `.pushlog` を読み、結果を確認する

ファイルを書いただけでは commit されない。3 を省略しないこと。

## コミットメッセージ

`{絵文字} {prefix}: {説明}` の書式とする。説明は日本語の終止形で書く。`norio-io/samples-react` と同一の書式である。

| prefix | emoji | 用途 |
|---|---|---|
| feat | ✨ | 機能の追加、変更 |
| fix | 🐛 | バグ修正 |
| chore | 🛠️ | 設定、依存、ツール系 |
| refactor | ♻️ | 動作を変えないコード変更 |
| docs | 📚 | ドキュメント |
| test | ✅ | テストの追加、修正 |

サンプルの追加は `feat`、表示崩れや不具合の修正は `fix` とする。本リポジトリはテストを持たないため `test` は用いない。

この書式を導入する前のコミットは、絵文字とprefixを持たない。遡って書き換えない。

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
