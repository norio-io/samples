# 制作サンプル

架空の題材で制作したWebサイトのサンプルです。公開先は GitHub Pages。

https://norio-io.github.io/samples/

## サンプル一覧

| 制作種別 | ブランド | ソース | 公開URL |
|---|---|---|---|
| ランディングページ | ひとひ（健康食品の定期購入） | [`lp/supplement/`](lp/supplement/) | https://norio-io.github.io/samples/lp/supplement/ |
| ランディングページ | ドッグサロン こもれび | [`lp/pet-salon/`](lp/pet-salon/) | https://norio-io.github.io/samples/lp/pet-salon/ |
| ECサイト | 灯し器（うつわ） | [`ec/tableware/`](ec/tableware/) | https://norio-io.github.io/samples/ec/tableware/ |
| コーポレートサイト | 三崎精密工業 | [`corporate/manufacturing/`](corporate/manufacturing/) | https://norio-io.github.io/samples/corporate/manufacturing/ |
| 店舗サイト | 麦と焙煎（カフェ＆ベーカリー） | [`store/cafe-bakery/`](store/cafe-bakery/) | https://norio-io.github.io/samples/store/cafe-bakery/ |

各サンプルのディレクトリに README.md があり、題材の由来、画面構成、実装したことを書いています。

## ディレクトリの命名

`<制作種別>/<業種の抽象名>/` の2階層にしています。

- 第1階層は制作種別（`lp` / `ec` / `corporate` / `store`）
- 第2階層は業種を表す抽象名（`supplement` / `pet-salon` / `tableware` / `manufacturing` / `cafe-bakery`）

ブランド名は使いません。`komorebi` のような固有名だけでは、何のサイトか分からないためです。同じ制作種別でサンプルが増えても、第2階層が増えるだけで済みます。

## 旧URLのリダイレクト

`cafe/` `corp/` `shop/` は、この構成にする前のパスです。外部に共有済みのURLのため、静的なリダイレクトページを残しています。`location.replace()` でクエリとハッシュを引き継ぐため、`shop/?item=p3` のような深いリンクも新パスに届きます。metaリフレッシュはJavaScript無効時のフォールバックです。

旧URLへの参照が不要になった時点で削除します。

`lp/` `ec/` `corporate/` `store/` の各ディレクトリ直下にも index.html があり、こちらは一覧の該当カードへ飛ばしています（404回避）。

## 共通の方針

- 外部ライブラリ、外部フォント、ビルド工程なし。HTML / CSS / JavaScript のみ
- 1サンプル1ファイル（画像がある場合のみ `img/` を持つ）
- すべてレスポンシブ対応。スマートフォン幅で横スクロールが出ないことを確認済み
- ページ冒頭に架空である旨の帯を出す。実在の企業・店舗とは関係ない
- 数値、レビュー、実績はすべて架空。その旨をページ内に明記する

## .nojekyll

GitHub Pages はデフォルトで Jekyll が動き、README.md を `.../README.html` としてビルドします。このリポジトリの README はリポジトリを読む人向けのものなので、`.nojekyll` を置いて Jekyll の処理を止めています。HTML の配信には影響しません。
