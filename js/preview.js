const WORKER_URL = 'https://kings-gambit-worker.mr-adhi125.workers.dev';
const API = WORKER_URL || '';
const channel = new BroadcastChannel("quizChannel");
window._currentOptions = [];
channel.onmessage = function (event) {
    const msg = event.data;
    if (!msg || !msg.control) return;

    if (msg.control === "setQuestion") {
        const data = msg.data;
        if (!data) return;
        const qEl = document.getElementById("previewQ");
        if (qEl) { qEl.innerText = data.q || ""; qEl.classList.remove("empty"); }

        const aEl = document.getElementById("previewA");
        if (aEl) { aEl.innerText = ""; aEl.classList.remove("visible"); }

        window._currentOptions = data.options || [];
        for (let i = 0; i < 4; i++) {
            const card = document.getElementById("opt" + i);
            if (card) {
                card.querySelector(".optionText").innerText = window._currentOptions[i] || "";
                card.classList.remove("correct");
            }
        }
        window._previewAnswer = data.answer ?? -1;
        document.getElementById("divider").classList.add("visible");

        const ptsEl = document.getElementById("previewPoints");
        if (ptsEl) {
            ptsEl.innerText = `${data.points || 10} PTS`;
            ptsEl.classList.add("visible");
        }
    }

    if (msg.control === "showOptions") {
        document.getElementById("optionsGrid")?.classList.add("visible");
    }
    if (msg.control === "hideOptions") {
        document.getElementById("optionsGrid")?.classList.remove("visible");
        for (let i = 0; i < 4; i++) document.getElementById("opt" + i)?.classList.remove("correct");
    }

    if (msg.control === "showAnswer") {
        const answerIndex = msg.data?.answer ?? window._previewAnswer;
        const answerText = msg.data?.answerText || "";
        const selections = msg.data?.selections || [];

        const grid = document.getElementById("optionsGrid");
        const aEl = document.getElementById("previewA");

        if (grid && grid.classList.contains("visible")) {
            // Options were shown, so highlight the correct one
            if (aEl && answerIndex >= 0) {
                aEl.innerText = window._currentOptions[answerIndex] || "";
                aEl.classList.add("visible");
            }

            for (let i = 0; i < 4; i++) {
                const card = document.getElementById("opt" + i);
                const badgeContainer = document.getElementById("badges" + i);
                if (card) {
                    card.classList.remove("correct");
                    if (i === answerIndex) card.classList.add("correct");
                }
                if (badgeContainer) {
                    badgeContainer.innerHTML = "";
                    const pickers = selections.filter(s => s.choice === i);
                    pickers.forEach(p => {
                        const badge = document.createElement("div");
                        badge.className = "teamBadge";
                        badge.innerText = p.name;
                        badgeContainer.appendChild(badge);
                    });
                }
            }
        } else {
            // Options were skipped, just show the answer directly
            if (aEl) {
                aEl.innerText = answerText || window._currentOptions[answerIndex] || "No answer provided";
                aEl.classList.add("visible");
            }
            document.getElementById("divider")?.classList.add("visible");
        }
    }

    if (msg.control === "hideAnswer") {
        const aEl = document.getElementById("previewA");
        if (aEl) { aEl.innerText = ""; aEl.classList.remove("visible"); }

        for (let i = 0; i < 4; i++) {
            document.getElementById("opt" + i)?.classList.remove("correct");
            const bc = document.getElementById("badges" + i);
            if (bc) bc.innerHTML = "";
        }
    }

    if (msg.control === "QHide" || (Array.isArray(msg.control) && msg.control.includes("QHide"))) {
        const qEl = document.getElementById("previewQ");
        if (qEl) { qEl.innerText = "Waiting for next question..."; qEl.classList.add("empty"); }

        const aEl = document.getElementById("previewA");
        if (aEl) { aEl.innerText = ""; aEl.classList.remove("visible"); }

        document.getElementById("optionsGrid")?.classList.remove("visible");
        document.getElementById("divider")?.classList.remove("visible");
        document.getElementById("previewPoints")?.classList.remove("visible");
    }

    if (msg.control === "announcement") {
        const overlay = document.getElementById("annOverlay");
        const msgEl = document.getElementById("annMsg");
        if (msgEl) msgEl.innerText = msg.data?.text || "";
        if (overlay) {
            overlay.style.display = "flex";
            overlay.offsetHeight;
            overlay.classList.add("active");
        }
    }
    if (msg.control === "clearAnnouncement") {
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

    if (msg.control === "masterFreeze") {
        document.getElementById("freezeOverlay").style.display = "flex";
    }
    if (msg.control === "masterUnfreeze") {
        document.getElementById("freezeOverlay").style.display = "none";
    }

    if (msg.control === "toggleLeaderboard") {
        showLeaderboardOverlay(msg.data?.enabled);
    }
};

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
