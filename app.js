(function () {
  "use strict";

  var STORAGE_KEY = "team-division-members";
  var SAVED_KEY = "team-division-saved";
  var ROLES_KEY = "team-division-roles";
  var DEFAULT_ROLES = ["書記", "発表", "司会", "タイムキーパー"];

  // メモ機能（共有付箋ボード）
  var API = "api/api.php"; // Xserver上の同じ場所のapiフォルダを想定
  var CATS = [
    { key: "議題", color: "#3b82f6" },
    { key: "良い点", color: "#10b981" },
    { key: "課題", color: "#ef4444" },
    { key: "アイデア", color: "#f59e0b" },
    { key: "質問", color: "#8b5cf6" },
    { key: "メモ", color: "#6b7280" }
  ];
  var memoCode = null;
  var memoCat = CATS[0].key;
  var memoTimer = null;

  // ---- 状態 ----
  var members = loadMembers();
  var savedLists = loadSaved(); // { 名前: [メンバー...] }
  var roles = loadRoles(); // 役割名の配列

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
  var rVoice = document.getElementById("r-voice");

  // メモ機能 DOM
  var makeMemoBtn = document.getElementById("r-make-memo");
  var memoHint = document.getElementById("r-memo-hint");
  var memoTabForm = document.getElementById("memo-tab-form");
  var memoTabInput = document.getElementById("memo-tab-input");
  var memoTabError = document.getElementById("memo-tab-error");
  var memoView = document.getElementById("memo-view");
  var memoTeamEl = document.getElementById("memo-team");
  var memoCodeEl = document.getElementById("memo-code");
  var memoCsvBtn = document.getElementById("memo-csv");
  var memoCloseBtn = document.getElementById("memo-close");
  var catChipsEl = document.getElementById("cat-chips");
  var noteForm = document.getElementById("note-form");
  var noteInput = document.getElementById("note-input");
  var memoBoardEl = document.getElementById("memo-board");
  var memoEmptyEl = document.getElementById("memo-empty");
  var rosterText = document.getElementById("roster-text");
  var rosterSaved = document.getElementById("roster-saved");
  var stageCodesEl = document.getElementById("stage-codes");
  var meetingTitleInput = document.getElementById("meeting-title");
  var listTitleInput = document.getElementById("meeting-title-list");
  var reportListEl = document.getElementById("report-list");
  var reportDetail = document.getElementById("report-detail");

  // ---- 状態（ルーレット）----
  var rMode = "person";    // "person"=1人ずつ / "team"=チームごと
  var rBoards = null;      // 共有メモ作成後の [{code, team_label}]（チーム順）
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

  // 結果を音声で読み上げ（対応ブラウザのみ）
  function speak(text) {
    if (!rVoice || !rVoice.checked) return;
    if (typeof window.speechSynthesis === "undefined") return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP";
      u.rate = 1;
      window.speechSynthesis.speak(u);
    } catch (e) { /* 非対応は無視 */ }
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
    rBoards = null; // 新しい抽選なので共有メモはリセット
    if (stageCodesEl) { stageCodesEl.hidden = true; stageCodesEl.innerHTML = ""; }
    if (makeMemoBtn) makeMemoBtn.hidden = false;
    if (memoHint) memoHint.hidden = true;

    // person モードのみリールに役割を出す（team モードは一覧側に表示）
    reelRoleEl.style.display =
      rMode === "person" && rUseRoles && roles.length > 0 ? "block" : "none";
    tabsBar.hidden = true;       // ルーレット中はタブ・設定（議題名）を隠す＝スタート後は変更不可
    hideAllTabPanels();
    summaryCard.hidden = true;
    stageCard.hidden = false;
    revealStep(0);
    issueBoards(); // チーム数は確定しているので番号を先に発行・表示
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
      // 1人ずつ：ボタンを押すまでチームは「？」のまま（前の人の結果を見せない）
      progressEl.textContent = rTotal + "人中 " + (s + 1) + "人目";
      personEl.textContent = rLabels[s];
      reelEl.hidden = false;
      reelTeamEl.textContent = "？";
      reelRoleEl.textContent = "";
      revealBtn.textContent = "🎲 自分のチームを見る";
      revealBtn.hidden = false;
    }
  }

  // 発表ボタンを押したらルーレット開始（person=自分のチーム / team=チームの一覧）
  function onReveal() {
    if (spinning) return;
    revealBtn.hidden = true;
    if (rMode === "team") {
      spinTeam(rCurrent);
    } else {
      spinPerson(rCurrent);
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
        var rLbl = roleLabel(a.roles);
        reelRoleEl.textContent = rLbl;
        reelEl.classList.remove("spinning");
        reelEl.classList.add("settled");
        spinning = false;
        nextBtn.textContent = s === rTotal - 1 ? "結果を見る ▶" : "次の人へ ▶";
        nextBtn.hidden = false;
        speak(teamName(a.teamIndex) + (rLbl ? "、" + rLbl : "")); // 音声読み上げ
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

    for (var t = 0; t < rTeamCount; t++) {
      var teamMembers = teamMemberIndices(t);

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

      // 共有メモ作成済みなら、このチームの番号と「メモを開く」を表示
      if (rBoards && rBoards[t]) {
        var codeRow = document.createElement("div");
        codeRow.className = "team-code";
        var codeNum = document.createElement("span");
        codeNum.className = "code-num";
        codeNum.textContent = "No. " + rBoards[t].code;
        var openBtn = document.createElement("button");
        openBtn.type = "button";
        openBtn.className = "btn btn-secondary";
        openBtn.textContent = "メモを開く";
        (function (code) {
          openBtn.addEventListener("click", function () { openBoard(code); });
        })(rBoards[t].code);
        codeRow.appendChild(codeNum);
        codeRow.appendChild(openBtn);
        div.appendChild(codeRow);
      }

      summaryEl.appendChild(div);
    }
  }

  function makeMemo() {
    if (!rTeamCount) return;
    var labels = [];
    for (var t = 0; t < rTeamCount; t++) labels.push(teamName(t));
    makeMemoBtn.disabled = true;
    makeMemoBtn.textContent = "作成中…";
    var title = getMeetingTitle();
    apiPost("create_boards", { title: title, teams: labels, roles: roles })
      .then(function (res) {
        if (!res || !res.boards) throw new Error(res && res.error ? res.error : "作成に失敗しました");
        rBoards = res.boards; // サーバーは送信順で返す＝チーム順
        memoHint.hidden = false;
        makeMemoBtn.hidden = true;
        showSummary();
      })
      .catch(function (e) {
        window.alert("共有メモの作成に失敗しました。\n(" + e.message + ")");
      })
      .then(function () {
        makeMemoBtn.disabled = false;
        makeMemoBtn.textContent = "🔗 共有メモを作成";
      });
  }

  // チーム番号の一覧をパネルに描画（先行発行の表示用）
  function renderTeamCodes(el) {
    if (!el) return;
    el.innerHTML = "";
    if (!rBoards) { el.hidden = true; return; }
    var title = document.createElement("div");
    title.className = "codes-title";
    title.textContent = "📒 メモ番号（参加者に共有）";
    el.appendChild(title);
    rBoards.forEach(function (b) {
      var row = document.createElement("div");
      row.className = "code-row";
      var name = document.createElement("span");
      name.className = "code-team";
      name.textContent = b.team_label;
      var num = document.createElement("span");
      num.className = "code-num";
      num.textContent = "No. " + b.code;
      var open = document.createElement("button");
      open.type = "button";
      open.className = "btn btn-secondary";
      open.textContent = "開く";
      (function (code) { open.addEventListener("click", function () { openBoard(code); }); })(b.code);
      row.appendChild(name);
      row.appendChild(num);
      row.appendChild(open);
      el.appendChild(row);
    });
    el.hidden = false;
  }

  // スタート時に各チームの番号を先行発行（サーバー版でのみ成功・失敗は無視）
  function issueBoards() {
    if (rBoards) return;
    var labels = [];
    for (var t = 0; t < rTeamCount; t++) labels.push(teamName(t));
    var title = getMeetingTitle();
    apiPost("create_boards", { title: title, teams: labels, roles: roles }).then(function (res) {
      if (res && res.boards) {
        rBoards = res.boards;
        renderTeamCodes(stageCodesEl);
        if (makeMemoBtn) makeMemoBtn.hidden = true;
        if (memoHint) memoHint.hidden = false;
        if (!summaryCard.hidden) showSummary(); // 既に結果表示中なら反映
      }
    }).catch(function () { /* 静的環境では番号なし */ });
  }

  var TAB_IDS = ["tab-roulette", "tab-list", "tab-memo", "tab-report"];
  function hideAllTabPanels() {
    TAB_IDS.forEach(function (id) { document.getElementById(id).hidden = true; });
  }
  function switchTab(name) {
    tabs.forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-tab") === name);
    });
    document.getElementById("tab-roulette").hidden = name !== "roulette";
    document.getElementById("tab-list").hidden = name !== "list";
    document.getElementById("tab-memo").hidden = name !== "memo";
    document.getElementById("tab-report").hidden = name !== "report";
    if (name === "report") loadReport();
  }
  // 現在のモードに応じた議題名を取得
  function getMeetingTitle() {
    var el = (rReturnTab === "list") ? listTitleInput : meetingTitleInput;
    return el ? el.value.trim() : "";
  }

  // ---- メモ帳（共有付箋ボード）----
  function apiGet(action, qs) {
    return fetch(API + "?action=" + action + (qs || "")).then(function (r) { return r.json(); });
  }
  function apiPost(action, body) {
    return fetch(API + "?action=" + action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); });
  }
  function catColor(key) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].key === key) return CATS[i].color;
    return "#6b7280";
  }
  function catTint(hex) {
    var r = parseInt(hex.substr(1, 2), 16);
    var g = parseInt(hex.substr(3, 2), 16);
    var b = parseInt(hex.substr(5, 2), 16);
    return "rgba(" + r + "," + g + "," + b + ",0.16)";
  }
  function buildCatChips() {
    catChipsEl.innerHTML = "";
    CATS.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cat-chip" + (c.key === memoCat ? " active" : "");
      b.textContent = c.key;
      b.style.background = c.color;
      b.addEventListener("click", function () { memoCat = c.key; buildCatChips(); noteInput.focus(); });
      catChipsEl.appendChild(b);
    });
  }
  function openBoard(code) {
    apiGet("get_board", "&code=" + encodeURIComponent(code)).then(function (res) {
      if (!res || res.error) {
        memoTabError.hidden = false;
        return;
      }
      memoTabError.hidden = true;
      memoCode = code;
      memoTeamEl.textContent = res.board.team_label;
      memoCodeEl.textContent = "No. " + res.board.code;
      rosterText.value = (res.board.roster != null && res.board.roster !== "")
        ? res.board.roster : buildRosterTemplate();
      memoCat = CATS[0].key;
      buildCatChips();
      renderNotes(res.notes);
      memoView.hidden = false;
      try { location.hash = "memo=" + code; } catch (e) {}
      if (memoTimer) clearInterval(memoTimer);
      memoTimer = setInterval(refreshBoard, 4000); // 他端末の更新を取り込む
    }).catch(function () {
      window.alert("接続できませんでした。メモ機能はサーバー版（Xserver）で利用してください。");
    });
  }
  function refreshBoard() {
    if (!memoCode) return;
    apiGet("get_board", "&code=" + encodeURIComponent(memoCode)).then(function (res) {
      if (res && res.notes) renderNotes(res.notes);
      // 記入中でなければ他端末の更新を反映
      if (res && res.board && document.activeElement !== rosterText) {
        var v = res.board.roster != null ? res.board.roster : "";
        if (v !== rosterText.value) rosterText.value = v;
      }
    }).catch(function () {});
  }
  function buildRosterTemplate() {
    var lines = roles.map(function (r) { return r + "："; });
    lines.push("メンバー：");
    return lines.join("\n");
  }
  function saveRoster() {
    if (!memoCode) return;
    apiPost("save_roster", { code: memoCode, roster: rosterText.value }).then(function () {
      if (rosterSaved) {
        rosterSaved.hidden = false;
        setTimeout(function () { rosterSaved.hidden = true; }, 1500);
      }
    }).catch(function () {});
  }
  function renderNotes(notes) {
    memoBoardEl.innerHTML = "";
    memoEmptyEl.hidden = notes.length > 0;
    notes.forEach(function (n) {
      var color = catColor(n.category);
      var card = document.createElement("div");
      card.className = "sticky";
      card.style.background = catTint(color);
      card.style.borderLeftColor = color;

      var del = document.createElement("button");
      del.type = "button";
      del.className = "sticky-del";
      del.textContent = "×";
      (function (id) { del.addEventListener("click", function () { deleteNote(id); }); })(n.id);

      var cat = document.createElement("span");
      cat.className = "sticky-cat";
      cat.textContent = n.category;
      cat.style.color = color;

      var body = document.createElement("div");
      body.className = "sticky-body";
      body.textContent = n.body;

      var meta = document.createElement("div");
      meta.className = "sticky-meta";
      var when = n.created_at ? String(n.created_at).substring(5, 16) : "";
      meta.textContent = (n.author ? n.author + " · " : "") + when;

      card.appendChild(del);
      card.appendChild(cat);
      card.appendChild(body);
      card.appendChild(meta);
      memoBoardEl.appendChild(card);
    });
  }
  function addNote() {
    var text = noteInput.value.trim();
    if (!text || !memoCode) return;
    apiPost("add_note", { code: memoCode, category: memoCat, body: text }).then(function (res) {
      if (res && res.note) { noteInput.value = ""; refreshBoard(); }
      else window.alert("保存に失敗しました");
    }).catch(function () { window.alert("保存に失敗しました（接続不可）"); });
  }
  function deleteNote(id) {
    if (!window.confirm("この付箋を削除しますか？")) return;
    apiPost("delete_note", { code: memoCode, id: id }).then(function () { refreshBoard(); }).catch(function () {});
  }
  function closeBoard() {
    if (memoTimer) { clearInterval(memoTimer); memoTimer = null; }
    memoCode = null;
    memoView.hidden = true;
    try { if (String(location.hash).indexOf("memo=") >= 0) location.hash = ""; } catch (e) {}
  }
  function exportCsv() {
    if (memoCode) window.open(API + "?action=export_csv&code=" + encodeURIComponent(memoCode), "_blank");
  }

  // ---- 集計（タブ） ----
  function loadReport() {
    reportDetail.hidden = true;
    reportDetail.innerHTML = "";
    reportListEl.innerHTML = '<p class="empty-message">読み込み中…</p>';
    apiGet("list_meetings").then(function (res) {
      if (!res || !res.meetings) {
        reportListEl.innerHTML = '<p class="empty-message">取得できませんでした（メモ機能はサーバー版で利用してください）。</p>';
        return;
      }
      renderMeetings(res.meetings);
    }).catch(function () {
      reportListEl.innerHTML = '<p class="empty-message">接続できませんでした（メモ機能はサーバー版で利用してください）。</p>';
    });
  }
  function renderMeetings(list) {
    reportListEl.innerHTML = "";
    var h = document.createElement("h3");
    h.textContent = "ミーティング一覧（議題ごとに分かれています）";
    reportListEl.appendChild(h);
    if (list.length === 0) {
      var e = document.createElement("p");
      e.className = "empty-message";
      e.textContent = "まだ集計できるデータがありません。";
      reportListEl.appendChild(e);
      return;
    }
    list.forEach(function (m) {
      var item = document.createElement("div");
      item.className = "report-item";
      var info = document.createElement("div");
      var t = document.createElement("div");
      t.className = "ri-title";
      t.textContent = (m.title && String(m.title).trim()) ? m.title : "(無題)";
      var sub = document.createElement("div");
      sub.className = "ri-sub";
      var date = m.created_at ? String(m.created_at).substring(0, 16) : "";
      sub.textContent = date + " ／ " + m.team_count + "チーム ／ " + m.note_count + "メモ";
      info.appendChild(t);
      info.appendChild(sub);

      var btns = document.createElement("div");
      btns.className = "report-item-btns";
      var view = document.createElement("button");
      view.className = "btn btn-primary";
      view.textContent = "集計を見る";
      var csv = document.createElement("button");
      csv.className = "btn btn-secondary";
      csv.textContent = "CSV";
      (function (id) {
        view.addEventListener("click", function () { openAggregate(id); });
        csv.addEventListener("click", function () {
          window.open(API + "?action=export_csv&meeting=" + encodeURIComponent(id), "_blank");
        });
      })(m.meeting_id);
      btns.appendChild(view);
      btns.appendChild(csv);

      item.appendChild(info);
      item.appendChild(btns);
      reportListEl.appendChild(item);
    });
  }
  function openAggregate(meetingId) {
    apiGet("aggregate", "&meeting=" + encodeURIComponent(meetingId)).then(function (a) {
      if (!a || a.error) return;
      renderAggregate(a);
    }).catch(function () {});
  }
  function bar(label, cnt, max, color) {
    var row = document.createElement("div");
    row.className = "bar-row";
    var lab = document.createElement("span");
    lab.className = "bar-label";
    lab.textContent = label;
    var track = document.createElement("span");
    track.className = "bar-track";
    var fill = document.createElement("span");
    fill.className = "bar-fill";
    fill.style.width = Math.round((cnt / max) * 100) + "%";
    fill.style.background = color;
    track.appendChild(fill);
    var val = document.createElement("span");
    val.className = "bar-val";
    val.textContent = cnt;
    row.appendChild(lab);
    row.appendChild(track);
    row.appendChild(val);
    return row;
  }
  function renderAggregate(a) {
    reportDetail.hidden = false;
    reportDetail.innerHTML = "";
    var h = document.createElement("h3");
    h.textContent = "📊 " + ((a.title && String(a.title).trim()) ? a.title : "(無題)") + " の集計";
    reportDetail.appendChild(h);
    var meta = document.createElement("p");
    meta.className = "hint";
    var date = a.created_at ? String(a.created_at).substring(0, 16) : "";
    meta.textContent = date + " ／ " + a.team_count + "チーム ／ 合計 " + a.total_notes + "メモ";
    reportDetail.appendChild(meta);

    var ch = document.createElement("h4");
    ch.textContent = "カテゴリ別";
    reportDetail.appendChild(ch);
    if (a.by_category.length === 0) {
      var e = document.createElement("p");
      e.className = "empty-message";
      e.textContent = "メモがありません。";
      reportDetail.appendChild(e);
    } else {
      var maxC = 1;
      a.by_category.forEach(function (c) { if (+c.cnt > maxC) maxC = +c.cnt; });
      a.by_category.forEach(function (c) {
        reportDetail.appendChild(bar(c.category, +c.cnt, maxC, catColor(c.category)));
      });
    }

    var th = document.createElement("h4");
    th.textContent = "チーム別";
    reportDetail.appendChild(th);
    var maxT = 1;
    a.by_team.forEach(function (t) { if (+t.cnt > maxT) maxT = +t.cnt; });
    a.by_team.forEach(function (t) {
      reportDetail.appendChild(bar(t.team_label, +t.cnt, maxT, "#4f6ef7"));
    });

    var csv = document.createElement("button");
    csv.className = "btn btn-secondary";
    csv.textContent = "このミーティングのCSVを出力";
    csv.style.marginTop = "16px";
    (function (id) {
      csv.addEventListener("click", function () {
        window.open(API + "?action=export_csv&meeting=" + encodeURIComponent(id), "_blank");
      });
    })(a.meeting_id);
    reportDetail.appendChild(csv);
    reportDetail.scrollIntoView({ behavior: "smooth", block: "start" });
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

  rStartBtn.addEventListener("click", startRoulette);
  listStartBtn.addEventListener("click", startListRoulette);
  revealBtn.addEventListener("click", onReveal);
  nextBtn.addEventListener("click", nextStep);
  abortBtn.addEventListener("click", exitStage);
  againBtn.addEventListener("click", function () {
    rAssignments = computeAssignments(rLabels.length, rTeamCount, rUseRoles);
    rCurrent = 0;
    summaryCard.hidden = true;
    stageCard.hidden = false;
    revealStep(0);
  });
  backBtn.addEventListener("click", exitStage);

  // メモ機能
  makeMemoBtn.addEventListener("click", makeMemo);
  memoTabForm.addEventListener("submit", function (e) {
    e.preventDefault();
    memoTabError.hidden = true;
    var c = memoTabInput.value.trim();
    if (c) openBoard(c);
  });
  noteForm.addEventListener("submit", function (e) { e.preventDefault(); addNote(); });
  rosterText.addEventListener("blur", saveRoster);
  memoCsvBtn.addEventListener("click", exportCsv);
  memoCloseBtn.addEventListener("click", closeBoard);

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
  buildCatChips();
  // 共有リンク（#memo=番号）で直接メモ帳を開く
  (function () {
    var m = String(location.hash || "").match(/memo=([0-9]+)/);
    if (m) openBoard(m[1]);
  })();
})();
