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
  - `zan.courses.<id>.ghost`（schema 14）：そのコースの自己ベストを出したときの切り `{chart: 曲id, cuts: [[拍×4, ずれms, 0通常/1タメの頭/2タメの斬], …]}`（最大 `ZAN_GHOST_MAX`=400、壊れていれば null）。新しいベストのときだけ書き替え、同期ではベストが大きいほうのゴーストを取る。`settings.ghost`（既定 false）がアリで、曲（`chart`）が同じときだけ、半透明の青い包丁であなたの包丁の上に重ねて再生する（`zanGhostLoad`・`zanGhostPose`）。見た目だけで判定・得点に関わらない。区間練習では出さない。
  - `zan.courses.<id>.perfect`（schema 14・真偽値）：そのコースを全部Perfectで終えたことがある（全Perfectメダル）。`true` 以外は false。同期はどちらかが true なら true。全体の回数 `zan.perfectClears` とは別物。マイページの「研鑽度」（`zanKen`・`zanKenBar`）はコースの回数 `plays` から出す見た目だけ（10／30／50／100回で 見習い→一人前→熟練→達人→名人）。
  - `zan.courses.<id>.bestCrit`・`zan.bestCrit`（schema 14・Ver 4.0）：1曲の極・一閃の最大数（コースごと・全体）。`zan.courses.<id>.bestMods`：そのベストを出したときの修行の心得（同期ではベストが大きいほうのもの）。`bestCrit` は大きいほう。
  - `ippai`（schema 14・Ver 5.0）：今日の一杯 `{date, tries, best, grade, crit, grid, bestTry}`（grid は小節ごとの `y`/`g`/`w`/`r`、最大40）。同期は日付が同じならベストが大きいほう（tries は大きいほう）、違えば新しい日付。`settings.clip`（ハイライト録画、既定 false）・`settings.rankGroup`（クラス番付の合言葉、''＝なし。`rankJoin` と同じくこの端末の設定）。
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
  - コース（`ZAN_COURSES`・`ZAN_COURSE_IDS`：二八・十割・粗挽き・越前打挽き）ごとに曲（`ZAN_SONGS`）を持つ。コースを足すときは `ZAN_COURSE_IDS` とホームのカード（`data-course`）にも足す。テンポの表示は `zanBpmLabel`（`bpmLabel` があればそれ）。曲の拍と秒はテンポ表（`tempo`・`zanB2T`／`zanT2B`）で変換し、BPM を決め打ちしない。曲のないコースは「準備中」として選べない。
  - 記録は `store.zan` の `courses.<コースid>`（自己ベスト・回数・完成度・`bestTrick`）と、全コース通しの `best`・`plays`・`bestGrade`（コース導入前の記録もここに残る）。前回のコースは `zan.lastCourse`。
  - 伴奏は曲の開始前に OfflineAudioContext で小節ごとに作って1本の音にする（`zanRenderBacking`）。作れないときや間に合わないときは、これまでどおりその場で鳴らす。コンボで重なる音・師匠の音・メトロノームはその場で鳴らす。
  - 「試し切り」のずれ補正は `echizenSoba.v1.zanOffset`（ミリ秒・±300）。端末ごとに違うので、この端末だけに置き、同期しない。入力の時刻からこの分を引いて判定する。
  - 一時停止（`zanPause`・`zanPauseBox`）：画面右上の ⏸（`#btn-zan-pause`）・Esc／P キー・ほかのアプリへの切り替えで止まり、ダイアログで「再開」（`zanResume`）・「最初からやり直す」（`zanRetry`。R キーでも。伴奏の作り置きを使って即座に）・「コースを選び直す」（`zanQuitToHome`）を選ぶ。やめた曲は `zanStopRun` で記録せずに止める。曲の頭と再開の前は「3・2・1」の合図。止まっている間のタップでは切らない。
  - 判定は音の時計（`zanNow`・入力の timeStamp）。判定の幅は Ver 4.0 から全コース共通で 極・一閃 ±10ms・Perfect ±35ms・OK ±80ms（`ZAN_CRIT`・`ZAN_PERFECT`・`ZAN_OK`、掃き出しは `ZAN_GUARD` 120ms）。`ZAN_COURSES` に `perfectMs`・`okMs`・`guardMs` を書けば `zanWindows` が読むが、既定より広くしない。曲の開始時に `zanWindows(course, strict)` で `zan.win`（`crit`・`perfect`・`ok`・`guard`）に入れ、判定・掃き出し・フェイント・盤の判定帯はすべてこれを使う。ずれ（ミリ秒に丸めた値。番付に送る値・サーバーの判定と同じ）が `win.crit` 以内は「極・一閃（CRITICAL）」で、その切りの基本点×1.5（`ZAN_CRIT_MULT`。Perfect に数え、回数は `zan.crit`）。風鈴の音（`zanCritChime`、🔇では鳴らない）・虹色の閃光と粒・金色の筆文字「極・一閃！」（`zanDrawBrush` の gold）は見た目と音だけ。コンボ倍率の式は変えない。得点と記録は `store.zan` に入れる。
  - 称号と限定アイテムの条件は、斬の記録（`zan.totalScore`・`maxCombo`・`bestPerfectRate`・`perfectClears`・`best`・`plays`）と図鑑・クイズで判定する（`titleMetrics`）。獲得済みの称号は条件に届かなくなっても消さない。
  - 週の段位認定（`store.weekly` = `{weekKey: その週の月曜（端末の日付）, cleared, total: 合格した週の数}`・schema 14）：`zanWeeklyGoal(weekKey)` が週の月曜の日付から（`seedFromDate` を `zanMix` で混ぜて）コースと目標（grade・rate＝Perfect率・combo＝判定数の割合・score＝`ZAN_WEEKLY_SCORE`）を1つ決める。`finishZan` の中で称号の判定より前に `zanWeeklyCheck` で合格を数える（週に1回まで。区間練習は数えない）。合格した週の数で称号 `w_shodan`(1)・`w_sandan`(3)・`w_godan`(5)・`w_shihan`(10)（`TITLE_CATS` の weekly、`titleMetrics.weeklyClears`）。同期は週が同じなら合格はどちらか、違えば新しい週、`total` は大きいほう。ホームの「週の段位認定」カード（`renderWeekly`）。
  - 本日のチャレンジは斬で挑む（`conditionId` が `zan:<kind>:<value>`。kind は score・perfect・combo・grade、コースは自由、達成で500コイン）。以前の形（`<お客さん>:<点数>`）のチャレンジは、未クリアなら schema 13 への移行で作り直す。
  - ルール説明（`OB_SLIDES`）は斬の内容で、`ONBOARDING_VERSION` は 2（1 を見た人にも一度だけ出す）。リザルトの共有画像は「一刀両断カード」（`drawZanCard`、1200×630）：盛り付け（`zanShowPaint` を客・判子なしで別のキャンバスに描く）・装備の包丁・判子・コース・完成度・得点・極・一閃／Perfect／OK／Miss・最大コンボ・完成度％・平均のずれ・イタズラと心得・称号と名前・日付。「カードを画像で保存」「クリップボードにコピー」（`ClipboardItem`）「画像で共有」（ファイルを共有できる端末だけ）「Xで共有」（画像をコピーしてから X の投稿画面を開く）。
  - そばの花・新そばの期間中は、斬の画面も季節の見た目にする（`zanSeason`。重なる期間は新そば）。判定の幅と得点の計算は変えない。
  - 新そばの特別な譜面（`ZAN_SHINSOBA_CALLS`・`zanSongFor`）：新そばの期間だけ、二八・十割・粗挽きのお手本（`calls`）を差し替える。区間ごとの組の数・区間・曲・和音はそのままで、拍（1拍・半拍）の上に置く。曲の id は `<id>.shin`（伴奏の作り置きとゴーストは別扱い。ゴーストは同じ id のときだけ出す）。記録はいつものコースの自己ベストに入れる（別ベストにしない）。越前打挽きは対象外。コースの曲を引くときは `ZAN_SONGS[course.song]` ではなく `zanSongFor(course)` を使う。
  - 曲：二八（♩=110・18小節組）・十割（♩=130・裏拍・22組）・粗挽き（♩=155・長短のタメ・26組）・越前打挽き（♩=120、拍96の「加速」から♩=150・22組・約86秒。`alwaysTrick` で設定にかかわらず最初の小節からイタズラ入り＝得点・コイン×1.2、`zanTrickFrom`。コースぶん120）。どれも約80〜90秒、いちばん細かいのは半拍（8分）。曲ごとの伴奏の違いは `music`（三味線・笛・太鼓）。
  - 修行の心得（`settings.mods` = `{speed: 1|1.2|1.5, strict, blind}`・`sanitizeMods`・ホームの `.zan-mods`）：速切りはテンポ表の BPM に掛けた別の曲（`zanPlaySong`。id は `<曲id>.x<速さ>`、心眼なら末尾に `b`、`baseId` が元の曲。印の流れる時間 `zan.travel` も縮める）、極・判定は `ZAN_STRICT_WIN`（7/15/40ms）、心眼は伴奏（旋律・和音・コンボで重なる音）を消して小節の頭の和太鼓だけにする（師匠のお手本と自分の切る音は残す）。倍率 `zanModMult`（速切り 1.2x ×1.1・1.5x ×1.2、極・判定 ×1.1、心眼 ×1.1 を掛け合わせる）を1切りごとの得点（`Math.round(基本点×コンボ倍率×イタズラ×modMult)`）とコイン（`zanCoinParts` の `mods`）に掛ける。記録は同じ自己ベスト・番付に入れ、ベストの心得を `zan.courses.<id>.bestMods`（なしは null）に残す。リザルトに心得のバッジ（`zanRenderModBadges`）。区間練習では使わない。
  - ひょっこり客（`zanPeekCheck`・`zanDrawPeeks`）：あなたの番の小節が終わるたび、次の小節線で画面下からお客さんが顔を出す。盤や包丁にはかぶせない。全部Perfectの小節が続くと蕎麦奉行（2）・お姫様（4）・殿様（6）。ふだんは見た目と小さな鈴の音だけだが、殿様の来店（全部Perfectの小節がちょうど6つ続いたとき）だけは、その小節線から16拍（あなたの番2小節）コンボ倍率に +0.2（`ZAN_TONO_BONUS`・`ZAN_TONO_BEATS`・`zan.tono`）。`zanHit` の倍率式の形はそのままで足すだけ。ポップアップ「殿様ご来店！ 倍率UP」は「控えめ」・視差効果を減らすではフェードだけ。判定の記録 `zan.judges` に `tono`（倍率UP中か）を残す。
  - リザルトの演出（`zanShowStart`）：ざるの盛り付け（Perfect率で麺のそろい・艶）→ 大根おろし・ネギ・かつお節 → 完成度に合った客の吹き出し → 判子 → 師匠のひと言。表示だけで得点に関わらず、タップで飛ばせ、「控えめ」などでは完成した姿を即時表示。譜面のノーツは必ずBGMの拍（1拍・半拍・4分の1拍）に置く。譜面は最初から最後まで「師匠のお手本（1小節）→ あなたの番（同じリズムの1小節）」のくり返しにする。ノーツは蕎麦を切るもの（タップの通常切りと、長押しのタメ切り）だけで、薬味などほかの種類は入れない。包丁は師匠もプレイヤーも、まな板へ切り下ろす動きで見せる。演出「控えめ」や「視差効果を減らす」の設定では、数え上げを省いて即時表示する。
  - そば猪口コイン（`zanCoinParts`）：修行120＋得点÷100（最大50）＋完成度の％÷2（最大50）＋コースぶん（`ZAN_COURSES` の `coinBonus`：二八0・十割40・粗挽き80・越前打挽き120。最大で220・260・300・340）。師匠のイタズラはこの合計の2割（`ZAN_TRICK_COIN`）を上乗せ、今日の一曲（`zanTodayCourse`：日付で決まる1コース）は1日1回+100（`ZAN_TODAY_BONUS`）、本日のチャレンジは+500。1日の上限は設けない。
  - 師匠のイタズラ（ホームでアリ・ナシ。`settings.zanTrick`）：曲の2つ目のパート（`sections[2]`：刻み・裏拍）から、あなたの番にこま板が盤の一部を隠し（`zanDrawKomaita`・`ZAN_TRICK_HIDE`。目隠しはこれだけ）、師匠のお手本にフェイント（`feint`：振りかぶって切らない・音なし）が入り、あなたの番の同じ拍に偽の印（`fake`：見えない）を置く。つられて切るとコンボが切れる（Missには数えない）。アリなら得点×1.2（`ZAN_TRICK_SCORE`）・コイン×1.2。記録は同じ自己ベストに入れ、`bestTrick` で（イタズラ）と印をつける。フェイントは拍の上・ほかの切りから半拍以上離して置く。
  - 区間練習（ホームの「区間練習」。`zanPracticeSong`・`zanPracticeLaunch`・`zanEndPractice`）：選んだコースの1区間（構え以外）の小節を3回くり返す別の曲を作って遊ぶ（同時切りは直前のお手本の小節＋同時切り）。速さ 0.8／0.9／1.0 はテンポ表の BPM に掛ける。和音は元の位置に合わせてずらす。`finishZan` を呼ばないので、得点・ベスト・コイン・称号・チャレンジ・`sectionMiss` は動かない。イタズラはなし。画面に「練習中（記録されません）」と「練習をやめる」を出す。伴奏の作り置きは練習用を1本だけ持つ。
  - リザルトのふりかえり（`zanReview`・`zanGoalText`・`zanRenderReview`）：判定ごとに `zan.judges`（拍 `b`・秒 `t`・種類・判定・ずれms）を記録し、区間（`sections[].from`）ごとに Miss と平均のずれを帯と一覧で出す。極上までの逆算は、完成度が四捨五入なので (Perfect＋OK×0.5) が判定数の94.5%以上かつ Miss 0 で計算する。苦手の区間を文で示し、`zan.sectionMiss` に区間ごとの Miss を足す（`zanAddSectionMiss`）。演出「控えめ」・視差効果を減らすでは帯と棒を出さず数値だけ。表示だけで得点に関わらない。
  - 挑戦状（Ver 5.0・`duelEncode`／`duelDecode`・`zanArmed`）：リザルトの「挑戦状を送る」で、その1曲を `#duel=<メタのJSONをbase64url>.<切りをvarintで詰めたbase64url>` のリンクにする（表示名・コース・曲id・心得・イタズラ・得点・完成度・極・一閃・切り `[拍×4, ずれms, 種類]`・何回目の倍返しか・相手の名前）。サーバーは通さない。開くと招待のダイアログ（受けたら `zanArmed={duel}` で、その心得とイタズラで始め、相手の切りをゴーストにして名前を出す）。曲idが今の曲と違う（季節で譜面が変わった）ものは遊べない。記録はいつもどおり。リザルトに勝ち負けと「倍返し」。読み込むときは全部の項目を確かめる（壊れていたら読まない）。
  - 今日の一杯（Ver 5.0・`zanIppaiOf`）：日付（端末）から1コース・心得（`IPPAI_MODS`）・イタズラを決め、全員同じ。#番号は 2026-10-03 が #1（`IPPAI_EPOCH`）。何杯でも遊べ、その日のベストを `ippai` に残す。共有は小節ごとの絵文字（🟨 全部Perfectで極・一閃が半分以上・🟩 全部Perfect・⬜ OKかつられた・🟥 Miss）。コインは足さない。
  - ハイライト録画（Ver 5.0・`zanClip*`）：`settings.clip` がアリで、`MediaRecorder` と `canvas.captureStream` がある端末だけ。曲の終わりの15秒前から、盤を写した 540×960 のキャンバスと効果音・伴奏の出口（`sfxBus.out`・`zan.bus`）を録り、終わったら結果のスレート（盛り付け・判子・得点）を3.4秒足して止める。形式は H.264 の mp4 → WebM → mp4 の順。🔇なら音なし。一時停止で止め、やり直し・選び直しで捨てる。端末の外には送らない。
  - リザルトの越前流（Ver 5.0）：器を装備しているときは「ぶっかけ！」（片口からだしを注ぐ）、ざるのときは「おろし、ドサッ！」。お客さんの吹き出しは2回に1回福井弁（`ZAN_SHOW_FUKUI`。増やすときは地元の言い方を確かめる）。師匠のひと言の下に「ひとくち越前」（`ZAN_FACTS`。事実に基づく短い一文。言い切れない話は「伝えられる」）。完成度40%未満は大失敗（`ZAN_SHOW_FAIL`：恐竜のお客がそば湯だけ飲む・判子「出直し」）。恐竜のお客（`drawDinoGuest`）は、ひょっこり客にもときどき出る（お姫様・殿様が優先）。どれも見た目と音だけ。
  - 同時切り：曲の最後の1小節（`sections` の `unison`・`finale`）は、お手本なしで師匠とプレイヤーが同じ拍で切る。リズムは直前の小節で師匠が見せたもの。
  - 着せ替えは斬でも使う：器はリザルトの盛り付け（`zanPlateBowl`。装備がないときは竹ざる）、包丁は盤の包丁、演出は切ったときの輪と紙吹雪（`skinPart('effect')`）、効果音は切る音・Perfect・Miss・曲の始まり・判子など（`zanHitSound`）。見た目と音だけ。
- 画面の文言は日本語。スマホ（幅360px）でも横にはみ出さないようにする。

## Web公開（GitHub Pages）
- `main` のリポジトリ直下を GitHub Pages で公開する（公開URL: https://alphalpha722514.github.io/mugen-soba-do.cut/ ）。ゲームは `index.html` だけで動く。
- `<head>` には SEO・OGP・iOS/Android 用のメタタグと、アイコン（SVG・PNG をデータURIで埋め込み）、マニフェストをつなぐ小さなスクリプトがある。マニフェストは http(s) で開いたときだけつなぐ（file:// でエラーを出さないため）。
- 例外として置いてよい公開用ファイル: `og-image.jpg`（SNS共有カードの画像。ゲームは読まない。`node tools/og/build.mjs` で作り直す）と `.nojekyll`。
- Google Play（PWABuilder / TWA）用に置いてよいファイル: `manifest.webmanifest` と `icons/`（`node tools/pwa/build.mjs` で、favicon の SVG から作り直す）、`privacy.html`（プライバシーポリシー。集める情報を変えたら必ず直す）。
- 同期サーバーのコードは `tools/sync-server/worker.js`（Cloudflare の Worker「soba-sync」に貼って公開する）。ゲームの同期の仕組みを変えたら、こちらも合わせて直す。
- 番付（`/ranking`）：ログイン中で、この端末で `settings.rankJoin` を選んだときだけ、斬の1曲ごとに判定の記録（`zan.judges` を `[拍×4, ずれms|null, 種類, 判定 0P/1OK/2Miss/3つられた, 殿様]` にしたもの）と、曲の id は心得なしの元の曲（`baseId`）、修行の心得 `mods` を送る（`zanRankSend`）。サーバー（`rankCheck`）は得点・最大コンボ・Perfect数・判定の数・判定の幅・拍の位置を計算し直し、合わなければ載せない。**斬の得点の決まり（判定の幅 `RANK_WIN`・`RANK_WIN_STRICT`、基本点、極・一閃、コンボ倍率、殿様、イタズラ、修行の心得の倍率 `RANK_SPEED_MULT`、曲ごとの判定の数 `RANK_COURSES.charts`）を変えたら、`worker.js` も同じに直す**（曲を足したり譜面を変えたりしたときも）。番付に載せるのは表示名（ユーザー名は載せない）・得点・完成度・最大コンボ・Perfect数・イタズラ・修行の心得。コース×（今週・全期間）の上位50人、週は日本時間の月曜から（`rankWeekKey`）。参加をやめる・アカウント削除で番付から消す。疑似クラウド（mock）にも同じ呼び出しがある（計算し直しはしない）。集める情報を変えたら `privacy.html` も直す。
- クラス番付（合言葉・Ver 5.0）：合言葉はプレイヤーが自分で決めて入れる4〜16文字（ひらがな・カタカナ・漢字・英字・数字・ー。NFKC のあと英字は大文字にそろえる、`rankGroupOf`。ゲームが勝手に作らない）。画面で「本名や学校名など、だれかわかる言葉は使わない」と案内する。`settings.rankJoin`（全体）と `settings.rankGroup`（合言葉）のどちらかがあれば送る（`pub` が全体に載せるか、`group` が合言葉）。サーバーは `rank:<コース>:g:<合言葉>:all|w<週>` に載せ、本人が入った合言葉を `rankg:<uid>`（最大5）に覚える。DELETE は `?scope=global`（全体だけ）・`?group=`（その合言葉だけ）・指定なし（全部。アカウント削除も全部）。リンクは `#group=<合言葉をURLエンコード>`（番付の画面に入力済みで開き、入るのは本人が押す）。**この仕組みは、`worker.js` を先にデプロイしてからゲームを公開する**（古いサーバーは `pub:false` を知らず、全体の番付に載せてしまう）。
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
