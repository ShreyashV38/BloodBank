// public/js/clock.js — Live clock with date
function updateClock() {
    const el = document.getElementById('clock');
    if (!el) return;
    const now = new Date();
    const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    el.textContent = `${date} • ${time}`;
}
updateClock();
setInterval(updateClock, 30000);
