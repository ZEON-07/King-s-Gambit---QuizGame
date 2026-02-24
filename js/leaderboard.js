const WORKER_URL = 'https://kings-gambit-worker.mr-adhi125.workers.dev';
const API = WORKER_URL || '';

const MEDALS = [
    '<i class="fa-solid fa-medal" style="color:#FFD700;"></i>',
    '<i class="fa-solid fa-medal" style="color:#C0C0C0;"></i>',
    '<i class="fa-solid fa-medal" style="color:#CD7F32;"></i>'
];

let pollTimer = null;
let isFetching = false;
async function fetchLeaderboard() {
    if (isFetching) return;
    isFetching = true;

    const container = document.getElementById('lbContent');
    const statusLabel = document.getElementById('lastUpdated');

    if (!API && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')) {
        container.innerHTML = `
        <div class="lb-locked">
            <div class="lock-icon"><i class="fa-solid fa-gear"></i></div>
            <h2>Configuration Required</h2>
            <p>Worker URL is empty.</p>
        </div>`;
        statusLabel.innerText = "Configuration required";
        isFetching = false;
        return;
    }

    try {
        const res = await fetch(API + '/api/leaderboard');

        if (res.status === 403) {
            container.innerHTML = `
                <div class="lb-locked">
                    <div class="lock-icon"><i class="fa-solid fa-lock"></i></div>
                    <h2>Leaderboard not available yet</h2>
                    <p>The administrator hasn't enabled the leaderboard.</p>
                </div>`;
            document.getElementById('liveIndicator').style.color = '#555';
            document.getElementById('liveIndicator').querySelector('span').style.background = '#555';
            statusLabel.innerText = "Leaderboard locked";
            isFetching = false;
            return;
        }

        if (!res.ok) throw new Error(`Server returned ${res.status}`);

        const data = await res.json();
        if (!data.leaderboard) throw new Error("Invalid response format");

        if (data.leaderboard.length === 0) {
            container.innerHTML = `
                <div class="lb-locked">
                    <div class="lock-icon"><i class="fa-solid fa-trophy"></i></div>
                    <h2>No scores yet</h2>
                    <p>Be the first to answer a question!</p>
                </div>`;
            return;
        }

        const rows = data.leaderboard.map(entry => {
            const rankClass = entry.rank <= 3 ? `rank-${entry.rank}` : '';
            const medal = MEDALS[entry.rank - 1] || `#${entry.rank}`;
            return `
                <div class="lb-row ${rankClass}">
                    <div class="lb-rank">${entry.rank}</div>
                    <div class="lb-medal">${medal}</div>
                    <div class="lb-name">${escapeHTML(entry.team_name)}</div>
                    <div class="lb-score">${entry.score}<span class="lb-pts"> PTS</span></div>
                </div>`;
        }).join('');

        container.innerHTML = `<div style="width:100%">${rows}</div>`;
        statusLabel.innerText = `Last updated: ${new Date().toLocaleTimeString()}`;

        const liveEl = document.getElementById('liveIndicator');
        liveEl.style.color = '#22c55e';
        liveEl.querySelector('span').style.background = '#22c55e';

    } catch (e) {
        if (container.querySelector('.fa-spinner')) {
            container.innerHTML = `
                <div class="lb-locked">
                    <div class="lock-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
                    <h2>Connection error</h2>
                </div>`;
        }
        statusLabel.innerText = `Update failed`;
        const liveEl = document.getElementById('liveIndicator');
        liveEl.style.color = '#f44';
        liveEl.querySelector('span').style.background = '#f44';
    } finally {
        isFetching = false;
    }
}

function manualRefresh() {
    resetPolling();
    fetchLeaderboard();
}

function resetPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(fetchLeaderboard, 5000);
}
function escapeHTML(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
window.onload = () => {
    fetchLeaderboard();
    resetPolling();
};
