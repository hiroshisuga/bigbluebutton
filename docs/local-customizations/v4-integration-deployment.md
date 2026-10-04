# BBB 4.0統合版：デプロイ・実機確認手順

本書は作業手順の下書きであり、サーバーへの反映はまだ行っていない。カスタムtldrawの準備・反映は利用者が担当する。

## 反映対象

| 対象 | 必要な反映 |
|---|---|
| HTML5 | カスタムtldrawを使ってビルド。ポップアップ、レーザー、フォント、PPTX選択UIを反映 |
| bbb-common-message / akka-bbb-apps | `laserType`を追加したメッセージ・イベント・録画出力をビルドして反映 |
| bbb-graphql-actions | カーソルactionの`laserType`を反映 |
| bbb-graphql-middleware | Goストリームの`laserType`をビルドして反映。#304の注記では初回に`golang-go`の導入が必要 |
| bbb-graphql-server | SQLスキーマ・ビューとHasura metadataを反映。次スライド配列の順序と`laserType`の両方を含む |
| bbb-web | PPTX展開マーカー、ノート用ルート・コントローラー・サービスをビルドして反映 |
| bbb-libreoffice | 下記スクリプト、依存パッケージ、sudoers、対応コンテナーを反映 |
| record-and-playback | 外部動画用イベント処理・publish処理・設定を反映 |

フロントエンドだけを更新すると、レーザーのメッセージ形式・GraphQLとの整合が取れない。対象サービスを揃えて反映し、再起動・新しい会議で確認する。具体的なビルドコマンドは利用中のv4.0ビルド手順に従う。

## ポップアップとノート

`/etc/bigbluebutton/bbb-html5.yml`の既存設定へマージする。

```yaml
public:
  presentation:
    allowPopupPresentation: true
```

元PRのデフォルトはfalse。カスタムtldrawは反映済みの前提で、依存バージョンやモジュール自体は本統合で変更していない。

リポジトリのルートから、ノート抽出スクリプトを手動配置する。

```sh
sudo apt install python3-defusedxml
sudo install -m 755 bigbluebutton-web/script/extract_pptx_notes.py /usr/local/bin/extract_pptx_notes.py
```

`PresentationService.groovy`はこの絶対パスを参照する。別の場所へ配置する場合はコード側も対応が必要。

Nginxの実効設定（通常`/usr/share/bigbluebutton/nginx/web`）へ、`bigbluebutton-web/bbb-web.nginx`に追加された以下のlocationを反映する。ノート用PPTXをbbb-webへ渡し、アップロードサイズ上限を設定するためのもの。

```nginx
location = /bigbluebutton/presentation-notes/upload {
    proxy_pass         http://127.0.0.1:8090;
    proxy_redirect     default;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    add_header P3P 'CP="No P3P policy available"';
    client_max_body_size       1000m;
    client_body_buffer_size    128k;
}
```

設定確認後に反映する。

```sh
sudo nginx -t && sudo systemctl reload nginx
```

展開されたプレゼンテーションでは「アップロード済みPPTXからノート抽出」を使うと展開済みファイルが選択される。別のノート用PPTXをアップロードする操作は、そのPPTXのページ構成をそのまま使用するので、表示ページとの対応を確認する。

## PPTX変換

ホスト側へ依存ライブラリを導入する。Noble向けパッケージには依存として追加済みだが、手動反映では別途必要。

```sh
sudo apt install python3-lxml
```

手動反映の場合は、リポジトリのルートから次を実行する想定。

```sh
sudo install -m 755 -o root -g root bbb-libreoffice/assets/convert-local.sh /usr/share/bbb-libreoffice-conversion/convert-local.sh
sudo install -m 644 -o root -g root bbb-libreoffice/assets/expand_pptx_animations.py /usr/share/bbb-libreoffice-conversion/expand_pptx_animations.py
sudo install -m 644 -o root -g root bbb-libreoffice/assets/convert_pptx_with_bullet_and_autofit_fixes.py /usr/share/bbb-libreoffice-conversion/convert_pptx_with_bullet_and_autofit_fixes.py
sudo install -m 755 -o root -g root bbb-libreoffice/assets/run-pptx-fixes-in-container.sh /usr/share/bbb-libreoffice-conversion/run-pptx-fixes-in-container.sh
sudo install -m 440 -o root -g root bbb-libreoffice/assets/zzz-bbb-docker-libreoffice-pptx /etc/sudoers.d/zzz-bbb-docker-libreoffice-pptx
sudo visudo -cf /etc/sudoers.d/zzz-bbb-docker-libreoffice-pptx
```

`convert.sh`がローカル変換スクリプトを参照しているか確認する。既存環境では`convert.sh`が実体ファイルの場合もあるので、その場合は使用中の実体へ反映する。リモート変換・独自変換を使用している場合、このローカル変換フックは通らない。

`install-local.sh`は変換用ディレクトリがすでに存在するとファイル配置をスキップする。既存サーバーで再実行するだけでは更新されない点に注意する。

コンテナー内のrunnerは`/opt/libreoffice25.8/program/python`を参照する。現在のリポジトリのDockerfileは`bigbluebutton/bbb-libreoffice:25.8.4.2-20260129-151200`を使用している。実サーバーの`bbb-soffice`イメージと対応を確認する。

展開済みPPTXは元ファイルと同じディレクトリに`*.expanded.pptx`として保存する。変換実行ユーザーがそのディレクトリに書き込めることを確認する。sudoersはDocker起動用であり、PPTX保存先のファイルシステム権限を変更するものではない。

## フォント

HTML5のビルド・配信に、`public/fonts/KosugiMaru`、`public/fonts/MA`、`public/fonts/MS`、`public/stylesheets/fonts.css`、`public/svgs/tldraw/font-amt.svg`を含める。

元PRの注意事項として、`/usr/share/bigbluebutton/html5-client/stylesheets/fonts.css.gz`が古いまま残ると、更新した非圧縮CSSより優先して配信される場合がある。手動差し替え時は古いgzip版を削除するか、更新済みCSSから再生成し、配信内容とブラウザーキャッシュを確認する。

## 外部動画の録画

#254のコメントで手動反映対象とされているファイルは以下。

| ソース | サーバー上の配置先 |
|---|---|
| `record-and-playback/core/lib/recordandplayback/generators/events.rb` | `/usr/local/bigbluebutton/core/lib/recordandplayback/generators/events.rb` |
| `record-and-playback/presentation/scripts/publish/presentation.rb` | `/usr/local/bigbluebutton/core/scripts/publish/presentation.rb` |
| `record-and-playback/presentation/scripts/presentation.yml` | `/usr/local/bigbluebutton/core/scripts/presentation.yml` |

設定は`include_external_videos: true`。v4.0のpublishスクリプトに`/etc/bigbluebutton/recording/presentation.yml`をマージする処理があることを確認したので、設定の上書き先として使用できる。ただし録画での実動作は未検証。

再生側には別リポジトリの対応が必要：<https://github.com/hiroshisuga/bbb-playback/pull/39>。本統合ではbbb-playbackを変更していない。#254に記載された外部動画イベントの初期再生・seek・同期に関する制約は、この統合だけで解消したとは扱わない。既存録画が自動で更新されるわけではなく、まず新規録画で確認する。

## 実機確認項目

1. 発表者と閲覧者の2端末で会議に参加する。
2. ポップアップの分離・復帰、サイズ変更、全画面開始・終了、スライド変更、ズームとパンの閲覧者同期を確認する。
3. タッチ端末で100%・400%付近、無限ホワイトボード、fit-to-width、余白のある縦長スライドを試す。2本指から1本指への移行も確認する。
4. レーザーの色・サイズ・Default切替、ポインター静止中の切替、スライド外へ出た場合、発表者交代、ポップアップ内の操作を確認する。
5. 通常テキスト・付箋のフォントを発表者・閲覧者・ポップアップで比較する。
6. PDFのみ、PPTXのみ、混在選択、展開する／しない、アップロード／キャンセルを試す。
7. アニメーションと非表示スライドを含むPPTXで、表示ページ・次ページ・ノート番号が一致するか確認する。
8. 補正対象のPPTXで、折り返し、箇条書きインデント、和欧文間隔、末尾空白のPDF描画を確認する。元PPTXのダウンロードも確認する。
9. 外部動画を共有した会議を録画し、`external_videos.xml`・サムネイルの生成、対応プレーヤーでの再生・停止・seek・速度変更を確認する。
10. レーザー種別は録画イベントへ保存されるが、録画プレーヤーでのレーザー描画は本統合の対象外。
