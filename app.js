(function () {
  "use strict";

  var STORAGE_KEY = "team-division-members";
  var SAVED_KEY = "team-division-saved";
  var ROLES_KEY = "team-division-roles";
  var DEFAULT_ROLES = ["書記", "発表", "司会", "タイムキーパー"];

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
  var nextBtn = document.getElementById("r-next");
  var abortBtn = document.getElementById("r-abort");
  var summaryEl = document.getElementById("r-summary");
  var againBtn = document.getElementById("r-again");
  var backBtn = document.getElementById("r-back");
  var tabsBar = document.getElementById("tabs-bar");
  var listStartBtn = document.getElementById("list-start");

  // ---- 状態（ルーレット）----
  var rAssignments = [];
  var rLabels = [];        // 各参加者の表示名（名前 or 「N番目の人」）
  var rReturnTab = "roulette"; // 終了時に戻るタブ
  var rCurrent = 0;
  var rTeamCount = 0;
  var rTotal = 0;
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

  // ---- ルーレット抽選 ----
  function teamName(i) {
    var label = i < 26 ? String.fromCharCode(65 + i) : String(i + 1);
    return label + "チーム";
  }

  function roleLabel(roleArr) {
    if (!rUseRoles) return "";
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

  // 共通の開始処理：参加者ラベル・チーム数・役割有無・戻り先タブを受け取る
  function beginRoulette(labels, teamCount, useRoles, returnTab) {
    rLabels = labels;
    rTotal = labels.length;
    rTeamCount = teamCount;
    rUseRoles = useRoles;
    rAssignments = computeAssignments(rTotal, teamCount, useRoles);
    rCurrent = 0;
    rReturnTab = returnTab;

    reelRoleEl.style.display = useRoles && roles.length > 0 ? "block" : "none";
    tabsBar.hidden = true;
    document.getElementById("tab-roulette").hidden = true;
    document.getElementById("tab-list").hidden = true;
    summaryCard.hidden = true;
    stageCard.hidden = false;
    revealPerson(0);
  }

  // ルーレット抽選タブ：人数指定
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
    beginRoulette(labels, teams, rRoleEnabled.checked, "roulette");
  }

  // リストで分けるタブ：登録メンバーで開始
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
    beginRoulette(members.slice(), teamCount, roleEnabled.checked, "list");
  }

  function exitStage() {
    stageCard.hidden = true;
    summaryCard.hidden = true;
    tabsBar.hidden = false;
    switchTab(rReturnTab);
  }

  function revealPerson(p) {
    progressEl.textContent = rTotal + "人中 " + (p + 1) + "人目";
    personEl.textContent = rLabels[p];
    nextBtn.hidden = true;
    spin(p);
  }

  function spin(p) {
    spinning = true;
    reelEl.classList.add("spinning");
    reelEl.classList.remove("settled");

    var ticks = 0;
    var total = 26; // 切り替え回数
    function tick() {
      reelTeamEl.textContent = teamName(Math.floor(Math.random() * rTeamCount));
      if (rUseRoles && roles.length > 0) {
        reelRoleEl.textContent = roles[Math.floor(Math.random() * roles.length)];
      }
      ticks++;
      if (ticks < total) {
        // 終盤はだんだん遅くする
        var delay = 45 + Math.pow(ticks / total, 3) * 260;
        setTimeout(tick, delay);
      } else {
        settle(p);
      }
    }
    tick();
  }

  function settle(p) {
    var a = rAssignments[p];
    reelTeamEl.textContent = teamName(a.teamIndex);
    reelRoleEl.textContent = roleLabel(a.roles);
    reelEl.classList.remove("spinning");
    reelEl.classList.add("settled");
    spinning = false;
    nextBtn.textContent = p === rTotal - 1 ? "結果を見る ▶" : "次の人へ ▶";
    nextBtn.hidden = false;
  }

  function nextPerson() {
    if (spinning) return;
    rCurrent++;
    if (rCurrent < rTotal) {
      revealPerson(rCurrent);
    } else {
      showSummary();
    }
  }

  function showSummary() {
    stageCard.hidden = true;
    summaryCard.hidden = false;
    summaryEl.innerHTML = "";

    for (var t = 0; t < rTeamCount; t++) {
      var members = [];
      for (var p = 0; p < rTotal; p++) {
        if (rAssignments[p].teamIndex === t) members.push(p);
      }

      var div = document.createElement("div");
      div.className = "team";

      var title = document.createElement("div");
      title.className = "team-title";
      var nameSpan = document.createElement("span");
      nameSpan.textContent = teamName(t);
      var countSpan = document.createElement("span");
      countSpan.className = "count";
      countSpan.textContent = members.length + "人";
      title.appendChild(nameSpan);
      title.appendChild(countSpan);

      var ol = document.createElement("ol");
      members.forEach(function (p) {
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
  }

  function switchTab(name) {
    tabs.forEach(function (t) {
      t.classList.toggle("active", t.getAttribute("data-tab") === name);
    });
    document.getElementById("tab-roulette").hidden = name !== "roulette";
    document.getElementById("tab-list").hidden = name !== "list";
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
  nextBtn.addEventListener("click", nextPerson);
  abortBtn.addEventListener("click", exitStage);
  againBtn.addEventListener("click", function () {
    rAssignments = computeAssignments(rTotal, rTeamCount, rUseRoles);
    rCurrent = 0;
    summaryCard.hidden = true;
    stageCard.hidden = false;
    revealPerson(0);
  });
  backBtn.addEventListener("click", exitStage);

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
  modeRadios.forEach(function (r) {
    r.addEventListener("change", updateUnit);
  });

  // ---- 初期化 ----
  renderMembers();
  renderSaved();
  renderRoles();
  updateUnit();
})();
