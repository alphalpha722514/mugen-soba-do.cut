# 無限そば道・斬 ～蕎麦切り修行～

ブラウザで遊ぶリズムゲームです。ゲームのすべて（HTML・CSS・JavaScript）が `index.html` の1ファイルに入っています。

## 作業のしかた
- 依頼文に「全文を出力して」とあっても、チャットに全文を貼る必要はありません。`index.html` を直接編集してください。最後に、何をどう変えたかを日本語で短く報告してください。
- 頼まれていないところは変えないでください（数値・文言・見た目を含む）。

## 守ること
- 1ファイル構成を保つ。CSS と JavaScript は `index.html` の中に書き、外部ライブラリや外部ファイルを追加しない（すでにある Google Fonts の読み込みはそのまま）。
- 既存のゲーム性（斬のスコア計算と判定、そば猪口コイン、ガチャの排出率（画面に常に表示・合計100%）、そば札と交換所、季節の見た目）を壊したり省略したりしない。ガチャに天井（pity）と1日のコイン獲得上限は設けない。
- セーブデータは localStorage の `echizenSoba.v1`（schema 14）。項目を足すときは古いセーブを読んでも壊れないようにし、斬の自己ベスト・コイン・そば札・図鑑・装備を消さない。
  - schema 14 で `zan.sectionMiss`（`{コースid: {区間key: Missの累計}}`、区間keyは英小文字のみ・上限 STAT_MAX）を足した。13 のセーブは `echizenSoba.v1.backup-s13` に控えを取り、空の `{}` で始める。同期では区間ごとに大きいほうを取る。Ver 3.0 で保存構造を足すとき（コースのメダル・ゴースト・週次など）は、この schema 14 の中で既定値を補う形で足す。
  - schema 13 で自由修行を廃止した（`retireFreeMode`）。schema 12 以前のセーブは `echizenSoba.v1.backup-s12` に控えを取り、自由修行の記録（`bests`・`seasonal`・`satisfaction`・`stats`・前回のそば粉と季節モード、その日の未クリアの旧形式チャレンジ）を空にする。獲得済みの称号・限定品・コイン・そば札・図鑑・装備は残す。`bests` などの入れ物は古い版との読み書きのために空のまま残す。
  - `settings.zanTrick`（師匠のイタズラのアリ・ナシ）、`zan.courses.<id>.bestTrick`（そのベストがイタズラありか）、`zan.todayDone`（今日の一曲のコインを払った日）。
  - schema 12 で足した項目：`settings.onboarding`（ルール説明）・`settings.lastShareDate`（共有ボーナスを払った日）・`quiz`（1日3問のクイズ）・`badges`（ホームの赤丸）・`rewards`（実績で解放した限定品と称号）。schema 11 以前のセーブは `echizenSoba.v1.backup-s11` などに控えを取ってから移す。
  - 限定アイテム（`GACHA_CATALOG` の `source:'reward'`・レア度 `gen`）はガチャの抽選・排出率の表・交換所に入れない。条件（`cond`）は実績で判定する。
  - クイズの問題（`QUIZ_POOL`）は事実に基づいて書き、日付から決まる3問を全員共通で出す。要望箱の送り先は `FEEDBACK_URL`（Google フォームができたら差し替える）。
  - 段位は廃止し、称号（`TITLES_DATA`・`gacha.titles`・`gacha.equippedTitle`）に移行済み。schema 10 以前のセーブは `echizenSoba.v1.backup-s10` に控えを取ってから移行する。獲得した称号は消さない。
  - 読めない（壊れた）セーブは、作り直す前に `echizenSoba.v1.backup-unreadable` に控えを取る。ログイン中の「記録を消す」は `recordsClearedAt` で同期先にも伝わる。
  - コインとそば札は `gacha.ledger`（端末ごとの増えた分・使った分と、共通の出発点 base）で同期する。同期で「多いほう」を取ると使った分が戻るので、残高は必ず帳簿から出す。端末を区別するランダムな文字列は `echizenSoba.v1.device` に置く（帳簿の見出しとして同期先にも載るが、個人や端末の種類はわからない）。
  - アカウント情報は `echizenSoba.v1.account`、模擬クラウドは `echizenSoba.mockCloud`。パスワードは平文で保存・送信せず、SHA-256 でハッシュ化する。メールアドレスなどの個人情報は集めない。
- 季節の事実：福井は秋そばが主流で、10月下旬〜11月上旬に収穫。そばの花は9〜10月に咲く。これに沿わない季節設定を書かない。
- スクリプト先頭の `const ART = {...}` は図鑑アイテムの絵（base64）の置き場。空のままでも、画像が壊れていても、代わりの表示で動くようにする。
- 着せ替え（装備）は見た目と音だけで、得点や判定には影響させない。
- 効果音は `settings.sound.soundOn`（🔊／🔇）の設定を必ず守る。BGM（Web Audio で合成。音声ファイルは使わない）は `settings.sound.bgmOn`・`bgmVolume` で効果音とは別に切り替えられるが、🔇 のときは BGM も含めて一切鳴らさない。BGM は効果音のコンプレッサーを通さず、切る音より小さく保つ。
- 振動（`settings.haptics.on`、既定オン）：斬で切ったとき Perfect 10ms・OK 6ms、Miss 20ms（`zanBuzz`）。曲の開始時に一度だけ可否を決める（`zanBuzzAllowed`：設定オフ・演出「控えめ」・視差効果を減らす・`navigator.vibrate` がない端末では震えない）。🔊／🔇とは別。得点や判定には関わらない。
- リザルトの数え上げ・ガチャの開封演出は表示だけで、得点や抽選には関わらない。
- 「リズム修行・斬」（`state.phase==='zan'`）がゲームの唯一のモード（ホームのいちばん上）。従来の修行（自由修行）は schema 13 で廃止した。着せ替え画面のお客さん・器の絵（`drawCustomerBody`・`drawServingBowl` など）と図鑑の作成に使う関数は残してある。
  - コース（`ZAN_COURSES`：二八・十割・粗挽き）ごとに曲（`ZAN_SONGS`）を持つ。曲の拍と秒はテンポ表（`tempo`・`zanB2T`／`zanT2B`）で変換し、BPM を決め打ちしない。曲のないコースは「準備中」として選べない。
  - 記録は `store.zan` の `courses.<コースid>`（自己ベスト・回数・完成度・`bestTrick`）と、全コース通しの `best`・`plays`・`bestGrade`（コース導入前の記録もここに残る）。前回のコースは `zan.lastCourse`。
  - 伴奏は曲の開始前に OfflineAudioContext で小節ごとに作って1本の音にする（`zanRenderBacking`）。作れないときや間に合わないときは、これまでどおりその場で鳴らす。コンボで重なる音・師匠の音・メトロノームはその場で鳴らす。
  - 「試し切り」のずれ補正は `echizenSoba.v1.zanOffset`（ミリ秒・±300）。端末ごとに違うので、この端末だけに置き、同期しない。入力の時刻からこの分を引いて判定する。
  - ほかのアプリに切り替えると一時停止し（`zanPause`）、タップで続きから再開する。
  - 判定は音の時計（`zanNow`・入力の timeStamp）。判定の幅はコースごと（`ZAN_COURSES` の `perfectMs`・`okMs`・`guardMs`。二八 35/80/120・十割 30/70/105・粗挽き 25/60/90。ないコースは `ZAN_PERFECT` などの既定値で、既定より広くしない）。曲の開始時に `zanWindows` で `zan.win` に入れ、判定・掃き出し・フェイント・盤の判定帯はすべてこれを使う。ずれ±15ms以内は真・PERFECT（`ZAN_SHIN`）で、その切りの基本点×1.5（`ZAN_SHIN_MULT`。Perfect に数え、回数は `zan.shin`）。コンボ倍率の式は変えない。得点と記録は `store.zan` に入れる。
  - 称号と限定アイテムの条件は、斬の記録（`zan.totalScore`・`maxCombo`・`bestPerfectRate`・`perfectClears`・`best`・`plays`）と図鑑・クイズで判定する（`titleMetrics`）。獲得済みの称号は条件に届かなくなっても消さない。
  - 本日のチャレンジは斬で挑む（`conditionId` が `zan:<kind>:<value>`。kind は score・perfect・combo・grade、コースは自由、達成で500コイン）。以前の形（`<お客さん>:<点数>`）のチャレンジは、未クリアなら schema 13 への移行で作り直す。
  - ルール説明（`OB_SLIDES`）は斬の内容で、`ONBOARDING_VERSION` は 2（1 を見た人にも一度だけ出す）。リザルトの共有画像は斬でも作れる（コース・完成度・Perfect・最大コンボ・平均のずれ）。
  - そばの花・新そばの期間中は、斬の画面も季節の見た目にする（`zanSeason`。重なる期間は新そば）。見た目だけで、得点や判定は変えない。
  - 曲：二八（♩=110・18小節組）・十割（♩=130・裏拍・22組）・粗挽き（♩=155・長短のタメ・26組）。どれも約80〜90秒、いちばん細かいのは半拍（8分）。曲ごとの伴奏の違いは `music`（三味線・笛・太鼓）。
  - ひょっこり客（`zanPeekCheck`・`zanDrawPeeks`）：あなたの番の小節が終わるたび、次の小節線で画面下からお客さんが顔を出す。盤や包丁にはかぶせない。全部Perfectの小節が続くと蕎麦奉行（2）・お姫様（4）・殿様（6）。見た目と小さな鈴の音だけ。
  - リザルトの演出（`zanShowStart`）：ざるの盛り付け（Perfect率で麺のそろい・艶）→ 大根おろし・ネギ・かつお節 → 完成度に合った客の吹き出し → 判子 → 師匠のひと言。表示だけで得点に関わらず、タップで飛ばせ、「控えめ」などでは完成した姿を即時表示。譜面のノーツは必ずBGMの拍（1拍・半拍・4分の1拍）に置く。譜面は最初から最後まで「師匠のお手本（1小節）→ あなたの番（同じリズムの1小節）」のくり返しにする。ノーツは蕎麦を切るもの（タップの通常切りと、長押しのタメ切り）だけで、薬味などほかの種類は入れない。包丁は師匠もプレイヤーも、まな板へ切り下ろす動きで見せる。演出「控えめ」や「視差効果を減らす」の設定では、数え上げを省いて即時表示する。
  - そば猪口コイン（`zanCoinParts`）：修行120＋得点÷100（最大50）＋完成度の％÷2（最大50）＋コースぶん（`ZAN_COURSES` の `coinBonus`：二八0・十割40・粗挽き80。最大で220・260・300）。師匠のイタズラはこの合計の2割（`ZAN_TRICK_COIN`）を上乗せ、今日の一曲（`zanTodayCourse`：日付で決まる1コース）は1日1回+100（`ZAN_TODAY_BONUS`）、本日のチャレンジは+500。1日の上限は設けない。
  - 師匠のイタズラ（ホームでアリ・ナシ。`settings.zanTrick`）：曲の2つ目のパート（`sections[2]`：刻み・裏拍）から、あなたの番にこま板が盤の一部を隠し（`zanDrawKomaita`・`ZAN_TRICK_HIDE`。目隠しはこれだけ）、師匠のお手本にフェイント（`feint`：振りかぶって切らない・音なし）が入り、あなたの番の同じ拍に偽の印（`fake`：見えない）を置く。つられて切るとコンボが切れる（Missには数えない）。アリなら得点×1.2（`ZAN_TRICK_SCORE`）・コイン×1.2。記録は同じ自己ベストに入れ、`bestTrick` で（イタズラ）と印をつける。フェイントは拍の上・ほかの切りから半拍以上離して置く。
  - リザルトのふりかえり（`zanReview`・`zanGoalText`・`zanRenderReview`）：判定ごとに `zan.judges`（拍 `b`・秒 `t`・種類・判定・ずれms）を記録し、区間（`sections[].from`）ごとに Miss と平均のずれを帯と一覧で出す。極上までの逆算は、完成度が四捨五入なので (Perfect＋OK×0.5) が判定数の94.5%以上かつ Miss 0 で計算する。苦手の区間を文で示し、`zan.sectionMiss` に区間ごとの Miss を足す（`zanAddSectionMiss`）。演出「控えめ」・視差効果を減らすでは帯と棒を出さず数値だけ。表示だけで得点に関わらない。
  - 同時切り：曲の最後の1小節（`sections` の `unison`・`finale`）は、お手本なしで師匠とプレイヤーが同じ拍で切る。リズムは直前の小節で師匠が見せたもの。
  - 着せ替えは斬でも使う：器はリザルトの盛り付け（`zanPlateBowl`。装備がないときは竹ざる）、包丁は盤の包丁、演出は切ったときの輪と紙吹雪（`skinPart('effect')`）、効果音は切る音・Perfect・Miss・曲の始まり・判子など（`zanHitSound`）。見た目と音だけ。
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
- ブラウザで `index.html` を開き、ホーム → コースを選んで「斬 修行開始」→ 1曲遊んでリザルト（盛り付けの演出とコインの内訳）まで進めること。師匠のイタズラのアリ・ナシ両方で。
- ガチャ・図鑑・交換所・着せ替え・遊び方・マイページの画面が開けること。
- ブラウザのコンソールにエラーが出ないこと。

## アイテム図鑑のアーティファクト
- 「無限そば道・斬　アイテム図鑑」（https://claude.ai/artifact/2Bvaodir3XBDTfTb2XqoN5 ）は、`node tools/zukan/build.mjs` で `index.html` から作る1枚のページ（出力は `tools/zukan/out/item-zukan.html`、コミットしない）。
- アイテムの内容や絵を変えたら、作り直して同じURLに再公開し（Artifact ツールに `url` を渡す）、`node tools/zukan/build.mjs --mark-published` で `tools/zukan/state.json` を更新してコミットする。
- `.claude/settings.json` の Stop フックが、図鑑のページが変わったのに再公開されていないときに知らせる。
