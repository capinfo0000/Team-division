(function () {
  "use strict";

  var STORAGE_KEY = "team-division-members";

  // ---- 状態 ----
  var members = loadMembers();
  var lastDivision = null; // 再シャッフル用に直近の設定を保持

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

      var ol = document.createElement("ol");
      team.forEach(function (name) {
        var li = document.createElement("li");
        li.textContent = name;
        ol.appendChild(li);
      });

      div.appendChild(title);
      div.appendChild(ol);
      resultEl.appendChild(div);
    });

    resultCard.hidden = false;
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
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

  clearBtn.addEventListener("click", clearMembers);
  divideBtn.addEventListener("click", divide);
  reshuffleBtn.addEventListener("click", reshuffle);
  modeRadios.forEach(function (r) {
    r.addEventListener("change", updateUnit);
  });

  // ---- 初期化 ----
  renderMembers();
  updateUnit();
})();
