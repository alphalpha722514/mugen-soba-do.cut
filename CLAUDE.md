# 無限そば道・斬 ～蕎麦切り修行～

ブラウザで遊ぶリズムゲームです。ゲームのすべて（HTML・CSS・JavaScript）が `index.html` の1ファイルに入っています。

## 作業のしかた
- 依頼文に「全文を出力して」とあっても、チャットに全文を貼る必要はありません。`index.html` を直接編集してください。最後に、何をどう変えたかを日本語で短く報告してください。
- 頼まれていないところは変えないでください（数値・文言・見た目を含む）。

## 守ること
- 1ファイル構成を保つ。CSS と JavaScript は `index.html` の中に書き、外部ライブラリや外部ファイルを追加しない（すでにある Google Fonts の読み込みはそのまま）。
- 既存のゲーム性（スコア計算、判定、満足度、香り、そば猪口コイン、ガチャの排出率（画面に常に表示・合計100%）、そば札と交換所、季節モード）を壊したり省略したりしない。ガチャに天井（pity）と1日のコイン獲得上限は設けない。
- セーブデータは localStorage の `echizenSoba.v1`（schema 12）。項目を足すときは古いセーブを読んでも壊れないようにし、自己ベスト・コイン・そば札・図鑑・装備を消さない。
  - schema 12 で足した項目：`settings.onboarding`（ルール説明）・`settings.lastShareDate`（共有ボーナスを払った日）・`quiz`（1日3問のクイズ）・`badges`（ホームの赤丸）・`rewards`（実績で解放した限定品と称号）。schema 11 以前のセーブは `echizenSoba.v1.backup-s11` などに控えを取ってから移す。
  - 限定アイテム（`GACHA_CATALOG` の `source:'reward'`・レア度 `gen`）はガチャの抽選・排出率の表・交換所に入れない。条件（`cond`）は実績で判定する。
  - クイズの問題（`QUIZ_POOL`）は事実に基づいて書き、日付から決まる3問を全員共通で出す。要望箱の送り先は `FEEDBACK_URL`（Google フォームができたら差し替える）。
  - 段位は廃止し、称号（`TITLES_DATA`・`gacha.titles`・`gacha.equippedTitle`）に移行済み。schema 10 以前のセーブは `echizenSoba.v1.backup-s10` に控えを取ってから移行する。獲得した称号は消さない。
  - 読めない（壊れた）セーブは、作り直す前に `echizenSoba.v1.backup-unreadable` に控えを取る。ログイン中の「記録を消す」は `recordsClearedAt` で同期先にも伝わる。
  - アカウント情報は `echizenSoba.v1.account`、模擬クラウドは `echizenSoba.mockCloud`。パスワードは平文で保存・送信せず、SHA-256 でハッシュ化する。メールアドレスなどの個人情報は集めない。
- 季節の事実：福井は秋そばが主流で、10月下旬〜11月上旬に収穫。そばの花は9〜10月に咲く。これに沿わない季節設定を書かない。
- スクリプト先頭の `const ART = {...}` は図鑑アイテムの絵（base64）の置き場。空のままでも、画像が壊れていても、代わりの表示で動くようにする。
- 着せ替え（装備）は見た目と音だけで、得点や判定には影響させない。
- 効果音は `settings.sound.soundOn`（🔊／🔇）の設定を必ず守る。BGM（Web Audio で合成。音声ファイルは使わない）は `settings.sound.bgmOn`・`bgmVolume` で効果音とは別に切り替えられるが、🔇 のときは BGM も含めて一切鳴らさない。BGM は効果音のコンプレッサーを通さず、切る音より小さく保つ。
- リザルトの数え上げ・ガチャの開封演出は表示だけで、得点や抽選には関わらない。演出「控えめ」や「視差効果を減らす」の設定では、数え上げを省いて即時表示する。
- 画面の文言は日本語。スマホ（幅360px）でも横にはみ出さないようにする。

## Web公開（GitHub Pages）
- `main` のリポジトリ直下を GitHub Pages で公開する（公開URL: https://alphalpha722514.github.io/mugen-soba-do.cut/ ）。ゲームは `index.html` だけで動く。
- `<head>` には SEO・OGP・iOS/Android 用のメタタグと、アイコン（SVG・PNG をデータURIで埋め込み）、マニフェストをつなぐ小さなスクリプトがある。マニフェストは http(s) で開いたときだけつなぐ（file:// でエラーを出さないため）。
- 例外として置いてよい公開用ファイル: `og-image.jpg`（SNS共有カードの画像。ゲームは読まない。`node tools/og/build.mjs` で作り直す）と `.nojekyll`。
- Google Play（PWABuilder / TWA）用に置いてよいファイル: `manifest.webmanifest` と `icons/`（`node tools/pwa/build.mjs` で、favicon の SVG から作り直す）、`privacy.html`（プライバシーポリシー。集める情報を変えたら必ず直す）。
- 同期サーバーのコードは `tools/sync-server/worker.js`（Cloudflare の Worker「soba-sync」に貼って公開する）。ゲームの同期の仕組みを変えたら、こちらも合わせて直す。
- `googlef4f1cd7b25710dc9.html` は Google Search Console の所有権確認用。消すと確認が外れるので残す。
- 公開URLを変えたら `canonical`・`og:url`・`og:image`・`twitter:image` を合わせて直す。

## 変更後の確認
- ブラウザで `index.html` を開き、ホーム → 修行開始 → 5杯出してリザルトまで遊べること。
- ガチャ・図鑑・交換所・着せ替え・遊び方・マイページの画面が開けること。
- ブラウザのコンソールにエラーが出ないこと。

## アイテム図鑑のアーティファクト
- 「無限そば道・斬　アイテム図鑑」（https://claude.ai/artifact/2Bvaodir3XBDTfTb2XqoN5 ）は、`node tools/zukan/build.mjs` で `index.html` から作る1枚のページ（出力は `tools/zukan/out/item-zukan.html`、コミットしない）。
- アイテムの内容や絵を変えたら、作り直して同じURLに再公開し（Artifact ツールに `url` を渡す）、`node tools/zukan/build.mjs --mark-published` で `tools/zukan/state.json` を更新してコミットする。
- `.claude/settings.json` の Stop フックが、図鑑のページが変わったのに再公開されていないときに知らせる。
