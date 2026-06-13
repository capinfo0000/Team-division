(function () {
  "use strict";

  var STORAGE_KEY = "team-division-members";
  var SAVED_KEY = "team-division-saved";
  var ROLES_KEY = "team-division-roles";
  var MEMOS_KEY = "team-division-memos";
  var SESSION_KEY = "team-division-session";
  var DEFAULT_ROLES = ["書記", "発表", "司会", "タイムキーパー"];

  // バックエンド（PHP API）のURL。空のままだと、この端末内だけのローカル保存で動作します。
  // 本番（別端末で番号を入れて共有）するときは、配置した memo.php のURLを設定してください。
  //   例: "https://example.com/team-division/api/memo.php"
  var API_BASE = "";

  // 5W1Hは項目分けせず、1つの入力欄に薄い記入例（プレースホルダー）で誘導する
  var MEMO_PLACEHOLDER =
    "例）こんな感じで5W1Hを意識して記入してください。\n" +
    "いつ　　：来週月曜の朝礼で\n" +
    "どこで　：第1会議室\n" +
    "だれが　：田中さんが\n" +
    "なにを　：新企画の提案資料を準備\n" +
    "なぜ　　：承認をもらうため\n" +
    "どうやって：スライド3枚にまとめて説明";

  // ---- 状態 ----
  var members = loadMembers();
  var savedLists = loadSaved(); // { 名前: [メンバー...] }
  var roles = loadRoles(); // 役割名の配列
  var memos = loadMemos(); // { "チーム番号": "メモ本文" }（ローカル保存用）
  var currentTeams = []; // 直近の結果一覧 [{ number, name, members:[名前...], code? }]
  var currentSession = loadSession(); // { session_code, codeByNumber:{番号:team_code} } or null

  // ---- DOM ----
  var form = document.getElementById("member-form");
  var nameInput = document.getElementById("member-name");
  var listEl = document.getElementById("member-list");
  var countEl = document.getElementById("member-count");
  var emptyMsg = document.getElementById("empty-message");
  var clearBtn = document.getElementById("clear-members");
  var sizeInput = document.getElementById("size-input");
  var sizeUnit = document.getElementById("size-unit");
  var modeRadios = document.querySelectorAll('input[name="mode"]');
  var saveForm = document.getElementById("save-form");
  var saveNameInput = document.getElementById("save-name");
  var savedListEl = document.getElementById("saved-list");
  var savedEmpty = document.getElementById("saved-empty");
  var savedModal = document.getElementById("saved-modal");
  var openSavedBtn = document.getElementById("open-saved");
  var savedCloseBtn = document.getElementById("saved-close");
  var savedBackdrop = document.getElementById("saved-backdrop");
  var roleForm = document.getElementById("role-form");
  var roleNameInput = document.getElementById("role-name");
  var roleListEl = document.getElementById("role-list");
  var roleEmpty = document.getElementById("role-empty");
  var roleEnabled = document.getElementById("role-enabled");

  // ---- DOM（ルーレット）----
  var tabs = document.querySelectorAll(".tab");
  var rRoleForm = document.getElementById("r-role-form");
  var rRoleNameInput = document.getElementById("r-role-name");
  var rRoleListEl = document.getElementById("r-role-list");
  var rRoleEnabled = document.getElementById("r-role-enabled");
  var rCountInput = document.getElementById("r-count");
  var rTeamsInput = document.getElementById("r-teams");
  var rStartBtn = document.getElementById("r-start");
  var settingsCard = document.getElementById("roulette-settings");
  var stageCard = document.getElementById("roulette-stage");
  var summaryCard = document.getElementById("roulette-summary");
  var progressEl = document.getElementById("r-progress");
  var personEl = document.getElementById("r-person");
  var reelEl = document.getElementById("r-reel");
  var reelTeamEl = document.getElementById("r-reel-team");
  var reelRoleEl = document.getElementById("r-reel-role");
  var reelListEl = document.getElementById("r-reel-list");
  var revealBtn = document.getElementById("r-reveal");
  var nextBtn = document.getElementById("r-next");
  var abortBtn = document.getElementById("r-abort");
  var summaryEl = document.getElementById("r-summary");
  var againBtn = document.getElementById("r-again");
  var backBtn = document.getElementById("r-back");
  var tabsBar = document.getElementById("tabs-bar");
  var listStartBtn = document.getElementById("list-start");
  var voiceEnabled = document.getElementById("voice-enabled");

  // ---- DOM（メモ／CSV）----
  var memoCard = document.getElementById("memo-card");
  var memoListEl = document.getElementById("memo-list");
  var memoTeamInput = document.getElementById("memo-team-input");
  var memoOpenBtn = document.getElementById("memo-open");
  var exportCsvBtn = document.getElementById("export-csv");
  var issueCodesBtn = document.getElementById("issue-codes");
  var sessionInfoEl = document.getElementById("session-info");
  var memoOpenInput = document.getElementById("memo-open-input");
  var memoOpenStandaloneBtn = document.getElementById("memo-open-standalone");
  var memoStandaloneEl = document.getElementById("memo-standalone");

  // ---- 状態（ルーレット）----
  var rMode = "person";    // "person"=1人ずつ / "team"=チームごと
  var rAssignments = [];
  var rLabels = [];        // 各参加者の表示名（名前 or 「N番目の人」）
  var rReturnTab = "roulette"; // 終了時に戻るタブ
  var rCurrent = 0;
  var rTeamCount = 0;
  var rTotal = 0;          // 発表ステップ数（person=人数 / team=チーム数）
  var rUseRoles = false;
  var spinning = false;

  // ---- localStorage ----
  function loadMembers() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveMembers() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
    } catch (e) {
      /* 保存失敗は無視（プライベートモード等） */
    }
  }

  function loadSaved() {
    try {
      var raw = localStorage.getItem(SAVED_KEY);
      var obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === "object" ? obj : {};
    } catch (e) {
      return {};
    }
  }

  function persistSaved() {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(savedLists));
    } catch (e) {
      /* 保存失敗は無視 */
    }
  }

  function loadRoles() {
    try {
      var raw = localStorage.getItem(ROLES_KEY);
      if (raw === null) return DEFAULT_ROLES.slice(); // 初回はデフォルト役割
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : DEFAULT_ROLES.slice();
    } catch (e) {
      return DEFAULT_ROLES.slice();
    }
  }

  function saveRoles() {
    try {
      localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
    } catch (e) {
      /* 保存失敗は無視 */
    }
  }

  function loadMemos() {
    try {
      var raw = localStorage.getItem(MEMOS_KEY);
      var obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === "object" ? obj : {};
    } catch (e) {
      return {};
    }
  }

  function saveMemos() {
    try {
      localStorage.setItem(MEMOS_KEY, JSON.stringify(memos));
    } catch (e) {
      /* 保存失敗は無視 */
    }
  }

  // チーム番号に対応するメモ本文（自由記述の1テキスト）を取得
  function getMemoText(teamNumber) {
    var v = memos[String(teamNumber)];
    if (typeof v === "string") return v;
    // 旧形式（項目別オブジェクト）が残っていれば1テキストに連結して救済
    if (v && typeof v === "object") {
      return Object.keys(v).map(function (k) { return v[k]; })
        .filter(function (s) { return s; }).join("\n");
    }
    return "";
  }

  function setMemoText(teamNumber, text) {
    memos[String(teamNumber)] = text;
    saveMemos();
  }

  function loadSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      var obj = raw ? JSON.parse(raw) : null;
      return obj && obj.session_code ? obj : null;
    } catch (e) {
      return null;
    }
  }

  function persistSession() {
    try {
      if (currentSession) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(currentSession));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch (e) {
      /* 保存失敗は無視 */
    }
  }

  // ---- バックエンドAPI（任意）----
  function apiEnabled() {
    return typeof API_BASE === "string" && API_BASE !== "";
  }

  function apiUrl(params) {
    var qs = [];
    Object.keys(params || {}).forEach(function (k) {
      qs.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
    });
    if (!qs.length) return API_BASE;
    return API_BASE + (API_BASE.indexOf("?") >= 0 ? "&" : "?") + qs.join("&");
  }

  function apiGet(params) {
    return fetch(apiUrl(params), { method: "GET" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function apiPost(params, body) {
    return fetch(apiUrl(params), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  // ---- 音声読み上げ（ブラウザの音声合成）----
  var speechPrimed = false;

  // iOS Safari 等では、最初のユーザー操作の中で一度 speak() を呼んでおかないと、
  // アニメーション後（setTimeout内）の読み上げがブロックされて無音になる。
  // そこで最初のタップ時に無音の発話で音声エンジンを「解錠」しておく。
  function primeSpeech() {
    if (speechPrimed || !("speechSynthesis" in window)) return;
    try {
      var u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
      speechPrimed = true;
    } catch (e) {
      /* 無視 */
    }
  }

  function speak(text) {
    if (!voiceEnabled || !voiceEnabled.checked) return;
    if (!("speechSynthesis" in window)) return;
    try {
      var synth = window.speechSynthesis;
      if (synth.speaking || synth.pending) synth.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP";
      u.rate = 1.0;
      synth.resume(); // 一部ブラウザで一時停止状態になるのを防ぐ
      synth.speak(u);
    } catch (e) {
      /* 読み上げ失敗は無視 */
    }
  }

  // ---- メンバー操作 ----
  function addMembers(text) {
    // 改行・カンマ・スペース・全角スペースで分割
    var names = text
      .split(/[\n,、，\s]+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });

    names.forEach(function (name) {
      members.push(name);
    });
    saveMembers();
    renderMembers();
  }

  function removeMember(index) {
    members.splice(index, 1);
    saveMembers();
    renderMembers();
  }

  function clearMembers() {
    if (members.length === 0) return;
    if (!window.confirm("登録メンバーを全て削除しますか？")) return;
    members = [];
    saveMembers();
    renderMembers();
  }

  // ---- 保存リスト（使い回し）----
  function saveCurrentAsList(name) {
    name = name.trim();
    if (!name) {
      window.alert("リスト名を入力してください。");
      return;
    }
    if (members.length === 0) {
      window.alert("保存するメンバーがいません。");
      return;
    }
    if (
      Object.prototype.hasOwnProperty.call(savedLists, name) &&
      !window.confirm("「" + name + "」は既にあります。上書きしますか？")
    ) {
      return;
    }
    savedLists[name] = members.slice();
    persistSaved();
    renderSaved();
  }

  function loadList(name) {
    var list = savedLists[name];
    if (!list) return;
    if (
      members.length > 0 &&
      !window.confirm("現在のメンバーを「" + name + "」で置き換えますか？")
    ) {
      return;
    }
    members = list.slice();
    saveMembers();
    renderMembers();
    savedModal.hidden = true; // 呼び出したらポップアップを閉じる
  }

  function deleteList(name) {
    if (!window.confirm("保存リスト「" + name + "」を削除しますか？")) return;
    delete savedLists[name];
    persistSaved();
    renderSaved();
  }

  function renderSaved() {
    var names = Object.keys(savedLists);
    savedListEl.innerHTML = "";
    savedEmpty.hidden = names.length > 0;

    names.forEach(function (name) {
      var li = document.createElement("li");

      var nameEl = document.createElement("span");
      nameEl.className = "saved-name";
      nameEl.textContent = name;

      var metaEl = document.createElement("span");
      metaEl.className = "saved-meta";
      metaEl.textContent = savedLists[name].length + "人";

      var loadBtn = document.createElement("button");
      loadBtn.type = "button";
      loadBtn.className = "btn btn-primary";
      loadBtn.textContent = "呼び出す";
      loadBtn.addEventListener("click", function () { loadList(name); });

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-text";
      delBtn.textContent = "削除";
      delBtn.addEventListener("click", function () { deleteList(name); });

      li.appendChild(nameEl);
      li.appendChild(metaEl);
      li.appendChild(loadBtn);
      li.appendChild(delBtn);
      savedListEl.appendChild(li);
    });
  }

  // ---- 役割 ----
  function addRole(name) {
    name = name.trim();
    if (!name) return;
    if (roles.indexOf(name) !== -1) return; // 重複は無視
    roles.push(name);
    saveRoles();
    renderRoles();
  }

  function removeRole(index) {
    roles.splice(index, 1);
    saveRoles();
    renderRoles();
  }

  function renderRoleListInto(ul) {
    if (!ul) return;
    ul.innerHTML = "";
    roles.forEach(function (name, i) {
      var li = document.createElement("li");
      var span = document.createElement("span");
      span.textContent = name;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "remove";
      btn.textContent = "×";
      btn.setAttribute("aria-label", name + " を削除");
      btn.addEventListener("click", function () { removeRole(i); });
      li.appendChild(span);
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  function renderRoles() {
    renderRoleListInto(roleListEl);
    renderRoleListInto(rRoleListEl);
    if (roleEmpty) roleEmpty.hidden = roles.length > 0;
  }

  // ---- 描画 ----
  function renderMembers() {
    listEl.innerHTML = "";
    countEl.textContent = members.length + "人";
    emptyMsg.hidden = members.length > 0;

    members.forEach(function (name, i) {
      var li = document.createElement("li");
      var span = document.createElement("span");
      span.textContent = name;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "remove";
      btn.textContent = "×";
      btn.setAttribute("aria-label", name + " を削除");
      btn.addEventListener("click", function () { removeMember(i); });
      li.appendChild(span);
      li.appendChild(btn);
      listEl.appendChild(li);
    });
  }

  function getMode() {
    var checked = document.querySelector('input[name="mode"]:checked');
    return checked ? checked.value : "perTeam";
  }

  function updateUnit() {
    sizeUnit.textContent = getMode() === "perTeam" ? "人" : "チーム";
  }

  // ---- チーム分けロジック ----
  function shuffle(array) {
    var a = array.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  // ---- ルーレット抽選 ----
  function teamName(i) {
    var label = i < 26 ? String.fromCharCode(65 + i) : String(i + 1);
    return label + "チーム";
  }

  function roleLabel(roleArr) {
    if (!rUseRoles || roles.length === 0) return "";
    return roleArr.length > 0 ? roleArr.join(" / ") : "役割なし";
  }

  // 人数・チーム数・役割から、全員分の割り当てを事前計算する
  function computeAssignments(count, teamCount, useRoles) {
    var teamOf = [];
    var i, p, t;
    for (i = 0; i < count; i++) teamOf.push(i % teamCount); // 均等配分
    teamOf = shuffle(teamOf);

    var membersByTeam = [];
    for (t = 0; t < teamCount; t++) membersByTeam.push([]);
    for (p = 0; p < count; p++) membersByTeam[teamOf[p]].push(p);

    var roleOf = [];
    for (p = 0; p < count; p++) roleOf.push([]);

    if (useRoles && roles.length > 0) {
      membersByTeam.forEach(function (members) {
        if (members.length === 0) return;
        // メンバーの並びもシャッフル → 兼任や「役割なし」が誰になるかもランダムに
        var shuffledMembers = shuffle(members);
        var shuffledRoles = shuffle(roles);
        shuffledRoles.forEach(function (role, k) {
          roleOf[shuffledMembers[k % shuffledMembers.length]].push(role);
        });
      });
    }

    var result = [];
    for (p = 0; p < count; p++) {
      result.push({ teamIndex: teamOf[p], roles: roleOf[p] });
    }
    return result;
  }

  // 共通の開始処理。opts: {mode, labels, teamCount, useRoles, returnTab}
  function beginRoulette(opts) {
    rMode = opts.mode; // "person" or "team"
    rLabels = opts.labels;
    rTeamCount = opts.teamCount;
    rUseRoles = opts.useRoles;
    rReturnTab = opts.returnTab;
    rAssignments = computeAssignments(rLabels.length, rTeamCount, rUseRoles);
    rTotal = rMode === "team" ? rTeamCount : rLabels.length;
    rCurrent = 0;

    // person モードのみリールに役割を出す（team モードは一覧側に表示）
    reelRoleEl.style.display =
      rMode === "person" && rUseRoles && roles.length > 0 ? "block" : "none";
    tabsBar.hidden = true;
    document.getElementById("tab-roulette").hidden = true;
    document.getElementById("tab-list").hidden = true;
    document.getElementById("tab-memo").hidden = true;
    summaryCard.hidden = true;
    stageCard.hidden = false;
    revealStep(0);
  }

  // ルーレット抽選タブ：人数指定 → 1人ずつ発表
  function startRoulette() {
    var count = parseInt(rCountInput.value, 10);
    var teams = parseInt(rTeamsInput.value, 10);
    if (isNaN(count) || count < 1) {
      window.alert("人数は1以上で入力してください。");
      return;
    }
    if (isNaN(teams) || teams < 1) {
      window.alert("チーム数は1以上で入力してください。");
      return;
    }
    if (teams > count) teams = count; // チーム数が人数を超えないように

    var labels = [];
    for (var i = 0; i < count; i++) labels.push((i + 1) + "番目の人");
    beginRoulette({
      mode: "person",
      labels: labels,
      teamCount: teams,
      useRoles: rRoleEnabled.checked,
      returnTab: "roulette"
    });
  }

  // リストで分けるタブ：登録メンバーで開始 → チームごとに発表
  function startListRoulette() {
    if (members.length === 0) {
      window.alert("先にメンバーを登録してください。");
      return;
    }
    var value = parseInt(sizeInput.value, 10);
    if (isNaN(value) || value < 1) {
      window.alert("1以上の数値を入力してください。");
      return;
    }
    var mode = getMode();
    var teamCount = mode === "perTeam"
      ? Math.ceil(members.length / value)
      : Math.min(value, members.length);
    beginRoulette({
      mode: "team",
      labels: members.slice(),
      teamCount: teamCount,
      useRoles: roleEnabled.checked,
      returnTab: "list"
    });
  }

  function exitStage() {
    stageCard.hidden = true;
    summaryCard.hidden = true;
    memoCard.hidden = true;
    tabsBar.hidden = false;
    switchTab(rReturnTab);
  }

  // 1ステップを発表（person=1人ずつ自動 / team=ボタンで発表）
  function revealStep(s) {
    nextBtn.hidden = true;
    revealBtn.hidden = true;
    reelListEl.hidden = true;
    reelListEl.innerHTML = "";
    reelListEl.classList.remove("shuffling");
    reelEl.classList.remove("settled");

    if (rMode === "team") {
      // チームごと：発表ボタンを出して待機（自動では回さない）
      progressEl.textContent = rTeamCount + "チーム中 " + (s + 1) + "チーム目";
      personEl.textContent = teamName(s); // 「Aチーム」を表題として表示
      reelEl.hidden = true;
      revealBtn.textContent = teamName(s) + "の発表はこちら ▶";
      revealBtn.hidden = false;
    } else {
      // 1人ずつ：発表ボタンを押してからルーレット。
      // 前の人の結果は「？」に戻しておき、次の人には見えないようにする。
      progressEl.textContent = rTotal + "人中 " + (s + 1) + "人目";
      personEl.textContent = rLabels[s];
      reelEl.hidden = false;
      reelTeamEl.textContent = "？";
      reelRoleEl.textContent = "？";
      revealBtn.textContent = "発表！";
      revealBtn.hidden = false;
    }
  }

  // 発表ボタンを押したら抽選演出を開始（person=1人ずつ / team=チーム単位）
  function onReveal() {
    if (spinning) return;
    primeSpeech(); // 発表タップ時に音声を解錠（iOS対策）
    revealBtn.hidden = true;
    if (rMode === "person") {
      spinPerson(rCurrent);
    } else {
      spinTeam(rCurrent);
    }
  }

  function spinPerson(s) {
    spinning = true;
    reelEl.classList.add("spinning");
    reelEl.classList.remove("settled");

    var ticks = 0;
    var total = 26;
    function tick() {
      reelTeamEl.textContent = teamName(Math.floor(Math.random() * rTeamCount));
      if (rUseRoles && roles.length > 0) {
        reelRoleEl.textContent = roles[Math.floor(Math.random() * roles.length)];
      }
      ticks++;
      if (ticks < total) {
        setTimeout(tick, 45 + Math.pow(ticks / total, 3) * 260);
      } else {
        var a = rAssignments[s];
        reelTeamEl.textContent = teamName(a.teamIndex);
        reelRoleEl.textContent = roleLabel(a.roles);
        reelEl.classList.remove("spinning");
        reelEl.classList.add("settled");
        spinning = false;
        var rl = roleLabel(a.roles);
        speak(
          rLabels[s] + " は、" + teamName(a.teamIndex) + " です" +
          (rl && rl !== "役割なし" ? "。役割は " + rl : "")
        );
        nextBtn.textContent = s === rTotal - 1 ? "結果を見る ▶" : "次の人へ ▶";
        nextBtn.hidden = false;
      }
    }
    tick();
  }

  // チーム t のメンバー枠を作り、いろんなメンバー名がシャッフルする演出 → 確定
  function spinTeam(t) {
    spinning = true;
    var idxs = teamMemberIndices(t); // 確定メンバー（役割の人が上）
    var rows = [];
    reelListEl.innerHTML = "";
    idxs.forEach(function () {
      var li = document.createElement("li");
      var nameSpan = document.createElement("span");
      li.appendChild(nameSpan);
      reelListEl.appendChild(li);
      rows.push({ li: li, name: nameSpan });
    });
    reelListEl.hidden = false;
    reelListEl.classList.add("shuffling");

    var ticks = 0;
    var total = 24;
    function tick() {
      rows.forEach(function (r) {
        r.name.textContent = rLabels[Math.floor(Math.random() * rLabels.length)];
      });
      ticks++;
      if (ticks < total) {
        setTimeout(tick, 50 + Math.pow(ticks / total, 3) * 240);
      } else {
        settleTeam(t, idxs, rows);
      }
    }
    tick();
  }

  function settleTeam(t, idxs, rows) {
    reelListEl.classList.remove("shuffling");
    rows.forEach(function (r, i) {
      var p = idxs[i];
      r.name.textContent = rLabels[p];
      var label = roleLabel(rAssignments[p].roles);
      if (label) {
        var tag = document.createElement("span");
        tag.className = "role-tag";
        tag.textContent = label;
        r.li.appendChild(tag);
      }
    });
    personEl.textContent = teamName(t);
    spinning = false;
    var names = idxs.map(function (p) { return rLabels[p]; });
    speak(teamName(t) + " は、" + names.join("、") + " です");
    nextBtn.textContent = t === rTotal - 1 ? "結果を見る ▶" : "次のチームへ ▶";
    nextBtn.hidden = false;
  }

  // チーム t のメンバー番号一覧。役割を持つ人を上に並べる
  function teamMemberIndices(t) {
    var withRole = [];
    var without = [];
    for (var p = 0; p < rLabels.length; p++) {
      if (rAssignments[p].teamIndex !== t) continue;
      if (rUseRoles && rAssignments[p].roles.length > 0) {
        withRole.push(p);
      } else {
        without.push(p);
      }
    }
    return withRole.concat(without);
  }

  function nextStep() {
    if (spinning) return;
    rCurrent++;
    if (rCurrent < rTotal) {
      revealStep(rCurrent);
    } else {
      showSummary();
    }
  }

  function showSummary() {
    stageCard.hidden = true;
    summaryCard.hidden = false;
    summaryEl.innerHTML = "";
    currentTeams = [];

    for (var t = 0; t < rTeamCount; t++) {
      var teamMembers = teamMemberIndices(t);

      currentTeams.push({
        number: t + 1,
        name: teamName(t),
        members: teamMembers.map(function (p) { return rLabels[p]; })
      });

      var div = document.createElement("div");
      div.className = "team";

      var title = document.createElement("div");
      title.className = "team-title";
      var nameSpan = document.createElement("span");
      nameSpan.textContent = teamName(t);
      var countSpan = document.createElement("span");
      countSpan.className = "count";
      countSpan.textContent = teamMembers.length + "人";
      title.appendChild(nameSpan);
      title.appendChild(countSpan);

      var ol = document.createElement("ol");
      teamMembers.forEach(function (p) {
        var li = document.createElement("li");
        li.appendChild(document.createTextNode(rLabels[p]));
        var label = roleLabel(rAssignments[p].roles);
        if (label) {
          var tag = document.createElement("span");
          tag.className = "role-tag";
          tag.textContent = label;
          li.appendChild(tag);
        }
        ol.appendChild(li);
      });

      div.appendChild(title);
      div.appendChild(ol);
      summaryEl.appendChild(div);
    }

    // 新しいチーム分けになったので、前回発行したセッションは一旦リセット
    currentSession = null;
    persistSession();
    currentTeams.forEach(function (t) { t.code = null; });

    issueCodesBtn.hidden = !apiEnabled();
    issueCodesBtn.disabled = false;
    issueCodesBtn.textContent = "📡 チーム番号を発行";
    sessionInfoEl.hidden = true;

    renderMemos(currentTeams);
    memoCard.hidden = false;
  }

  // ---- チームメモ ----
  function renderMemos(teams) {
    memoListEl.innerHTML = "";
    teams.forEach(function (team) {
      memoListEl.appendChild(buildMemoTeam(team));
    });
  }

  // チームの保存先を決める（発行済みでAPI有効ならサーバー、それ以外は端末ローカル）
  function memoTargetForTeam(team) {
    if (apiEnabled() && team.code) return { kind: "server", code: team.code };
    return { kind: "local", number: team.number };
  }

  function buildMemoTeam(team) {
    var target = memoTargetForTeam(team);
    var initial = target.kind === "local" ? getMemoText(team.number) : (team._memo || "");
    return buildMemoEditor({
      number: team.number,
      name: team.name,
      members: team.members,
      code: team.code
    }, target, initial);
  }

  // メモ1件分のエディタ（結果一覧・別端末タブの両方で使う共通部品）
  function buildMemoEditor(team, target, initialText) {
    var wrap = document.createElement("div");
    wrap.className = "memo-team";
    wrap.id = "memo-team-" + team.number;

    var head = document.createElement("div");
    head.className = "memo-team-head";
    var title = document.createElement("div");
    title.className = "memo-team-title";
    var nameSpan = document.createElement("span");
    nameSpan.textContent = team.name;
    var countSpan = document.createElement("span");
    countSpan.textContent = (team.members ? team.members.length : 0) + "人";
    title.appendChild(nameSpan);
    title.appendChild(countSpan);

    var codeEl = document.createElement("div");
    codeEl.className = "memo-team-code";
    codeEl.textContent = "番号: " + (team.code || team.number) +
      (target.kind === "server" ? "（別端末でこの番号を入力）" : "");

    var membersEl = document.createElement("div");
    membersEl.className = "memo-team-members";
    membersEl.textContent = "メンバー: " +
      ((team.members && team.members.length) ? team.members.join("、") : "（なし）");

    head.appendChild(title);
    head.appendChild(codeEl);
    head.appendChild(membersEl);

    // 1つの自由記述欄。記入例は薄いプレースホルダーで表示
    var body = document.createElement("div");
    body.className = "memo-body";
    var ta = document.createElement("textarea");
    ta.className = "memo-text";
    ta.placeholder = MEMO_PLACEHOLDER;
    ta.value = initialText || "";

    var status = document.createElement("p");
    status.className = "memo-status";

    if (target.kind === "local") {
      ta.addEventListener("input", function () {
        setMemoText(target.number, ta.value);
      });
    } else {
      // サーバー保存（入力が止まってから保存）
      var timer = null;
      ta.addEventListener("input", function () {
        status.textContent = "入力中…";
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () {
          status.textContent = "保存中…";
          apiPost({ action: "save" }, { team_code: target.code, memo: ta.value })
            .then(function () { status.textContent = "✓ サーバーに保存しました"; })
            .catch(function () { status.textContent = "⚠ 保存に失敗（通信エラー）"; });
        }, 700);
      });
    }

    body.appendChild(ta);
    body.appendChild(status);
    wrap.appendChild(head);
    wrap.appendChild(body);
    return wrap;
  }

  // 「チーム番号を発行」：チーム構成をサーバーに登録し、番号（コード）を受け取る
  function issueCodes() {
    if (!apiEnabled()) {
      window.alert("サーバー連携が未設定です（app.js の API_BASE を設定してください）。");
      return;
    }
    if (currentTeams.length === 0) {
      window.alert("先にチーム分けをしてください。");
      return;
    }
    issueCodesBtn.disabled = true;
    issueCodesBtn.textContent = "発行中…";
    var payload = {
      teams: currentTeams.map(function (t) {
        return { team_number: t.number, team_name: t.name, members: t.members };
      })
    };
    apiPost({ action: "create" }, payload).then(function (res) {
      currentSession = { session_code: res.session_code, codeByNumber: {} };
      (res.teams || []).forEach(function (t) {
        currentSession.codeByNumber[t.team_number] = t.team_code;
      });
      currentTeams.forEach(function (t) {
        t.code = currentSession.codeByNumber[t.number] || null;
      });
      persistSession();
      renderMemos(currentTeams);
      showSessionInfo();
      issueCodesBtn.disabled = false;
      issueCodesBtn.textContent = "🔄 番号を再発行";
    }).catch(function () {
      issueCodesBtn.disabled = false;
      issueCodesBtn.textContent = "📡 チーム番号を発行";
      window.alert("番号の発行に失敗しました。API_BASEの設定とサーバー（memo.php / DB）をご確認ください。");
    });
  }

  function showSessionInfo() {
    if (!currentSession) { sessionInfoEl.hidden = true; return; }
    sessionInfoEl.textContent =
      "集約コード: " + currentSession.session_code +
      "（幹事用。CSVはこのコードの全チーム分をまとめて出力します）。" +
      "各チームには下に表示された番号を伝えてください。";
    sessionInfoEl.hidden = false;
  }

  // 別端末タブ：番号を入力してそのチームのメモを開く
  function openStandaloneMemo() {
    var raw = (memoOpenInput.value || "").trim();
    if (!raw) {
      window.alert("チーム番号を入力してください。");
      return;
    }
    memoStandaloneEl.innerHTML = "";

    if (apiEnabled()) {
      var loading = document.createElement("p");
      loading.className = "hint";
      loading.textContent = "読み込み中…";
      memoStandaloneEl.appendChild(loading);
      apiGet({ team: raw }).then(function (row) {
        memoStandaloneEl.innerHTML = "";
        var members = (row.members || "").split(/\r?\n/).filter(Boolean);
        var team = {
          number: row.team_number,
          name: row.team_name || ("チーム" + row.team_number),
          members: members,
          code: row.team_code
        };
        memoStandaloneEl.appendChild(
          buildMemoEditor(team, { kind: "server", code: row.team_code }, row.memo || "")
        );
      }).catch(function () {
        memoStandaloneEl.innerHTML = "";
        var msg = document.createElement("p");
        msg.className = "empty-message";
        msg.textContent = "その番号のメモが見つかりませんでした。番号をご確認ください。";
        memoStandaloneEl.appendChild(msg);
      });
    } else {
      // ローカルのみ：番号＝チーム番号としてこの端末のメモを開く
      var n = parseInt(raw, 10);
      var team2 = { number: n, name: "チーム" + n, members: [], code: null };
      memoStandaloneEl.appendChild(
        buildMemoEditor(team2, { kind: "local", number: n }, getMemoText(n))
      );
    }
  }

  // チーム番号でメモへスクロール＆フォーカス
  function openMemoByNumber() {
    var n = parseInt(memoTeamInput.value, 10);
    if (isNaN(n)) {
      window.alert("チーム番号を入力してください。");
      return;
    }
    var el = document.getElementById("memo-team-" + n);
    if (!el) {
      window.alert("チーム " + n + " はありません（現在 " + currentTeams.length + " チーム）。");
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.remove("flash");
    void el.offsetWidth; // アニメ再生のためリフロー
    el.classList.add("flash");
    var ta = el.querySelector("textarea");
    if (ta) ta.focus();
  }

  // ---- CSV書き出し（AIが読み取りやすいlong形式: 1行=1項目）----
  function csvField(value) {
    var v = value == null ? "" : String(value);
    if (/[",\n\r]/.test(v)) {
      return '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  }

  // BOM付きでCSVをダウンロード（ExcelでもUTF-8日本語が文字化けしない）
  function downloadCsv(rows) {
    var csv = rows
      .map(function (r) { return r.map(csvField).join(","); })
      .join("\r\n");
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = "team-memos-" + stamp + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    // サーバー連携＆発行済みなら、全端末で書かれた最新メモをまとめて取得して出力
    if (apiEnabled() && currentSession && currentSession.session_code) {
      apiGet({ session: currentSession.session_code }).then(function (res) {
        var rows = [["team_number", "team_name", "members", "memo", "team_code"]];
        (res.teams || []).forEach(function (t) {
          var members = (t.members || "").split(/\r?\n/).filter(Boolean).join(" / ");
          rows.push([t.team_number, t.team_name, members, t.memo || "", t.team_code]);
        });
        downloadCsv(rows);
      }).catch(function () {
        window.alert("CSVの取得に失敗しました（通信エラー）。");
      });
      return;
    }

    // ローカルのみ
    if (currentTeams.length === 0) {
      window.alert("先にチーム分けをしてください。");
      return;
    }
    var rows = [["team_number", "team_name", "members", "memo"]];
    currentTeams.forEach(function (team) {
      rows.push([team.number, team.name, team.members.join(" / "), getMemoText(team.number)]);
    });
    downloadCsv(rows);
  }

  function switchTab(name) {
    tabs.forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-tab") === name);
    });
    document.getElementById("tab-roulette").hidden = name !== "roulette";
    document.getElementById("tab-list").hidden = name !== "list";
    document.getElementById("tab-memo").hidden = name !== "memo";
  }

  // ---- イベント ----
  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      switchTab(t.getAttribute("data-tab"));
    });
  });

  rRoleForm.addEventListener("submit", function (e) {
    e.preventDefault();
    addRole(rRoleNameInput.value);
    rRoleNameInput.value = "";
    rRoleNameInput.focus();
  });

  // 最初のタップで音声エンジンを解錠（iOS Safari対策）
  document.addEventListener("pointerdown", primeSpeech, { once: true });

  rStartBtn.addEventListener("click", function () { primeSpeech(); startRoulette(); });
  listStartBtn.addEventListener("click", function () { primeSpeech(); startListRoulette(); });
  revealBtn.addEventListener("click", onReveal);
  nextBtn.addEventListener("click", nextStep);
  abortBtn.addEventListener("click", exitStage);
  againBtn.addEventListener("click", function () {
    rAssignments = computeAssignments(rLabels.length, rTeamCount, rUseRoles);
    rCurrent = 0;
    summaryCard.hidden = true;
    memoCard.hidden = true;
    stageCard.hidden = false;
    revealStep(0);
  });
  backBtn.addEventListener("click", exitStage);
  memoOpenBtn.addEventListener("click", openMemoByNumber);
  exportCsvBtn.addEventListener("click", exportCsv);
  issueCodesBtn.addEventListener("click", issueCodes);
  memoOpenStandaloneBtn.addEventListener("click", openStandaloneMemo);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = nameInput.value;
    if (text.trim()) {
      addMembers(text);
      nameInput.value = "";
      nameInput.focus();
    }
  });

  saveForm.addEventListener("submit", function (e) {
    e.preventDefault();
    saveCurrentAsList(saveNameInput.value);
    saveNameInput.value = "";
  });

  roleForm.addEventListener("submit", function (e) {
    e.preventDefault();
    addRole(roleNameInput.value);
    roleNameInput.value = "";
    roleNameInput.focus();
  });

  openSavedBtn.addEventListener("click", function () { savedModal.hidden = false; });
  savedCloseBtn.addEventListener("click", function () { savedModal.hidden = true; });
  savedBackdrop.addEventListener("click", function () { savedModal.hidden = true; });

  clearBtn.addEventListener("click", clearMembers);
  modeRadios.forEach(function (r) {
    r.addEventListener("change", updateUnit);
  });

  // ---- 初期化 ----
  renderMembers();
  renderSaved();
  renderRoles();
  updateUnit();
})();
