(function () {
  "use strict";

  var STORAGE_KEY = "team-division-members";
  var SAVED_KEY = "team-division-saved";
  var ROLES_KEY = "team-division-roles";
  var MEMOS_KEY = "team-division-memos";
  var DEFAULT_ROLES = ["書記", "発表", "司会", "タイムキーパー"];

  // 5W1H（CSVのelement_keyは英語、画面ラベルは日本語）。
  var W5H1 = [
    { key: "when", label: "いつ (When)" },
    { key: "where", label: "どこで (Where)" },
    { key: "who", label: "だれが (Who)" },
    { key: "what", label: "なにを (What)" },
    { key: "why", label: "なぜ (Why)" },
    { key: "how", label: "どうやって (How)" },
    { key: "notes", label: "備考 (Notes)" }
  ];

  // ---- 状態 ----
  var members = loadMembers();
  var savedLists = loadSaved(); // { 名前: [メンバー...] }
  var roles = loadRoles(); // 役割名の配列
  var memos = loadMemos(); // { "チーム番号": {when,where,...,notes} }
  var lastDivision = null; // 再シャッフル用に直近の設定を保持
  var currentTeams = []; // 直近のチーム分け結果（メモ・CSV・ルーレットで参照）

  // 1人ずつ抽選（ルーレット）の状態
  var rouletteQueue = []; // [{ name, team }] をシャッフルした順
  var rouletteIndex = -1;
  var rouletteSpinning = false;

  // ---- DOM ----
  var form = document.getElementById("member-form");
  var nameInput = document.getElementById("member-name");
  var listEl = document.getElementById("member-list");
  var countEl = document.getElementById("member-count");
  var emptyMsg = document.getElementById("empty-message");
  var clearBtn = document.getElementById("clear-members");
  var sizeInput = document.getElementById("size-input");
  var sizeUnit = document.getElementById("size-unit");
  var divideBtn = document.getElementById("divide-btn");
  var resultCard = document.getElementById("result-card");
  var resultEl = document.getElementById("result");
  var reshuffleBtn = document.getElementById("reshuffle-btn");
  var modeRadios = document.querySelectorAll('input[name="mode"]');
  var saveForm = document.getElementById("save-form");
  var saveNameInput = document.getElementById("save-name");
  var savedListEl = document.getElementById("saved-list");
  var savedEmpty = document.getElementById("saved-empty");
  var roleForm = document.getElementById("role-form");
  var roleNameInput = document.getElementById("role-name");
  var roleListEl = document.getElementById("role-list");
  var roleEmpty = document.getElementById("role-empty");
  var roleEnabled = document.getElementById("role-enabled");

  // ルーレット
  var rouletteCard = document.getElementById("roulette-card");
  var rouletteDisplay = document.getElementById("roulette-display");
  var rouletteProgress = document.getElementById("roulette-progress");
  var rouletteDrawBtn = document.getElementById("roulette-draw");
  var rouletteNextBtn = document.getElementById("roulette-next");
  var rouletteResetBtn = document.getElementById("roulette-reset");
  var voiceEnabled = document.getElementById("voice-enabled");

  // メモ
  var memoCard = document.getElementById("memo-card");
  var memoListEl = document.getElementById("memo-list");
  var memoTeamInput = document.getElementById("memo-team-input");
  var memoOpenBtn = document.getElementById("memo-open");
  var exportCsvBtn = document.getElementById("export-csv");

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

  // チーム番号に対応するメモオブジェクトを取得（なければ作成）
  function getMemo(teamNumber) {
    var key = String(teamNumber);
    if (!memos[key]) memos[key] = {};
    return memos[key];
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

  function renderRoles() {
    roleListEl.innerHTML = "";
    roleEmpty.hidden = roles.length > 0;

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
      roleListEl.appendChild(li);
    });
  }

  // 各メンバーへ役割を割り当てる。役割数がメンバー数より多い場合は兼任。
  function assignRoles(teamMembers) {
    var assignment = teamMembers.map(function () { return []; });
    if (!roleEnabled.checked || roles.length === 0 || teamMembers.length === 0) {
      return assignment;
    }
    var shuffledRoles = shuffle(roles);
    shuffledRoles.forEach(function (role, i) {
      assignment[i % teamMembers.length].push(role);
    });
    return assignment;
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
    sizeUnit.textContent = getMode() === "perTeam" ? "人 / チーム" : "チーム";
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

  // 指定したチーム数に、できるだけ均等に振り分ける
  function splitIntoTeams(names, teamCount) {
    var shuffled = shuffle(names);
    var teams = [];
    for (var i = 0; i < teamCount; i++) teams.push([]);
    // 1人ずつ順番に配ることで人数差を最大1人に抑える
    shuffled.forEach(function (name, i) {
      teams[i % teamCount].push(name);
    });
    return teams;
  }

  function divide() {
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
    var teamCount;
    if (mode === "perTeam") {
      teamCount = Math.ceil(members.length / value);
    } else {
      teamCount = Math.min(value, members.length);
    }

    lastDivision = { mode: mode, value: value, teamCount: teamCount };
    renderTeams(splitIntoTeams(members, teamCount));
  }

  function reshuffle() {
    if (!lastDivision) return;
    renderTeams(splitIntoTeams(members, lastDivision.teamCount));
  }

  function renderTeams(teams) {
    currentTeams = teams;
    resultEl.innerHTML = "";
    teams.forEach(function (team, i) {
      var div = document.createElement("div");
      div.className = "team";

      var title = document.createElement("div");
      title.className = "team-title";
      var nameSpan = document.createElement("span");
      nameSpan.textContent = "チーム " + (i + 1);
      var countSpan = document.createElement("span");
      countSpan.className = "count";
      countSpan.textContent = team.length + "人";
      title.appendChild(nameSpan);
      title.appendChild(countSpan);

      var assignment = assignRoles(team);
      var ol = document.createElement("ol");
      team.forEach(function (name, idx) {
        var li = document.createElement("li");
        li.appendChild(document.createTextNode(name));
        if (assignment[idx].length > 0) {
          var tag = document.createElement("span");
          tag.className = "role-tag";
          tag.textContent = assignment[idx].join(" / ");
          li.appendChild(tag);
        }
        ol.appendChild(li);
      });

      div.appendChild(title);
      div.appendChild(ol);
      resultEl.appendChild(div);
    });

    resultCard.hidden = false;

    // ルーレット・メモも結果に合わせて更新
    setupRoulette(teams);
    renderMemos(teams);
    rouletteCard.hidden = false;
    memoCard.hidden = false;

    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---- 共通ユーティリティ ----
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ---- 1人ずつ抽選（ルーレット） ----
  function speak(text) {
    if (!voiceEnabled.checked) return;
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP";
      u.rate = 1.0;
      window.speechSynthesis.speak(u);
    } catch (e) {
      /* 読み上げ失敗は無視 */
    }
  }

  function setupRoulette(teams) {
    rouletteQueue = [];
    teams.forEach(function (team, i) {
      team.forEach(function (name) {
        rouletteQueue.push({ name: name, team: i + 1 });
      });
    });
    rouletteQueue = shuffle(rouletteQueue);
    resetRoulette();
  }

  function resetRoulette() {
    rouletteIndex = -1;
    rouletteSpinning = false;
    rouletteDisplay.className = "roulette-display";
    rouletteDisplay.textContent = "？";
    rouletteProgress.textContent =
      rouletteQueue.length > 0
        ? "全 " + rouletteQueue.length + " 人を1人ずつ発表します"
        : "メンバーがいません";
    rouletteDrawBtn.hidden = false;
    rouletteDrawBtn.disabled = rouletteQueue.length === 0;
    rouletteNextBtn.hidden = true;
  }

  // 次の人を抽選（前の人の結果はこの時点で消えている）
  function rouletteDraw() {
    if (rouletteSpinning) return;
    if (rouletteIndex + 1 >= rouletteQueue.length) return;

    rouletteIndex++;
    var entry = rouletteQueue[rouletteIndex];
    rouletteSpinning = true;
    rouletteDrawBtn.hidden = true;
    rouletteNextBtn.hidden = true;

    var teamCount = currentTeams.length || 1;
    var ticks = 0;
    var maxTicks = 16;
    rouletteDisplay.className = "roulette-display spinning";
    var timer = setInterval(function () {
      var t = Math.floor(Math.random() * teamCount) + 1;
      rouletteDisplay.textContent = "チーム " + t;
      ticks++;
      if (ticks >= maxTicks) {
        clearInterval(timer);
        revealRoulette(entry);
      }
    }, 80);
  }

  function revealRoulette(entry) {
    rouletteSpinning = false;
    rouletteDisplay.className = "roulette-display revealed";
    rouletteDisplay.innerHTML =
      '<span class="r-name">' +
      escapeHtml(entry.name) +
      '</span><span class="r-team">チーム ' +
      entry.team +
      "</span>";
    speak(entry.name + " さんは、チーム" + entry.team + " です");

    var isLast = rouletteIndex + 1 >= rouletteQueue.length;
    rouletteProgress.textContent =
      rouletteIndex + 1 + " / " + rouletteQueue.length + " 人目" +
      (isLast ? "（全員終了）" : "");
    rouletteNextBtn.hidden = isLast;
  }

  // 「次の人へ」：前の人の結果を隠してから抽選待ちに戻す
  function rouletteNext() {
    rouletteDisplay.className = "roulette-display";
    rouletteDisplay.textContent = "？";
    rouletteNextBtn.hidden = true;
    rouletteDrawBtn.hidden = false;
  }

  // ---- チームメモ（5W1H） ----
  function renderMemos(teams) {
    memoListEl.innerHTML = "";
    teams.forEach(function (team, i) {
      memoListEl.appendChild(buildMemoTeam(i + 1, team));
    });
  }

  function buildMemoTeam(teamNumber, team) {
    var memo = getMemo(teamNumber);

    var wrap = document.createElement("div");
    wrap.className = "memo-team";
    wrap.id = "memo-team-" + teamNumber;

    var head = document.createElement("div");
    head.className = "memo-team-head";
    var title = document.createElement("div");
    title.className = "memo-team-title";
    var nameSpan = document.createElement("span");
    nameSpan.textContent = "チーム " + teamNumber + "（番号: " + teamNumber + "）";
    var countSpan = document.createElement("span");
    countSpan.textContent = team.length + "人";
    title.appendChild(nameSpan);
    title.appendChild(countSpan);
    var membersEl = document.createElement("div");
    membersEl.className = "memo-team-members";
    membersEl.textContent = "メンバー: " + (team.join("、") || "（なし）");
    head.appendChild(title);
    head.appendChild(membersEl);

    var grid = document.createElement("div");
    grid.className = "memo-grid";
    W5H1.forEach(function (el) {
      var cell = document.createElement("div");
      cell.className = "memo-cell";
      var label = document.createElement("label");
      var fieldId = "memo-" + teamNumber + "-" + el.key;
      label.textContent = el.label;
      label.setAttribute("for", fieldId);
      var ta = document.createElement("textarea");
      ta.id = fieldId;
      ta.value = memo[el.key] || "";
      ta.addEventListener("input", function () {
        getMemo(teamNumber)[el.key] = ta.value;
        saveMemos();
      });
      cell.appendChild(label);
      cell.appendChild(ta);
      grid.appendChild(cell);
    });

    wrap.appendChild(head);
    wrap.appendChild(grid);
    return wrap;
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
    // 再生のためリフロー
    void el.offsetWidth;
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

  function exportCsv() {
    if (currentTeams.length === 0) {
      window.alert("先にチーム分けをしてください。");
      return;
    }
    var rows = [
      ["team_number", "team_name", "members", "element_key", "element_label", "content"]
    ];
    currentTeams.forEach(function (team, i) {
      var num = i + 1;
      var teamName = "チーム" + num;
      var membersStr = team.join(" / ");
      var memo = memos[String(num)] || {};
      W5H1.forEach(function (el) {
        rows.push([num, teamName, membersStr, el.key, el.label, memo[el.key] || ""]);
      });
    });

    var csv = rows
      .map(function (r) {
        return r.map(csvField).join(",");
      })
      .join("\r\n");

    // ExcelでもUTF-8の日本語が文字化けしないようBOMを付与
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

  // ---- イベント ----
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

  clearBtn.addEventListener("click", clearMembers);
  divideBtn.addEventListener("click", divide);
  reshuffleBtn.addEventListener("click", reshuffle);
  modeRadios.forEach(function (r) {
    r.addEventListener("change", updateUnit);
  });

  rouletteDrawBtn.addEventListener("click", rouletteDraw);
  rouletteNextBtn.addEventListener("click", rouletteNext);
  rouletteResetBtn.addEventListener("click", resetRoulette);
  memoOpenBtn.addEventListener("click", openMemoByNumber);
  exportCsvBtn.addEventListener("click", exportCsv);

  // ---- 初期化 ----
  renderMembers();
  renderSaved();
  renderRoles();
  updateUnit();
})();
