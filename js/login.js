const API = 'https://kings-gambit-worker.mr-adhi125.workers.dev';
async function attemptLogin() {
    const passkey = document.getElementById('teamPass').value.trim().toUpperCase();
    const statusEl = document.getElementById('loginStatus');
    const btn = document.getElementById('loginBtn');

    if (!passkey) {
        customAlert("Please enter your passkey!");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying…';
    statusEl.innerText = "Connecting to server...";
    statusEl.style.color = "#888";

    try {
        const res = await fetch(API + '/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passkey })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Invalid passkey");
        }

        const data = await res.json();

        localStorage.setItem('team_id', data.team_id);
        localStorage.setItem('team_name', data.team_name);
        localStorage.setItem('session_token', data.session_token);

        statusEl.innerText = "Welcome, " + data.team_name + "!";
        statusEl.style.color = "#22c55e";

        setTimeout(() => {
            window.location.href = 'quiz.html';
        }, 1000);

    } catch (e) {
        statusEl.innerText = e.message;
        statusEl.style.color = "#ff6b6b";
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-chess-king"></i> Enter the Arena';
    }
}

window.onload = () => {
    const input = document.getElementById('teamPass');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') attemptLogin();
        });
        input.focus();
    }
};
