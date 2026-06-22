(function () {
  "use strict";

  var STORAGE_KEY = "team-division-members";
  var ROLES_KEY = "team-division-roles";
  var DEFAULT_ROLES = ["書記", "発表", "司会", "タイムキーパー"];

  // メモ機能（共有付箋ボード）
  var API = "api/api.php"; // Xserver上の同じ場所のapiフォルダを想定
  var CATS_KEY = "team-division-cats";
  var DEFAULT_CATS = ["意見", "質問", "アイデア", "感想", "その他"]; // 中立なラベル
  var cats = loadCats();                 // 設定用（議題作成時に送る・議題ごとに編集可）
  var mCats = DEFAULT_CATS.slice();      // 今開いているボードのラベル
  var memoCode = null;
  var memoCat = mCats[0];
  var memoTimer = null;

  // ---- 状態 ----
  var members = loadMembers();
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
  var catsInput = document.getElementById("cats-input");
  var reportListEl = document.getElementById("report-list");
  var reportDetail = document.getElementById("report-detail");
  var empForm = document.getElementById("emp-form");
  var empName = document.getElementById("emp-name");
  var empAge = document.getElementById("emp-age");
  var empListEl = document.getElementById("emp-list");
  var empEmpty = document.getElementById("emp-empty");
  var empDatalist = document.getElementById("emp-datalist");
  var employees = [];
  var groupSelect = document.getElementById("group-select");
  var groupLoadBtn = document.getElementById("group-load");
  var groupDeleteBtn = document.getElementById("group-delete");
  var groupSaveBtn = document.getElementById("group-save");
  var groups = [];
  var openEmpBtn = document.getElementById("open-emp");
  var empModal = document.getElementById("emp-modal");
  var empClose = document.getElementById("emp-close");
  var empBackdrop = document.getElementById("emp-backdrop");
  var openHelpBtn = document.getElementById("open-help");
  var helpModal = document.getElementById("help-modal");
  var helpClose = document.getElementById("help-close");
  var helpBackdrop = document.getElementById("help-backdrop");

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

  function loadCats() {
    try {
      var raw = localStorage.getItem(CATS_KEY);
      if (raw === null) return DEFAULT_CATS.slice();
      var arr = JSON.parse(raw);
      return (Array.isArray(arr) && arr.length) ? arr : DEFAULT_CATS.slice();
    } catch (e) {
      return DEFAULT_CATS.slice();
    }
  }
  function saveCats() {
    try { localStorage.setItem(CATS_KEY, JSON.stringify(cats)); } catch (e) {}
  }
  function parseCats(text) {
    return text.split(/[\n,、，]+/).map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });
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

  // 名前から年齢を引く（社員一覧から）。無ければ null
  function ageOfName(name) {
    for (var i = 0; i < employees.length; i++) {
      if (employees[i].name === name) {
        var a = employees[i].age;
        return (a === null || a === undefined || a === "") ? null : Number(a);
      }
    }
    return null;
  }

  // チーム割り当て。年齢が分かる人は、できるだけ同じ年齢が同チームに偏らないよう分散（ベストエフォート）。
  function assignTeams(count, teamCount) {
    // 年齢が一つも分からなければ従来どおり完全ランダム
    var ages = [];
    var hasAge = false;
    for (var p = 0; p < count; p++) {
      var a = (rLabels && rLabels[p] != null) ? ageOfName(rLabels[p]) : null;
      ages.push(a);
      if (a !== null) hasAge = true;
    }
    if (!hasAge) {
      var rnd = [];
      for (var i = 0; i < count; i++) rnd.push(i % teamCount);
      rnd = shuffle(rnd);
      return rnd;
    }
    // 年齢順に並べて（同年齢はランダム）、チームへ順番に配る＝近い年齢が別チームに散る
    var withAge = [], noAge = [];
    for (var q = 0; q < count; q++) (ages[q] !== null ? withAge : noAge).push(q);
    withAge = shuffle(withAge).sort(function (x, y) { return ages[x] - ages[y]; });
    noAge = shuffle(noAge);
    var order = withAge.concat(noAge);
    var teamOf = new Array(count);
    var start = Math.floor(Math.random() * teamCount); // 毎回少し変える
    order.forEach(function (pi, k) { teamOf[pi] = (start + k) % teamCount; });
    return teamOf;
  }

  // 人数・チーム数・役割から、全員分の割り当てを事前計算する
  function computeAssignments(count, teamCount, useRoles) {
    var p, t;
    var teamOf = assignTeams(count, teamCount);

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
    apiPost("create_boards", { title: title, teams: labels, roles: roles, categories: cats })
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
    apiPost("create_boards", { title: title, teams: labels, roles: roles, categories: cats }).then(function (res) {
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
    if (name === "list") { loadEmployees(); loadGroups(); }
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
  // ラベル名から色を生成（固定表ではなく文字列ハッシュ＝任意のラベルに対応）
  function catHue(key) {
    var h = 0;
    for (var i = 0; i < String(key).length; i++) h = (h * 31 + String(key).charCodeAt(i)) % 360;
    return h;
  }
  function catColor(key) { return "hsl(" + catHue(key) + ", 55%, 42%)"; }
  function catTint(key) { return "hsla(" + catHue(key) + ", 55%, 45%, 0.16)"; }
  function buildCatChips() {
    catChipsEl.innerHTML = "";
    mCats.forEach(function (key) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cat-chip" + (key === memoCat ? " active" : "");
      b.textContent = key;
      b.style.background = catColor(key);
      b.addEventListener("click", function () { memoCat = key; buildCatChips(); noteInput.focus(); });
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
      memoTeamEl.textContent = res.board.team_label; // ヘッダーにはチーム名を表示
      memoCodeEl.textContent = "No. " + res.board.code;
      rosterText.value = (res.board.roster != null && res.board.roster !== "")
        ? res.board.roster : buildRosterTemplate();
      mCats = (res.categories && res.categories.length) ? res.categories : DEFAULT_CATS.slice();
      memoCat = mCats[0];
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
      card.style.background = catTint(n.category);
      card.style.borderLeftColor = color;

      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "sticky-edit";
      edit.textContent = "✎";
      edit.title = "編集";
      var del = document.createElement("button");
      del.type = "button";
      del.className = "sticky-del";
      del.textContent = "×";
      (function (note) {
        edit.addEventListener("click", function () { editNote(note); });
        del.addEventListener("click", function () { deleteNote(note.id); });
      })(n);

      var cat = document.createElement("span");
      cat.className = "sticky-cat";
      cat.textContent = n.category;
      cat.style.color = color;

      var body = document.createElement("div");
      body.className = "sticky-body";
      body.textContent = n.body;

      var meta = document.createElement("div");
      meta.className = "sticky-meta";
      meta.textContent = n.created_at ? String(n.created_at).substring(5, 16) : "";

      card.appendChild(edit);
      card.appendChild(del);
      card.appendChild(cat);
      card.appendChild(body);
      card.appendChild(meta);
      memoBoardEl.appendChild(card);
    });
  }
  function editNote(note) {
    var body = window.prompt("付箋の内容を編集", note.body);
    if (body === null) return;
    body = body.trim();
    if (body === "") return;
    apiPost("update_note", { code: memoCode, id: note.id, body: body }).then(function (res) {
      if (res && res.ok) refreshBoard();
      else window.alert("更新に失敗しました" + (res && res.error ? "：" + res.error : ""));
    }).catch(function () { window.alert("更新に失敗しました（接続不可）"); });
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
        var msg = (res && res.error)
          ? "取得できませんでした：" + res.error
          : "取得できませんでした（メモ機能はサーバー版で利用してください）。";
        reportListEl.innerHTML = '<p class="empty-message"></p>';
        reportListEl.firstChild.textContent = msg;
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

      // 各チームの番号（再確認）＋ボードを開いて確認・修正
      if (m.boards && m.boards.length) {
        var codes = document.createElement("div");
        codes.className = "ri-codes";
        m.boards.forEach(function (b) {
          var row = document.createElement("div");
          row.className = "code-row";
          var nm = document.createElement("span");
          nm.className = "code-team";
          nm.textContent = b.team_label;
          var num = document.createElement("span");
          num.className = "code-num";
          num.textContent = "No. " + b.code;
          var open = document.createElement("button");
          open.type = "button";
          open.className = "btn btn-secondary";
          open.textContent = "開く";
          (function (code) { open.addEventListener("click", function () { openBoard(code); }); })(b.code);
          row.appendChild(nm);
          row.appendChild(num);
          row.appendChild(open);
          codes.appendChild(row);
        });
        reportListEl.appendChild(codes);
      }
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

    // カテゴリ別の意見（本文）一覧 ＝ 同じ議題の全チーム分を合算
    if (a.notes && a.notes.length) {
      var oh = document.createElement("h4");
      oh.textContent = "意見一覧（全チーム合算）";
      reportDetail.appendChild(oh);
      // 出現するカテゴリを件数順に（by_category）。漏れがあれば末尾に。
      var catOrder = a.by_category.map(function (c) { return c.category; });
      a.notes.forEach(function (n) { if (catOrder.indexOf(n.category) < 0) catOrder.push(n.category); });
      catOrder.forEach(function (key) {
        var items = a.notes.filter(function (n) { return n.category === key; });
        if (!items.length) return;
        var head = document.createElement("div");
        head.className = "op-head";
        head.textContent = key + "（" + items.length + "）";
        head.style.color = catColor(key);
        reportDetail.appendChild(head);
        items.forEach(function (n) {
          var item = document.createElement("div");
          item.className = "op-item";
          item.style.borderLeftColor = catColor(key);
          item.textContent = n.body;
          reportDetail.appendChild(item);
        });
      });
    }

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

  // ---- 社員一覧 ----
  function loadEmployees() {
    apiGet("list_employees").then(function (res) {
      if (res && res.employees) {
        employees = res.employees;
        renderEmployees();
        renderEmpDatalist();
      } else if (empEmpty) {
        empEmpty.textContent = "取得できませんでした" + (res && res.error ? "：" + res.error : "（サーバー版で利用してください）");
        empEmpty.hidden = false;
      }
    }).catch(function () {
      if (empEmpty) {
        empEmpty.textContent = "接続できませんでした（メモ機能はサーバー版で利用してください）。";
        empEmpty.hidden = false;
      }
    });
  }
  function renderEmpDatalist() {
    if (!empDatalist) return;
    empDatalist.innerHTML = "";
    employees.forEach(function (e) {
      var opt = document.createElement("option");
      opt.value = e.name;
      if (e.age !== null && e.age !== undefined && e.age !== "") opt.label = e.name + "（" + e.age + "）";
      empDatalist.appendChild(opt);
    });
  }
  function renderEmployees() {
    empListEl.innerHTML = "";
    empEmpty.hidden = employees.length > 0;
    employees.forEach(function (e) {
      var li = document.createElement("li");
      var name = document.createElement("span");
      name.className = "emp-name";
      name.textContent = e.name;
      var age = document.createElement("span");
      age.className = "emp-age";
      age.textContent = (e.age !== null && e.age !== undefined && e.age !== "") ? e.age + "歳" : "—";
      var add = document.createElement("button");
      add.type = "button";
      add.className = "btn btn-primary";
      add.textContent = "＋メンバー";
      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "btn btn-secondary";
      edit.textContent = "編集";
      var del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-text";
      del.textContent = "削除";
      (function (emp) {
        add.addEventListener("click", function () { addMembers(emp.name); });
        edit.addEventListener("click", function () { editEmployee(emp); });
        del.addEventListener("click", function () { deleteEmployee(emp); });
      })(e);
      li.appendChild(name);
      li.appendChild(age);
      li.appendChild(add);
      li.appendChild(edit);
      li.appendChild(del);
      empListEl.appendChild(li);
    });
  }
  function saveEmployee(payload) {
    apiPost("save_employee", payload).then(function (res) {
      if (res && res.employee) loadEmployees();
      else window.alert("保存に失敗しました" + (res && res.error ? "：" + res.error : ""));
    }).catch(function () { window.alert("保存に失敗しました（接続不可）"); });
  }
  function addEmployeeFromForm() {
    var name = empName.value.trim();
    if (!name) return;
    var age = empAge.value.trim();
    saveEmployee({ name: name, age: age });
    empName.value = "";
    empAge.value = "";
    empName.focus();
  }
  function editEmployee(emp) {
    var name = window.prompt("名前", emp.name);
    if (name === null) return;
    name = name.trim();
    if (!name) return;
    var ageStr = window.prompt("年齢（空欄可）", (emp.age !== null && emp.age !== undefined) ? emp.age : "");
    if (ageStr === null) return;
    saveEmployee({ id: emp.id, name: name, age: ageStr.trim() });
  }
  function deleteEmployee(emp) {
    if (!window.confirm("「" + emp.name + "」を社員一覧から削除しますか？")) return;
    apiPost("delete_employee", { id: emp.id }).then(function () { loadEmployees(); }).catch(function () {});
  }

  // ---- 保存グループ ----
  function loadGroups() {
    apiGet("list_groups").then(function (res) {
      if (res && res.groups) {
        groups = res.groups;
        renderGroupSelect();
      }
    }).catch(function () {});
  }
  function renderGroupSelect() {
    if (!groupSelect) return;
    var cur = groupSelect.value;
    groupSelect.innerHTML = "";
    var ph = document.createElement("option");
    ph.value = "";
    ph.textContent = groups.length ? "保存グループを選択…" : "保存グループはありません";
    groupSelect.appendChild(ph);
    groups.forEach(function (g) {
      var opt = document.createElement("option");
      opt.value = String(g.id);
      opt.textContent = g.name + "（" + g.members.length + "人）";
      groupSelect.appendChild(opt);
    });
    groupSelect.value = cur;
  }
  function saveGroup() {
    if (members.length === 0) { window.alert("保存するメンバーがいません。"); return; }
    var name = window.prompt("グループ名を入力してください（例: 営業部）", "");
    if (name === null) return;
    name = name.trim();
    if (!name) return;
    apiPost("save_group", { name: name, members: members }).then(function (res) {
      if (res && res.group) loadGroups();
      else window.alert("保存に失敗しました" + (res && res.error ? "：" + res.error : "（サーバー版で利用してください）"));
    }).catch(function () { window.alert("保存に失敗しました（接続不可）"); });
  }
  function loadGroup() {
    var id = groupSelect.value;
    if (!id) return;
    var g = groups.filter(function (x) { return String(x.id) === id; })[0];
    if (!g) return;
    if (members.length > 0 && !window.confirm("現在のメンバーを「" + g.name + "」で置き換えますか？")) return;
    members = g.members.slice();
    saveMembers();
    renderMembers();
  }
  function deleteGroupSel() {
    var id = groupSelect.value;
    if (!id) return;
    var g = groups.filter(function (x) { return String(x.id) === id; })[0];
    if (!g) return;
    if (!window.confirm("グループ「" + g.name + "」を削除しますか？")) return;
    apiPost("delete_group", { id: g.id }).then(function () { loadGroups(); }).catch(function () {});
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
  empForm.addEventListener("submit", function (e) { e.preventDefault(); addEmployeeFromForm(); });
  groupSaveBtn.addEventListener("click", saveGroup);
  groupLoadBtn.addEventListener("click", loadGroup);
  groupDeleteBtn.addEventListener("click", deleteGroupSel);
  catsInput.addEventListener("change", function () {
    var parsed = parseCats(catsInput.value);
    cats = parsed.length ? parsed : DEFAULT_CATS.slice();
    saveCats();
    catsInput.value = cats.join("、");
  });
  openEmpBtn.addEventListener("click", function () { empModal.hidden = false; loadEmployees(); });
  empClose.addEventListener("click", function () { empModal.hidden = true; });
  empBackdrop.addEventListener("click", function () { empModal.hidden = true; });
  openHelpBtn.addEventListener("click", function () { helpModal.hidden = false; });
  helpClose.addEventListener("click", function () { helpModal.hidden = true; });
  helpBackdrop.addEventListener("click", function () { helpModal.hidden = true; });
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

  roleForm.addEventListener("submit", function (e) {
    e.preventDefault();
    addRole(roleNameInput.value);
    roleNameInput.value = "";
    roleNameInput.focus();
  });

  clearBtn.addEventListener("click", clearMembers);
  modeRadios.forEach(function (r) {
    r.addEventListener("change", updateUnit);
  });

  // ---- 初期化 ----
  renderMembers();
  renderRoles();
  updateUnit();
  if (catsInput) catsInput.value = cats.join("、");
  buildCatChips();
  loadEmployees(); // メンバー登録の検索プルダウン用に社員一覧を読み込む（サーバー版のみ）
  loadGroups();
  // 共有リンク（#memo=番号）で直接メモ帳を開く
  (function () {
    var m = String(location.hash || "").match(/memo=([0-9]+)/);
    if (m) openBoard(m[1]);
  })();
})();
