const channel = new BroadcastChannel('quizChannel');
const ping = new BroadcastChannel('ping');

function elem(id) {
    return document.getElementById(id);
}

async function checkAdminPass() {
    const input = document.getElementById('adminPassInput');
    const error = document.getElementById('adminPassError');
    const password = input ? input.value : "";
    if (!password) {
        if (error) error.innerText = "Password required";
        return;
    }

    try {
        const res = await fetch(API + '/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await res.json();
        if (res.ok && data.token) {

            localStorage.setItem('admin_token', btoa(data.token));
            localStorage.removeItem('admin_password');
            const gate = document.getElementById('adminGate');
            if (gate) gate.style.display = 'none';
            if (typeof startup === 'function') startup();
        } else {
            if (error) error.innerText = data.error || "Login failed";
        }
    } catch (e) {
        if (error) error.innerText = "Network error";
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('adminPassInput');
    if (input) input.focus();

    const qFileInput = document.getElementById('qFile');
    if (qFileInput) {
        qFileInput.addEventListener('change', handleJSONUpload);
    }
});
const WORKER_URL = 'https://kings-gambit-worker.mr-adhi125.workers.dev';
const API = WORKER_URL || '';

var teams = [];
var quiz = [];
var qi = 0;
var actionSequence = [];
var currentSelections = {};
var isGameFrozen = false;
var _timerPaused = false;

var serverStatus = {
    connected: false,
    isOn: true
}
var buttonStatus = {
    M: {
        active: true,
        elem: elem("M"),
        action: function () {
            if (this.active) {
                sendMessage({ control: ["MasterHide"] });
                this.active = false;
                actionSequence.push("MasterHide");
            } else {
                sendMessage({ control: ["MasterShow"] })
                this.active = true;
                actionSequence.push("MasterShow");
            }
        }
    },
    Q: {
        active: false,
        elem: elem("Q"),
        action: function () {
            if (this.active) {
                sendMessage({ control: ["QHide"] });
                sendMessage({ control: "stopTimer" });
                buttonStatus.SC.active = true;
                toggle(buttonStatus.SC);
                this.active = false;
                syncCtrlBtn("Q", false);
                actionSequence.push("QHide");
            } else {
                const qData = getCurrentQuestion();
                currentSelections = {};
                sendMessage({ control: ["QShow"] });
                const broadcastData = { ...qData };
                delete broadcastData.answer;
                sendMessage({ control: "setQuestion", data: broadcastData });


                const autoStart = document.getElementById("timerAutoStart")?.value || "options";
                if (autoStart === "question") {
                    const duration = parseInt(document.getElementById("timerDuration")?.value) || 30;
                    sendMessage({ control: "startTimer", data: { duration } });
                }

                this.active = true;
                syncCtrlBtn("Q", true);
                actionSequence.push("QShow");
            }
        }
    },
    ANS: {
        active: false,
        elem: elem("ANS"),
        action: function () {
            if (this.active) {
                sendMessage({ control: "hideAnswer" });
                this.active = false;
                syncCtrlBtn("ANS", false);
                actionSequence.push("hideAnswer");
            } else {
                const qData = getCurrentQuestion();
                const teamData = teams.map(t => ({
                    name: t.name,
                    choice: currentSelections[t.id] !== undefined ? currentSelections[t.id] : -1
                }));

                let answerText = "";
                let optionsData = ["", "", "", ""];
                if (qData) {
                    if (Array.isArray(qData.options) && qData.options.length === 4) {
                        optionsData = qData.options;
                    } else if (qData.option_a !== undefined) {
                        optionsData = [qData.option_a, qData.option_b, qData.option_c, qData.option_d];
                    }
                    if (qData.answer >= 0 && qData.answer < 4) {
                        answerText = optionsData[qData.answer] || "";
                    }
                }

                sendMessage({
                    control: "showAnswer",
                    data: {
                        answer: qData ? qData.answer : -1,
                        answerText: answerText,
                        selections: teamData
                    }
                });
                this.active = true;
                syncCtrlBtn("ANS", true);
                actionSequence.push("showAnswer");
                updatePreview();
            }
        }
    },
    SC: {
        active: false,
        elem: elem("SC"),
        action: function () {
            if (this.active) {
                sendMessage({ control: "hideOptions" });
                sendMessage({ control: "stopTimer" });
                this.active = false;
                syncCtrlBtn("SC", false);
            } else {
                sendMessage({ control: "showOptions" });

                // Auto-start Timer Logic
                const autoStart = document.getElementById("timerAutoStart")?.value || "options";
                if (autoStart === "options") {
                    const duration = parseInt(document.getElementById("timerDuration")?.value) || 30;
                    sendMessage({ control: "startTimer", data: { duration } });
                }

                this.active = true;
                syncCtrlBtn("SC", true);
                updatePreview();
            }
        }
    },
    PAUSE: {
        active: false,
        elem: elem("PAUSE"),
        action: function () {
            togglePause();
        }
    },
    DEL: {
        active: false,
        elem: elem("DEL"),
        action: async function () {
            if (!quiz || quiz.length === 0) return;
            if (!await customConfirm(`Delete Q${qi + 1}: "${quiz[qi].q || quiz[qi].question}"?`)) return;
            quiz.splice(qi, 1);
            if (qi >= quiz.length) qi = Math.max(0, quiz.length - 1);
            updatePreview();
        }
    },
    qNext: {
        active: false,
        elem: elem("qNext"),
        action: function () {
            if (quiz.length === 0) return;
            if (qi < quiz.length - 1) {
                qi++;
                resetControlPad();
                updatePreview();
            }
        }
    },
    qPrev: {
        active: false,
        elem: elem("qPrev"),
        action: function () {
            if (quiz.length === 0) return;
            if (qi > 0) {
                qi--;
                resetControlPad();
                updatePreview();
            }
        }
    }
}
async function pressOnce(buttonObj) {
    buttonObj.elem.classList.add("active");
    buttonObj.elem.classList.remove("inactive");
    buttonObj.active = true;
    await sleep(100);
    buttonObj.elem.classList.remove("active");
    buttonObj.elem.classList.add("inactive");
    buttonObj.active = false;
}

async function toggle(buttonObj, type = "anim", override = false, set = null) {
    if (!buttonObj) return;
    if (!buttonObj.elem && buttonObj !== undefined) {
        for (const key in buttonStatus) {
            if (buttonStatus[key] === buttonObj) {
                buttonObj.elem = document.getElementById(key);
                break;
            }
        }
    }
    if (type == "control") {
        if (override) {
            if (set != null) {
                buttonObj.active = set;
                if (buttonObj.elem) {
                    if (set) {
                        buttonObj.elem.classList.add("active");
                        buttonObj.elem.classList.remove("inactive");
                    } else {
                        buttonObj.elem.classList.remove("active");
                        buttonObj.elem.classList.add("inactive");
                    }
                }
                if (buttonObj.action) buttonObj.action();
            }
        } else {
            if (buttonObj.action) buttonObj.action();
            if (buttonObj.elem) {
                if (buttonObj.active) {
                    buttonObj.elem.classList.add("active");
                    buttonObj.elem.classList.remove("inactive");
                } else {
                    buttonObj.elem.classList.remove("active");
                    buttonObj.elem.classList.add("inactive");
                }
            }
        }
    } else {
        if (buttonObj.active) {
            if (buttonObj.elem) {
                buttonObj.elem.classList.add("active");
                buttonObj.elem.classList.remove("inactive");
            }
        } else {
            if (buttonObj.elem) {
                buttonObj.elem.classList.remove("active");
                buttonObj.elem.classList.add("inactive");
            }
        }
    }
}

async function warnOn(buttonObj) {
    buttonObj.elem.classList.add("orange");
    buttonObj.elem.classList.remove("inactive");
    buttonObj.elem.classList.remove("active");
    await sleep(100);
    buttonObj.elem.classList.remove("orange");
    buttonObj.active = false;
    toggle(buttonObj);
}
function setloaderProgress(per, color = "#00c3ff") {
    const el = elem("qstatus");
    if (el) {
        el.style.width = per + "%";
        el.style.background = color;
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getAdminToken() {
    const token = localStorage.getItem('admin_token');
    if (!token) return "";
    try {
        return atob(token); // Decode Base64
    } catch (e) {
        return "";
    }
}
async function loadQuiz() {
    if (!API) return;
    try {
        const response = await fetch(API + '/api/admin/questions', {
            headers: { 'X-Admin-Token': getAdminToken() }
        });
        if (response.ok) {
            const data = await response.json();
            quiz = data || []; // Raw array from Worker
            if (quiz.length > 0) {
                qi = 0;
                updatePreview();
            } else {
                console.warn("No questions found in database.");
            }
        } else if (response.status === 401) {
            console.error("Unauthorized: Session invalid or expired.");
        } else {
            console.error("Failed to load questions:", response.status);
        }
    } catch (e) {
        console.warn("Could not fetch questions:", e);
    }
}

async function loadSettings() {
    if (!API) return;
    try {
        const response = await fetch(API + '/api/settings');
        if (response.ok) {
            const data = await response.json();
            // Data is now { key: value } flattened object
            Object.entries(data).forEach(([key, value]) => {
                if (key === 'timerDuration') document.getElementById("timerDuration").value = value;
                if (key === 'pointsPerQ') document.getElementById("pointsPerQ").value = value;
                if (key === 'timerAutoStart') {
                    const select = document.getElementById("timerAutoStart");
                    if (select) select.value = value;
                }
                if (key === 'leaderboard_enabled') {
                    const enabled = value === 'true';
                    syncLBBtnState(enabled);
                }
            });
        }
    } catch (e) {
        console.warn("Could not fetch settings:", e);
    }
}

async function handleJSONUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    setloaderProgress(10, "#a855f7");

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const rawQuestions = JSON.parse(e.target.result);
            if (!Array.isArray(rawQuestions)) {
                throw new Error("JSON must be an array of questions.");
            }


            const questions = rawQuestions.map(q => ({
                question_text: q.question_text || q.question || q.q || "",
                option_a: q.option_a || (Array.isArray(q.options) ? q.options[0] : "") || "",
                option_b: q.option_b || (Array.isArray(q.options) ? q.options[1] : "") || "",
                option_c: q.option_c || (Array.isArray(q.options) ? q.options[2] : "") || "",
                option_d: q.option_d || (Array.isArray(q.options) ? q.options[3] : "") || "",
                correct_answer: typeof q.correct_answer === 'number' ? q.correct_answer : (typeof q.answer === 'number' ? q.answer : 0)
            }));

            setloaderProgress(30, "#a855f7");

            const res = await fetch(API + '/api/admin/questions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Token': getAdminToken()
                },
                body: JSON.stringify(questions) // Send mapped array directly
            });

            if (res.ok) {
                setloaderProgress(100, "#22c55e");
                await loadQuiz();
                setTimeout(() => setloaderProgress(0), 3000);
                customAlert("Questions uploaded successfully!");
            } else {
                const data = await res.json().catch(() => ({}));
                console.error("Upload failed details:", { status: res.status, data });
                customAlert(`Upload failed (${res.status}): ` + (data.error || "Unknown error"));
                setloaderProgress(100, "#f44");
                setTimeout(() => setloaderProgress(0), 5000);
            }
        } catch (err) {
            console.error("JSON Process Error:", err);
            customAlert("Error: " + err.message);
            setloaderProgress(100, "#f44");
            setTimeout(() => setloaderProgress(0), 5000);
        }
    };
    reader.onerror = () => {
        customAlert("Error reading file.");
        setloaderProgress(0);
    };
    reader.readAsText(file);
    event.target.value = "";
}

async function loadTeams() {
    if (!API) return;
    try {
        const response = await fetch(API + '/api/admin/teams', {
            headers: { 'X-Admin-Token': getAdminToken() }
        });
        if (response.ok) {
            const data = await response.json();
            teams = (data || []).map(t => ({
                id: (t.id || t.team_id),
                name: (t.name || t.team_name),
                pass: (t.passkey || t.pass),
                score: (t.score || 0)
            }));
            updateTeamList();
            broadcastTeams();
        } else if (response.status === 401) {
            console.error("Unauthorized to load teams.");
        }
    } catch (e) {
        console.warn("Could not fetch teams:", e);
    }
}

async function toggleLeaderboard() {
    const btn = document.getElementById('masterLBBtn');
    if (!btn) return;

    // Determine the desired toggle state based on current visual state
    const enabled = !btn.classList.contains('active');
    const token = getAdminToken();

    if (!token) {
        customAlert("Admin session required. Please login.");
        return;
    }

    try {
        const res = await fetch(API + '/api/admin/toggle-leaderboard', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Token': getAdminToken()
            },
            body: JSON.stringify({ enabled })
        });
        if (res.ok) {
            sendMessage({ control: "toggleLeaderboard", data: { enabled } });
            syncLBBtnState(enabled);
        } else {
            const data = await res.json();
            customAlert("Error: " + (data.error || "Failed to toggle"));
        }
    } catch (e) {
        customAlert("Connection error fetching Leaderboard Toggle");
    }
}

function toggleGlobalLeaderboard() {
    toggleLeaderboard();
}

function syncLBBtnState(enabled) {
    const btn = document.getElementById('masterLBBtn');
    if (!btn) return;
    if (enabled) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fa-solid fa-trophy"></i>';
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fa-solid fa-trophy"></i>';
    }
}

async function saveSettings() {
    const timerDuration = parseInt(document.getElementById("timerDuration").value);
    const pointsPerQ = parseInt(document.getElementById("pointsPerQ").value);
    const timerAutoStart = document.getElementById("timerAutoStart")?.value || "options";

    try {
        const res = await fetch(API + '/api/admin/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Token': getAdminToken()
            },
            body: JSON.stringify({ timerDuration, pointsPerQ, timerAutoStart })
        });
        if (res.ok) {
            closeSettingsModal();
        } else {
            const data = await res.json();
            customAlert("Error: " + (data.error || "Failed to save settings"));
        }
    } catch (e) {
        customAlert("Network error saving settings");
    }
}
function getCurrentQuestion() {
    if (!quiz || quiz.length === 0) return null;
    const item = quiz[qi];
    if (!item) return null;

    const globalPoints = parseInt(document.getElementById("pointsPerQ")?.value) || 10;
    const overrideEl = document.getElementById("qPointsOverride");
    const pts = overrideEl ? (parseInt(overrideEl.value) || globalPoints) : (item.points || globalPoints);


    const questionText = item.q || item.question || item.question_text || "";
    const options = item.options || [item.option_a, item.option_b, item.option_c, item.option_d].filter(o => o !== undefined);
    const answer = typeof item.answer === "number" ? item.answer : (typeof item.correct_answer === "number" ? item.correct_answer : -1);

    return {
        id: item.id || `q${qi + 1}`,
        q: questionText,
        options: options,
        answer: answer,
        points: pts
    };
}

function updatePreview() {
    const qEl = document.getElementById("lpq");
    if (!quiz || quiz.length === 0) {
        if (qEl) {
            qEl.innerText = "No questions found in database. Load a JSON file to start.";
            qEl.classList.add("empty");
        }
        return;
    }
    const qData = getCurrentQuestion();

    const aEl = document.getElementById("lpa");
    const divEl = document.getElementById("lpDivider");
    const optGrid = document.getElementById("lpOptions");
    const ptsEl = document.getElementById("qPointsOverride");

    if (qEl) {
        qEl.innerText = `Q${qi + 1}/${quiz.length}: ${qData.q}`;
        qEl.classList.remove("empty");
    }
    if (aEl) {
        aEl.innerText = qData.options[qData.answer] || "N/A";
        aEl.classList.add("visible");
    }
    if (divEl) divEl.classList.add("visible");
    if (optGrid) {
        optGrid.classList.add("visible");
        for (let i = 0; i < 4; i++) {
            const card = document.getElementById("lpOpt" + i);
            if (card) {
                const textEl = card.querySelector(".localOptionText");
                if (textEl) textEl.innerText = qData.options[i] || "";
                card.classList.remove("correct");
                if (i === qData.answer) card.classList.add("correct");

                const badgeContainer = document.getElementById("lpBadges" + i);
                if (badgeContainer) {
                    badgeContainer.innerHTML = "";
                    const pickers = teams.filter(t => currentSelections[t.id] === i);
                    pickers.forEach(p => {
                        const badge = document.createElement("div");
                        badge.className = "localTeamBadge";
                        badge.innerText = p.name;
                        badgeContainer.appendChild(badge);
                    });
                }
            }
        }
    }
    if (ptsEl) {
        ptsEl.value = qData.points;
        const ptsDisplay = document.getElementById("lpPointsBadge");
        if (ptsDisplay) ptsDisplay.innerText = `${qData.points} PTS`;
    }
}

function overrideCurrentPoints(val) {
    const pts = parseInt(val) || 0;
    if (quiz[qi]) {
        quiz[qi].points = pts;
        const ptsDisplay = document.getElementById("lpPointsBadge");
        if (ptsDisplay) ptsDisplay.innerText = `${pts} PTS`;
    }
}

function applyPointsToAll() {
    const pts = parseInt(document.getElementById("pointsPerQ")?.value) || 10;
    if (quiz.length === 0) return;
    quiz.forEach(q => q.points = pts);
    updatePreview();
    customAlert(`Applied ${pts} points to all ${quiz.length} questions.`);
}
function sendMessage(msg) {
    channel.postMessage(msg);
}

function sentPing(msg) {
    ping.postMessage(msg);
}

async function sentStatusUpdate() {
    sentPing({ OVERRIDE: true, control: "Seq", data: true });
    actionSequence.forEach((action) => {
        sendMessage({ control: [action] });
    });
    await sleep(500);
    sentPing({ OVERRIDE: true, control: "Seq", data: false });
}

channel.onmessage = function (event) {
    const msg = event.data;
    if (msg.control === "addScore") {
        const team = teams.find(t => t.id === msg.teamId);
        if (team) {
            team.score = (team.score || 0) + (msg.points || 0);
            updateTeamList();
            broadcastTeams();
            updateScore();
        }
    }

    if (msg.control === "submitChoice") {
        if (msg.teamId && msg.data !== undefined) {
            currentSelections[msg.teamId] = msg.data;
            updatePreview();
        }
    }

    if (msg.control === "loginRequest") {
        const passkey = msg.data?.passkey?.toUpperCase();
        const team = teams.find(t => t.pass === passkey);
        if (team) {
            sendMessage({
                control: "loginResult",
                data: { success: true, teamId: team.id, teamName: team.name }
            });
        } else {
            sendMessage({
                control: "loginResult",
                data: { success: false, message: "Invalid Passkey" }
            });
        }
    }

    if (msg.control === "requestSync") {
        if (buttonStatus.Q.active) {
            sendMessage({ control: "setQuestion", data: getCurrentQuestion() });
        }
        if (buttonStatus.SC.active) {
            sendMessage({ control: "showOptions" });
        }
        if (buttonStatus.ANS.active) {
            const qData = getCurrentQuestion();
            const teamData = teams.map(t => ({
                name: t.name,
                choice: currentSelections[t.id] !== undefined ? currentSelections[t.id] : -1
            }));
            sendMessage({
                control: "showAnswer",
                data: {
                    answer: qData ? qData.answer : -1,
                    selections: teamData
                }
            });
        }
        if (isGameFrozen) sendMessage({ control: "masterFreeze" });

        const lbBtn = document.getElementById('masterLBBtn');
        const lbEnabled = lbBtn ? lbBtn.classList.contains('active') : false;
        sendMessage({ control: "toggleLeaderboard", data: { enabled: lbEnabled } });

        sendMessage({ control: "refreshScore", data: teams });
    }
};
function resetTimer() {
    sendMessage({ control: "resetTimer" });
}

function togglePause() {
    if (_timerPaused) resumeTimer();
    else pauseTimer();
}

function pauseTimer() {
    const btn = document.getElementById("PAUSE");
    sendMessage({ control: "pauseTimer" });
    _timerPaused = true;
    syncCtrlBtn("PAUSE", true);
    if (btn) btn.innerHTML = '<i class="fa-solid fa-play"></i><br>RESUME';
}

function resumeTimer() {
    const btn = document.getElementById("PAUSE");
    sendMessage({ control: "resumeTimer" });
    _timerPaused = false;
    syncCtrlBtn("PAUSE", false);
    if (btn) btn.innerHTML = '<i class="fa-solid fa-pause"></i><br>PAUSE';
}
function resetControlPad() {
    currentSelections = {};
    const targetBtns = ["Q", "SC", "ANS", "PAUSE"];
    targetBtns.forEach(id => {
        if (buttonStatus[id]) {
            buttonStatus[id].active = false;
            syncCtrlBtn(id, false);
        }
    });

    const pauseBtn = document.getElementById("PAUSE");
    if (pauseBtn) pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i><br>PAUSE';
    _timerPaused = false;

    sendMessage({ control: "QHide" });
    sendMessage({ control: "hideOptions" });
    sendMessage({ control: "hideAnswer" });
    sendMessage({ control: "stopTimer" });

    const lpq = document.getElementById("lpq");
    const lpa = document.getElementById("lpa");
    const lpDiv = document.getElementById("lpDivider");
    const lpOpts = document.getElementById("lpOptions");

    if (lpq) {
        lpq.innerText = "Waiting for next question...";
        lpq.classList.add("empty");
    }
    if (lpa) {
        lpa.innerText = "";
        lpa.classList.remove("visible");
    }
    if (lpDiv) lpDiv.classList.remove("visible");
    if (lpOpts) lpOpts.classList.remove("visible");
}

function ctrlAction(id) {
    if (buttonStatus[id]) {
        toggle(buttonStatus[id], "control");
    }
}
function toggleSettingsPanel() {
    const settingsBar = document.getElementById('settingsBar');
    if (settingsBar) {
        settingsBar.classList.toggle('collapsed');
    }
}
async function buttonSequence() {
    var buttons = document.getElementsByClassName("switch");
    await sleep(200);

    for (var i = 0; i < buttons.length; i++) {
        const button = buttonStatus[buttons[i].id];
        let aac = button.active;
        await toggle(button);
        setloaderProgress(100 / buttons.length);
        await sleep(50);
        await warnOn(button);
        await sleep(200);
        await toggle(button);
        await sleep(50);
        await toggle(button);
        if (aac) {
            await sleep(10);
            buttonStatus[buttons[i].id].active = false;
            await toggle(button, "control");
        }
    }
    setloaderProgress(0);
}
window.onload = async function () {
    setloaderProgress(25);
    sentPing({ request: "App", action: "query", query: "isOn", from: "server" });
}

ping.onmessage = async (event) => {
    var msg = event.data;
    if (msg.request == "admin" && msg.from == "participant") {
        if (msg.action == "connect") {
            if (serverStatus.connected) {
                setloaderProgress(100, "red")
                sendMessage({ control: ['MasterHide'] })
                sentPing({ request: "App", action: "connect", from: "admin" });
                if (buttonStatus.M.active) sendMessage({ control: ['MasterShow'] })
                broadcastTeams();
                sentStatusUpdate()
                setloaderProgress(100, "#20fc03")
                await sleep(500);
                setloaderProgress(0, "red")
            } else {
                sentPing({ request: "App", action: "query", query: "isOn", from: "admin" });
            }
        }
        else if (msg.action == "reply") {
            if (msg.for == "isOn") {
                await sleep(100);
                setloaderProgress(50)
                if (serverStatus.isOn) {
                    sentPing({ request: "App", action: "query", query: "isConnected", from: "admin" });
                    sentStatusUpdate()
                }
            }
            else if (msg.for == "isConnected") {
                await sleep(100);
                setloaderProgress(60)
                if (!(msg.data)) {
                    serverStatus.connected = true;
                    sentPing({ request: "App", action: "connect", from: "admin" });
                    setloaderProgress(100)
                } else {
                    await sleep(100);
                    setloaderProgress(100, 'red')
                    sentPing({ request: "App", action: "connect", from: "admin" });
                    serverStatus.connected = true;
                    sendMessage({ control: ['MasterHide'] })
                    await sleep(500)
                    setloaderProgress(100, "#20fc03")
                    await sleep(500);
                    setloaderProgress(0)
                    startup();
                }
            }
        }
    }
};
async function createNewTeam() {
    const nameInput = document.getElementById("newTeamName");
    const name = nameInput ? nameInput.value.trim() : prompt("Enter Team Name:");

    if (name) {
        try {
            const res = await fetch(API + '/api/admin/teams', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Token': getAdminToken()
                },
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                const data = await res.json();
                const newTeam = {
                    id: data.team.id,
                    name: data.team.team_name,
                    pass: data.team.passkey,
                    score: data.team.score || 0
                };
                teams.push(newTeam);
                if (nameInput) nameInput.value = "";
                closeTeamModal();
                updateTeamList();
                broadcastTeams();
            } else {
                const data = await res.json();
                customAlert("Error: " + (data.error || "Failed to create team"));
            }
        } catch (e) {
            customAlert("Network error creating team");
        }
    }
}

function updateTeamList() {
    const list = document.getElementById("teamList");
    if (!list) return;
    list.innerHTML = "";

    if (teams.length === 0) {
        list.innerHTML = '<p style="color:#555; font-size:0.8rem; text-align:center; width:100%;">No teams yet.</p>';
        return;
    }

    teams.forEach((t, index) => {
        const card = document.createElement("div");
        card.className = "teamCard" + (t.isFrozen ? " frozen" : "");
        card.innerHTML = `
            <div class="teamIndex">${index + 1}</div>
            <div class="teamCardName" title="${t.name}">
                ${t.name}
                <button onclick="renameTeam('${t.id}')" class="miniBtn" style="margin-left: 5px; opacity: 0.6; border: none; background: transparent;"><i class="fa-solid fa-pen-to-square"></i></button>
            </div>
            <div style="font-size: 0.65rem; color: #888; margin-bottom: 5px; display: flex; align-items: center; gap: 6px;">
                Key: <code style="color: #00c3ff;">${t.pass}</code>
                <button onclick="copyToClipboard('${t.pass}', this)" class="miniBtn">COPY</button>
            </div>
            <div class="teamCardRow">
                <input class="teamCardScore" type="number" value="${t.score}"
                    onchange="updateTeamScore('${t.id}', this.value)">
                <button class="teamCardPause${t.isFrozen ? ' active' : ''}" onclick="toggleTeamFreeze('${t.id}')">
                    <i class="fa-solid fa-${t.isFrozen ? 'play' : 'pause'}"></i>
                </button>
                <button class="teamCardDelete" onclick="deleteTeam('${t.id}')">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
        list.appendChild(card);
    });
}

function toggleGameFreeze() {
    isGameFrozen = !isGameFrozen;
    const btn = document.getElementById("masterFreezeBtn");
    if (isGameFrozen) {
        if (btn) {
            btn.classList.add("active");
            btn.innerHTML = '<i class="fa-solid fa-snowflake"></i> Frozen';
        }
        sendMessage({ control: "masterFreeze" });
        if (!_timerPaused) pauseTimer();
    } else {
        if (btn) {
            btn.classList.remove("active");
            btn.innerHTML = '<i class="fa-solid fa-snowflake"></i> Freeze';
        }
        sendMessage({ control: "masterUnfreeze" });
        if (_timerPaused) resumeTimer();
    }
}

async function renameTeam(id) {
    const team = teams.find(t => t.id === id);
    if (!team) return;

    const newName = await window.customPrompt("Rename Team:", team.name);
    if (newName && newName.trim() !== "" && newName !== team.name) {
        try {
            const res = await fetch(API + '/api/admin/teams/rename', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Token': getAdminToken()
                },
                body: JSON.stringify({ id, name: newName.trim() })
            });
            if (res.ok) {
                team.name = newName.trim();
                updateTeamList();
                broadcastTeams();
            } else {
                const data = await res.json();
                customAlert("Error: " + (data.error || "Failed to rename team"));
            }
        } catch (e) {
            customAlert("Network error renaming team");
        }
    }
}

async function updateTeamScore(id, val) {
    const t = teams.find(x => x.id === id);
    if (t) {
        const score = parseInt(val) || 0;
        try {
            const res = await fetch(API + '/api/admin/teams/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Token': getAdminToken()
                },
                body: JSON.stringify({ id, score })
            });
            if (res.ok) t.score = score;
        } catch (e) {
            console.error(e);
        }
    }
}

async function deleteTeam(id) {
    if (await customConfirm("Delete this team?")) {
        try {
            const res = await fetch(API + `/api/admin/teams?id=${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Token': getAdminToken()
                }
            });

            if (res.ok) {
                teams = teams.filter(t => t.id !== id);
                updateTeamList();
                broadcastTeams();
            } else {
                const data = await res.json().catch(() => ({}));
                customAlert(`Delete failed (${res.status}): ` + (data.error || "Unknown error"));
            }
        } catch (e) {
            console.error("Delete team error:", e);
            customAlert("Network error: Could not delete team.");
        }
    }
}

async function toggleTeamFreeze(id) {
    const team = teams.find(t => t.id === id);
    if (!team) return;
    team.isFrozen = !team.isFrozen;

    // Broadcast the freeze to the specific team
    sendMessage({
        control: team.isFrozen ? "teamFreeze" : "teamUnfreeze",
        data: { teamId: id }
    });

    updateTeamList();
}

function broadcastTeams() {
    sendMessage({ control: "updateTeams", data: teams });
}

function updateScore() {
    sendMessage({ control: "refreshScore", data: teams });
}

async function clearAllQuestions() {
    if (!await customConfirm("CRITICAL: This will permanently delete ALL questions. Proceed?")) return;
    try {
        const res = await fetch(API + '/api/admin/questions/all', {
            method: 'DELETE',
            headers: { 'X-Admin-Token': getAdminToken() }
        });
        if (res.ok) {
            quiz = [];
            qi = 0;
            resetControlPad();
            updatePreview();
            customAlert("All questions cleared.");
        }
    } catch (e) { console.error(e); }
}

async function clearAllTeams() {
    if (!await customConfirm("CRITICAL: This will permanently delete ALL teams. Proceed?")) return;
    try {
        const res = await fetch(API + '/api/admin/teams/all', {
            method: 'DELETE',
            headers: { 'X-Admin-Token': getAdminToken() }
        });
        if (res.ok) {
            teams = [];
            updateTeamList();
            broadcastTeams();
            customAlert("All teams cleared.");
        }
    } catch (e) { console.error(e); }
}
function showTeamModal() {
    const m = document.getElementById("teamModal");
    if (m) m.style.display = "flex";
}
function closeTeamModal() {
    const m = document.getElementById("teamModal");
    if (m) m.style.display = "none";
}
function showSettingsModal() {
    const m = document.getElementById("settingsModal");
    if (m) m.style.display = "flex";
}
function closeSettingsModal() {
    const m = document.getElementById("settingsModal");
    if (m) m.style.display = "none";
}

function copyToClipboard(text, btn) {
    if (!navigator.clipboard) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        updateCopyButton(btn);
        return;
    }
    navigator.clipboard.writeText(text).then(() => updateCopyButton(btn));
}

function updateCopyButton(btn) {
    const originalContent = btn.innerHTML;
    btn.innerHTML = 'DONE';
    setTimeout(() => { btn.innerHTML = originalContent; }, 1500);
}

function syncCtrlBtn(id, active) {
    const el = document.getElementById(id);
    if (!el) return;
    if (active) el.classList.add('active');
    else el.classList.remove('active');
}
function showAnnModal() {
    const modal = document.getElementById('annModal');
    if (modal) modal.style.display = 'flex';
}
function closeAnnModal() {
    const modal = document.getElementById('annModal');
    if (modal) modal.style.display = 'none';
    clearAnnouncement();
}
function sendAnnouncement() {
    const textEl = document.getElementById('annText');
    const text = textEl ? textEl.value.trim() : "";
    if (!text) return;
    sendMessage({ control: 'announcement', data: { text } });
}
function clearAnnouncement() {
    sendMessage({ control: 'clearAnnouncement' });
    const textEl = document.getElementById('annText');
    if (textEl) textEl.value = '';
}
async function showViolationsModal() {
    const modal = elem("violationsModal");
    if (modal) modal.style.display = "flex";
    await loadViolations();
}

function closeViolationsModal() {
    const modal = elem("violationsModal");
    if (modal) modal.style.display = "none";
}

async function loadViolations() {
    const list = elem("violationsList");
    if (!list) return;
    list.innerHTML = `<p style="text-align: center; opacity: 0.5;">Loading...</p>`;

    try {
        const token = getAdminToken();
        const res = await fetch(API + '/api/admin/violations', {
            headers: { 'X-Admin-Token': token }
        });

        if (res.ok) {
            const data = await res.json();
            const violations = data || []; // Raw array from Worker
            if (violations.length === 0) {
                list.innerHTML = `<p style="text-align: center; opacity: 0.5; padding: 20px;">No violations recorded yet. Good sportsmanship!</p>`;
                return;
            }

            list.innerHTML = violations.map(v => {
                const ts = v.timestamp ? new Date(v.timestamp + 'Z') : null;
                const timeStr = ts && !isNaN(ts.getTime()) ? ts.toLocaleString() : 'Date Unknown';
                return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-bottom: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border-left: 4px solid #f44;">
                    <div style="font-weight: 600;">${v.name || v.team_name || 'Team'}</div>
                    <div style="font-size: 0.8em; opacity: 0.6;">${timeStr}</div>
                </div>
                `;
            }).join('');
        } else {
            const errData = await res.json().catch(() => ({}));
            list.innerHTML = `<p style="text-align: center; color: #f44; padding: 20px;">Failed to load violations: ${res.status} ${errData.error || ''}</p>`;
        }
    } catch (e) {
        console.error("Violations fetch error:", e);
        list.innerHTML = `<p style="text-align: center; color: #f44; padding: 20px;">Error connecting to server. Check console for details.</p>`;
    }
}

let lastViolationTimestamp = Date.now();
let violationPollInterval = null;

async function startup() {
    const token = getAdminToken();
    if (!token) return; // Wait for user to unlock

    buttonSequence();
    sendMessage({ control: ["MasterHide"] });

    // Load all data
    await Promise.all([
        loadQuiz(),
        loadSettings(),
        loadTeams()
    ]);

    startViolationPolling();

    const qData = getCurrentQuestion();
    if (qData) {
        const broadcastData = { ...qData };
        delete broadcastData.answer;
        sendMessage({ control: "setQuestion", data: broadcastData });
    }
    sendMessage({ control: ["MasterShow"] });
}

function startViolationPolling() {
    if (violationPollInterval) clearInterval(violationPollInterval);

    lastViolationTimestamp = Date.now();
    violationPollInterval = setInterval(checkForNewViolations, 5000);
}

async function checkForNewViolations() {
    try {
        const token = getAdminToken();
        const res = await fetch(API + '/api/admin/violations', {
            headers: { 'X-Admin-Token': token }
        });

        if (res.ok) {
            const data = await res.json();
            const violations = data || []; // Raw array from Worker
            if (violations.length > 0) {
                // Check if the most recent violation is newer than our last seen
                const latest = violations[0];


                const latestTime = new Date(latest.timestamp + 'Z').getTime();

                if (latestTime > lastViolationTimestamp) {
                    showViolationAlert(latest.name || latest.team_name || 'Team');
                    lastViolationTimestamp = latestTime;

                    showViolationsModal();
                }
            }
        }
    } catch (e) {
        console.warn("Violation polling error:", e);
    }
}

function showViolationAlert(teamName) {
    const toast = elem("violationToast");
    const text = elem("violationToastText");
    const vBtn = document.querySelector(".violationsBtn");
    if (!toast || !text) return;

    text.innerText = `${teamName.toUpperCase()} COMMITTED A VIOLATION!`;
    toast.classList.add("show");
    if (vBtn) vBtn.classList.add("alerting");


    toast.onclick = () => {
        showViolationsModal();
        toast.classList.remove("show");
    };


    try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3');
        audio.volume = 0.4;
        audio.play();
    } catch (e) { }

    setTimeout(() => {
        toast.classList.remove("show");
        if (vBtn) vBtn.classList.remove("alerting");
    }, 6000);
}
