# BBB 4.0 ローカルカスタマイズ統合（PR本文案）

## 概要

BBB 4.0向けのポップアップ・発表者ノート、レーザーポインター、PPTXアニメーション展開に、フォント変更、PPTXテキスト補正、ピンチズーム制限、外部動画の録画XML生成を統合する。

投稿先は `hiroshisuga/bigbluebutton`、ベースは `v4.0.x-release` を予定。現時点ではローカルコミットのみで、push・PR投稿・デプロイは行っていない。

- ベース: `8e6d3b91ef18f80b38470817a05442176f1251d5`
- 作業ブランチ: `integrate-v4-local-prs-20261004`
- カスタムtldrawは利用者が別途用意し、反映済みとして扱う。本統合ではtldrawやその依存バージョンを変更しない。
- #300（複数カメラ利用時のプレビュー維持）は利用者の指示により除外。v4.0への移植は別スレッド・別PRで行う。

## 統合元

| PR | 内容 | 固定した先端コミット |
|---|---|---|
| [#299](https://github.com/hiroshisuga/bigbluebutton/pull/299) | ポップアップ、次スライド表示、発表者ノート | `9b074ed0707b0bcd229013a02bbc64068a952adc` |
| [#304](https://github.com/hiroshisuga/bigbluebutton/pull/304) | レーザーポインター | `eac58f227c75dad6495a640591837f6b94b928ff` |
| [#303](https://github.com/hiroshisuga/bigbluebutton/pull/303) | v4.0のPPTXアニメーション展開UI・変換 | `e5841166e2e3481c4b747f87cb36101bdd51a326` |
| [#250](https://github.com/hiroshisuga/bigbluebutton/pull/250) | ホワイトボードの日本語・欧文フォント | `2800e401b78db3d59fd0c34897041c00bc1cc58a` |
| [#254](https://github.com/hiroshisuga/bigbluebutton/pull/254) | `external_videos.xml`生成 | `1187551c3945fe2ebecdaeb8f741478d615b38b2` |
| [#267](https://github.com/hiroshisuga/bigbluebutton/pull/267) | PPTXテキスト補正 | `cb550d5debca059c6ba4799cce14f79c23bed2c7` |
| [upstream #25671](https://github.com/bigbluebutton/bigbluebutton/pull/25671) | タッチ操作判定とピンチズーム範囲制限 | `94f4170a2b81a3ff5989341713d691635108431c` |
| [#269](https://github.com/hiroshisuga/bigbluebutton/pull/269) | #303と#267を組み合わせる変換スクリプトの参照元 | `1206f8e1fdfccfd50d469f315d6bfb0dd1d13ed0` |

v3.0のブランチ全体は取り込まず、各PR固有の差分をv4.0へ適用した。

## 競合の解消方針と統合内容

### ポップアップとレーザー

`whiteboard/component.jsx`のprops・ref・補助関数を併合し、両機能を保持した。

`useCursor`の第3引数を奪い合っていた競合は、`whiteboardRef`と`getLaserType`を別々の引数として渡す形で解消した。ポップアップのownerDocument/defaultViewに属するrequestAnimationFrame/cancelAnimationFrameを保持し、通常の送信とアンマウント時の保留座標送信の両方に`laserType`を含めた。

#304で不足していた`isTouchZoomRef`の定義・イベント接続は#25671から導入した。範囲外のタッチズームではカメラ更新全体を拒否する元PRの処理を維持する。非無限ホワイトボードの100～400%、無限ホワイトボードの25～400%を、widthGapを考慮した基準ズームから計算する。

### アップロードUIとノート

#303のv4.0 media-sharing用UIを使用し、#299のノートアップロード・既存PPTXからの抽出操作、サービス関数、翻訳項目を保持した。v3.0の旧presentation-uploader UIは移植しない。

### PPTX変換

利用者指定の#269を採用した。以下の5ファイルは#269の先端とバイト単位で一致する。

- `bbb-libreoffice/assets/convert-local.sh`
- `bbb-libreoffice/assets/expand_pptx_animations.py`
- `bbb-libreoffice/assets/convert_pptx_with_bullet_and_autofit_fixes.py`
- `bbb-libreoffice/assets/run-pptx-fixes-in-container.sh`
- `bbb-libreoffice/assets/zzz-bbb-docker-libreoffice-pptx`

処理順序は、元PPTX → 選択時のみアニメーション展開 → テキスト補正 → 同じLibreOffice文書からPDF出力。展開しないPPTXもテキスト補正の対象となる。元PPTXは保持する。

#303と#269の展開スクリプトは同一。#267と#269の補正スクリプトの相違は空行2か所のみだった。

インストール・パッケージ生成処理には展開と補正の両方のファイルを含める。v4.0のNoble向け`python3-lxml`依存関係は#303から保持した。

ノート抽出は#299の処理を使用する。展開マーカーがある場合は保存された展開済みPPTXを読み、非表示スライドを除外して番号を振る。展開済みファイルがない場合、番号の異なる元PPTXへ自動的に戻らずエラーにする。

### その他

フォントのバイナリ資産とアイコンも含めて#250を移植した。#254の録画処理はv4.0へ適用できた。追加行の空白のみの2行から末尾空白を除去し、動作は変更していない。

## 検証結果

- 変更されたJS/JSX/TS/TSX 35ファイルをBabelで構文解析した。
- Python 3ファイル、Shell 7ファイル、英語・日本語JSON 2ファイルの構文を確認した。
- `git -c core.whitespace=cr-at-eol diff --check`を実行した。既存のCRLFを維持する。
- #300の対象ディレクトリ`video-preview`がベースと同一であることを確認した。
- 実際のPython処理で、1クリックの入口アニメーションを持つスライド、非表示スライド、通常スライドからなる3枚のPPTXを4枚へ展開できた。
- 上記PPTXの表示対象ノートが、展開前は2枚分、展開後は3枚分となり、展開された2ページに同じノートが対応した。
- 展開後のPPTXにXML前処理を適用でき、末尾空白が処理され、スライド数と元PPTXが保持された。
- アニメーションなしのPPTXは枚数が維持された。展開マーカーあり・展開ファイルなしの場合は想定どおり失敗した。
- 統合した`useCursor`を小さなフック用ハーネスで実行し、ポップアップ側RAFの使用、座標更新の集約、レーザー種別送信、cleanup時のキャンセルと送信を確認した。
- レーザー種別のクライアントmutation、GraphQL action、Scalaイベント、Goストリーム、GraphQLスキーマの接続をコード上で確認した。

これらはフルビルドや実機試験の代わりではない。この環境ではDocker・LibreOffice/UNO、Ruby、Go、Scalaのビルド環境、およびBBB会議サーバーが利用できないため、PDFの見た目、録画処理、ブラウザー内の同期を含む実機動作は未検証。カスタムtldrawを含むHTML5本体のビルドも未実施。

## デプロイと実機確認

[デプロイ・実機確認手順](v4-integration-deployment.md)を参照。
