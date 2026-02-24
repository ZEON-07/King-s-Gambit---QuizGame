const WORKER_URL = 'https://kings-gambit-worker.mr-adhi125.workers.dev';
const API = WORKER_URL || '';

const channel = new BroadcastChannel("quizChannel");
const ping = new BroadcastChannel("ping");

const body = document.body;
const qsd = document.getElementsByClassName("quizQ")[0];
const asd = document.getElementsByClassName("quizA")[0];

var quiz = [];
var qi = 0;
var connectApp = {
  isOn: true,
  serverConnected: false,
  isRunningSequence: false,
};

function pushViolationToQueue() {
  const teamId = localStorage.getItem("team_id");
  if (!teamId) return;

  let q = [];
  try {
    const stored = localStorage.getItem("violation_queue");
    if (stored) q = JSON.parse(stored);
  } catch (e) { }

  const now = Date.now();
  if (q.length > 0) {
    const last = q[q.length - 1];
    if (now - last.time < 3000) return;
  }

  q.push({ team_id: teamId, time: now });
  localStorage.setItem("violation_queue", JSON.stringify(q));
}

async function syncViolations() {
  if (!API) return;
  let q = [];
  try {
    const stored = localStorage.getItem("violation_queue");
    if (stored) q = JSON.parse(stored);
  } catch (e) { }

  if (q.length === 0) return;


  const v = q[0];

  try {
    const res = await fetch(API + "/api/violation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ team_id: v.team_id }),
      keepalive: true
    });

    if (res.ok) {

      q.shift();
      localStorage.setItem("violation_queue", JSON.stringify(q));
    }
  } catch (e) {

    console.warn("Delaying violation sync:", e);
  }
}
setInterval(syncViolations, 2000);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    pushViolationToQueue();
  }
});

window.addEventListener("blur", () => {
  pushViolationToQueue();
});



window.onload = async function () {
  const teamId = localStorage.getItem("team_id");
  const teamName = localStorage.getItem("team_name");
  const sessionToken = localStorage.getItem("session_token");

  if (!teamId || !sessionToken) {
    window.location.href = 'index.html';
    return;
  }

  const nameEl = document.getElementById("myTeamName");
  if (nameEl) nameEl.innerHTML = `<i class="fa-solid fa-users"></i> ${teamName}`;

  const pf = document.getElementById("floatPreview");
  if (pf) pf.style.display = "none";

  await loadQuestions();

  A("hide");
  Q("hide");

  ping.postMessage({
    request: "admin",
    action: "connect",
    from: "quizConnect",
  });
};

window.onbeforeunload = function () {
  return "Refreshing the page will cause issues. Are you sure you want to leave?";
};
async function loadQuestions() {
  if (!API) return;
  try {
    const res = await fetch(API + "/api/questions");
    if (res.ok) {
      quiz = await res.json();
    }
  } catch (e) {
    console.warn("Error loading questions:", e);
  }
}
ping.onmessage = async (event) => {
  var msg = event.data;
  if (msg.OVERRIDE != true) {
    if (msg.request == "App" && msg.from == "admin") {
      if (msg.action == "connect") {
        connectApp.serverConnected = true;
      } else if (msg.action == "query") {
        if (msg.query == "isOn") {
          ping.postMessage({
            request: "admin",
            action: "reply",
            from: "participant",
            for: "isOn",
            data: connectApp.isOn,
          });
        } else if (msg.query == "isConnected") {
          ping.postMessage({
            request: "admin",
            action: "reply",
            from: "participant",
            for: "isConnected",
            data: connectApp.serverConnected,
          });
        }
      }
    }
  } else if (msg.OVERRIDE) {
    if (msg.control == "Seq") {
      connectApp.isRunningSequence = msg.data
      if (connectApp.isRunningSequence) {
        MasterOVERRIDE("hide");
      } else {
        MasterOVERRIDE("show");
      }
    }
  }
};

function sendMessage(msg) {
  channel.postMessage(msg);
}
channel.onmessage = async (event) => {
  var msg = event.data;

  if (msg.control === "loginResult") {
    if (window._loginTimeout) { clearTimeout(window._loginTimeout); window._loginTimeout = null; }

    const btn = document.getElementById("loginBtn");
    const statusEl = document.getElementById("loginStatus");

    if (msg.data?.success) {
      const { teamId, teamName } = msg.data;
      localStorage.setItem("selectedTeamId", teamId);
      localStorage.setItem("selectedTeamName", teamName);
      localStorage.setItem("team_id", teamId);
      localStorage.setItem("team_name", teamName);

      document.getElementById("teamLogin").style.display = "none";
      document.getElementById("quizContainer").style.display = "block";
      const pf = document.getElementById("floatPreview");
      if (pf) pf.style.display = "none";

      const nameEl = document.getElementById("myTeamName");
      if (nameEl) nameEl.innerHTML = `<i class="fa-solid fa-users"></i> ${teamName}`;

      sendMessage({ control: "requestSync", data: { teamId: teamId } });
    } else {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-chess-king"></i> Enter the Arena'; }
      if (statusEl) { statusEl.style.color = '#ff6b6b'; statusEl.textContent = '\u274c ' + (msg.data?.message || 'Invalid passkey.'); }
      const passInput = document.getElementById("teamPass");
      if (passInput) passInput.value = '';
    }
  }

  if (msg.control === "setQuestion") {
    const data = msg.data;
    if (!data) return;

    const apiQ = quiz.find(q => q.id === data.id);
    const qText = (apiQ?.question) || data.q || data.question || "";

    let options;
    if (Array.isArray(data.options) && data.options.length === 4) {
      options = data.options;
    } else if (apiQ && apiQ.option_a !== undefined) {
      options = [apiQ.option_a, apiQ.option_b, apiQ.option_c, apiQ.option_d];
    } else if (data.option_a !== undefined) {
      options = [data.option_a, data.option_b, data.option_c, data.option_d];
    } else {
      options = ["", "", "", ""];
    }

    Q("set", qText);
    window._currentQuestionId = data.id || null;

    for (let i = 0; i < 4; i++) {
      const btn = document.getElementById("opt" + i);
      if (btn) {
        const textEl = btn.querySelector(".optionText");
        if (textEl) textEl.innerText = options[i] || "";
        btn.className = "optionBtn";
        btn.disabled = false;
      }
    }
    A("set", "");
  }

  if (msg.control === "showOptions") {
    const grid = document.getElementById("optionsGrid");
    if (grid) grid.classList.add("visible");
  }

  if (msg.control === "hideOptions") {
    const grid = document.getElementById("optionsGrid");
    if (grid) grid.classList.remove("visible");
  }

  if (msg.control === "showAnswer") {
    stopTimer();
    const answerIndex = msg.data?.answer;
    const answerText = msg.data?.answerText || "";
    const grid = document.getElementById("optionsGrid");


    if (grid && grid.classList.contains("visible")) {
      const myChoice = window._myLockedChoice;
      for (let i = 0; i < 4; i++) {
        const btn = document.getElementById("opt" + i);
        if (btn) {
          btn.disabled = true;
          btn.classList.remove("correct", "wrong", "locked");
          if (i === answerIndex) btn.classList.add("correct");
          else if (i === myChoice) btn.classList.add("wrong");
        }
      }
      const overlay = document.getElementById("feedbackOverlay");
      const badge = document.getElementById("feedbackBadge");
      if (overlay && badge) {
        const isCorrect = myChoice === answerIndex;
        badge.className = "feedbackBadge " + (isCorrect ? "correct" : "wrong");
        badge.innerHTML = isCorrect
          ? '<i class="fa-solid fa-check"></i> Correct!'
          : '<i class="fa-solid fa-xmark"></i> Wrong!';
        overlay.classList.add("show");
        if (window._feedbackTimeout) clearTimeout(window._feedbackTimeout);
        window._feedbackTimeout = setTimeout(() => overlay.classList.remove("show"), 3000);
      }
    } else {

      A("set", answerText || "No answer provided");
      A("show");


    }


    A("set", answerText);
    A("show");
  }

  if (msg.control === "hideAnswer") {
    window._myLockedChoice = null;
    for (let i = 0; i < 4; i++) {
      const btn = document.getElementById("opt" + i);
      if (btn) {
        btn.disabled = false;
        btn.classList.remove("correct", "wrong", "locked");
      }
    }
    A("hide");
    Q("show");
  }

  if (msg.control === "announcement") showAnnouncement(msg.data?.text || "");
  if (msg.control === "clearAnnouncement") hideAnnouncement();

  if (msg.control === "masterFreeze") {
    const overlay = document.getElementById("freezeOverlay");
    const msgEl = document.getElementById("freezeMsg");
    if (msgEl) msgEl.innerText = "The administrator has paused the game.";
    if (overlay) overlay.style.display = "flex";
  }
  if (msg.control === "masterUnfreeze") {
    const overlay = document.getElementById("freezeOverlay");
    if (overlay) overlay.style.display = "none";
  }
  if (msg.control === "teamFreeze") {
    if (msg.data?.teamId === localStorage.getItem("selectedTeamId")) {
      const overlay = document.getElementById("freezeOverlay");
      const msgEl = document.getElementById("freezeMsg");
      if (msgEl) msgEl.innerText = "The administrator has paused your team.";
      if (overlay) overlay.style.display = "flex";
    }
  }
  if (msg.control === "teamUnfreeze") {
    if (msg.data?.teamId === localStorage.getItem("selectedTeamId")) {
      const overlay = document.getElementById("freezeOverlay");
      if (overlay) overlay.style.display = "none";
    }
  }

  if (msg.control === "toggleLeaderboard") {
    showLeaderboardOverlay(msg.data?.enabled);
  }

  if (msg.control === "refreshScore") {
    if (msg.data && Array.isArray(msg.data)) {
      const myTeamId = localStorage.getItem("selectedTeamId");
      if (myTeamId) {
        const myTeam = msg.data.find(t => t.id === myTeamId);
        if (myTeam) {
          const scoreEl = document.getElementById("myTeamScore");
          if (scoreEl) scoreEl.innerText = myTeam.score;
          const nameEl = document.getElementById("myTeamName");
          if (nameEl) nameEl.innerText = myTeam.name;
        }
      }
    }
  }

  if (msg.control == "QHide") Q("hide");
  if (msg.control == "QShow") Q("show");
  if (msg.control == "MasterHide") Master("hide");
  if (msg.control == "MasterShow") Master("show");

  if (msg.control === "resetTimer") {
    stopTimer();
    const timerEl = document.getElementById("timerValue");
    if (timerEl) { timerEl.innerText = "--"; timerEl.style.color = ""; }
  }
  if (msg.control === "startTimer") {
    const duration = (msg.data && msg.data.duration) ? msg.data.duration : 30;
    startTimer(duration);
  }
  if (msg.control === "stopTimer") stopTimer();
  if (msg.control === "pauseTimer") pauseTimer();
  if (msg.control === "resumeTimer") resumeTimer();
};
var _timerInterval = null;
var _timerPaused = false;
var _timerRemaining = 0;

function startTimer(seconds) {
  stopTimer();
  _timerPaused = false;
  _timerRemaining = seconds;
  const timerEl = document.getElementById("timerValue");
  if (!timerEl) return;
  timerEl.classList.remove("urgent");
  timerEl.innerText = _timerRemaining;
  _timerInterval = setInterval(() => {
    _timerRemaining--;
    if (_timerRemaining <= 0) {
      timerEl.innerText = "0";
      timerEl.classList.add("urgent");
      stopTimer();
    } else {
      timerEl.innerText = _timerRemaining;
      if (_timerRemaining <= 5) timerEl.classList.add("urgent");
      else timerEl.classList.remove("urgent");
    }
  }, 1000);
}

function stopTimer() {
  if (_timerInterval) {
    clearInterval(_timerInterval);
    _timerInterval = null;
  }
}

function pauseTimer() {
  if (_timerInterval) {
    clearInterval(_timerInterval);
    _timerInterval = null;
    _timerPaused = true;
  }
}

function resumeTimer() {
  if (!_timerPaused) return;
  _timerPaused = false;
  const timerEl = document.getElementById("timerValue");
  _timerInterval = setInterval(() => {
    _timerRemaining--;
    if (_timerRemaining <= 0) {
      if (timerEl) { timerEl.innerText = "0"; timerEl.classList.add("urgent"); }
      stopTimer();
    } else {
      if (timerEl) {
        timerEl.innerText = _timerRemaining;
        if (_timerRemaining <= 5) timerEl.classList.add("urgent");
        else timerEl.classList.remove("urgent");
      }
    }
  }, 1000);
}
async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function MasterOVERRIDE(action) {
  if (action == "hide") {
    body.style.opacity = "0";
    body.style.display = "none";
  } else {
    body.style.display = "block";
    body.style.opacity = "1";
  }
}

function Master(action) {
  if (action == "hide") body.style.opacity = "0";
  if (action == "show") body.style.opacity = "1";
}

function Q(action, q) {
  if (action == "hide") {
    qsd.style.opacity = "0.3";
    qsd.innerHTML = "Waiting...";
  }
  if (action == "show") qsd.style.opacity = "1";
  if (action == "set") {
    qsd.style.opacity = "1";
    qsd.innerHTML = q;
  }
}

function A(action, a) {
  if (action == "hide") {
    asd.style.opacity = "0";
    asd.style.transform = "translateY(50%)";
  }
  if (action == "show") {
    asd.style.opacity = "1";
    asd.style.transform = "translateY(0%)";
  }
  if (action == "set") asd.innerHTML = a;
}

var _feedbackTimeout = null;
var _myLockedChoice = null;

async function selectOption(index) {
  const cfTeamId = localStorage.getItem('team_id');
  const cfQuestionId = window._currentQuestionId;
  const sessionToken = localStorage.getItem('session_token');

  if (!cfTeamId) {
    window.location.href = 'index.html';
    return;
  }

  for (let i = 0; i < 4; i++) {
    const btn = document.getElementById("opt" + i);
    if (btn) btn.disabled = true;
  }
  const chosen = document.getElementById("opt" + index);
  if (chosen) chosen.classList.add("locked");
  window._myLockedChoice = index;

  if (API && cfQuestionId && sessionToken) {
    try {
      const res = await fetch(API + '/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sessionToken
        },
        body: JSON.stringify({
          question_id: cfQuestionId,
          selected_answer: index,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error && data.error.includes("Already submitted")) {
          customAlert("Already submitted!");
        } else if (res.status === 403) {
          customAlert("Session expired. Please log in again.");
          window.location.href = 'index.html';
        }
      }
    } catch (e) {
      console.warn('Submit API error:', e);
    }
  }
}
function showAnnouncement(text) {
  const overlay = document.getElementById("annOverlay");
  const overlayText = document.getElementById("annOverlayText");
  if (overlay && overlayText) {
    overlayText.innerText = text;
    overlay.style.display = "flex";
    overlay.offsetHeight;
    overlay.classList.add("active");
  }
}

function hideAnnouncement() {
  const overlay = document.getElementById("annOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    setTimeout(() => {
      if (!overlay.classList.contains('active')) {
        overlay.style.display = "none";
      }
    }, 500);
  }
}
async function showLeaderboardOverlay(enabled) {
  const overlay = document.getElementById("lbOverlay");
  const content = document.getElementById("lbOverlayContent");
  if (!overlay || !content) return;

  if (!enabled) {
    overlay.classList.remove("active");
    setTimeout(() => {
      if (!overlay.classList.contains('active')) overlay.style.display = "none";
    }, 500);
    return;
  }

  overlay.style.display = "flex";
  overlay.offsetHeight;
  overlay.classList.add("active");
  content.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><br>Loading Rankings...</div>';

  try {
    const res = await fetch(API + '/api/leaderboard');
    if (!res.ok) throw new Error("Leaderboard locked");
    const data = await res.json();

    const MEDALS = [
      '<i class="fa-solid fa-medal" style="color:#FFD700;"></i>',
      '<i class="fa-solid fa-medal" style="color:#C0C0C0;"></i>',
      '<i class="fa-solid fa-medal" style="color:#CD7F32;"></i>'
    ];

    const rows = data.leaderboard.map(entry => {
      const rankClass = entry.rank <= 3 ? `rank-${entry.rank}` : '';
      const medal = MEDALS[entry.rank - 1] || `#${entry.rank}`;
      return `
                <div class="lb-row ${rankClass}" style="background: rgba(255,255,255,0.05); margin-bottom: 8px; border-radius: 10px; padding: 12px; display: flex; align-items: center;">
                    <div class="lb-rank" style="font-weight: 900; width: 30px;">${entry.rank}</div>
                    <div class="lb-medal" style="width: 30px; text-align: center;">${medal}</div>
                    <div class="lb-name" style="flex:1; margin-left: 15px; font-weight: 600;">${entry.team_name}</div>
                    <div class="lb-score" style="font-weight: 800; color: #00c3ff;">${entry.score} <span style="font-size:0.6rem; opacity:0.6;">PTS</span></div>
                </div>`;
    }).join('');

    content.innerHTML = `<div style="width:100%">${rows}</div>`;
  } catch (e) {
    content.innerHTML = `<div style="text-align:center; padding:20px; color:#f44;"><i class="fa-solid fa-lock"></i><br>${e.message}</div>`;
  }
}
function showRules() {
  const modal = document.getElementById("rulesModal");
  if (modal) modal.style.display = "flex";
}

function closeRules() {
  const modal = document.getElementById("rulesModal");
  if (modal) modal.style.display = "none";
}
