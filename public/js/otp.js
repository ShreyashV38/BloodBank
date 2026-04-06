// OTP input auto-focus handling
const inputs = document.querySelectorAll('.otp-input');
const hidden = document.getElementById('otpHidden');
const form = document.getElementById('otpForm');

inputs.forEach((input, i) => {
    input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        e.target.value = val;
        if (val && i < 5) inputs[i + 1].focus();
        updateHidden();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && i > 0) {
            inputs[i - 1].focus();
        }
    });

    input.addEventListener('paste', (e) => {
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
        paste.split('').forEach((ch, j) => {
            if (inputs[j]) { inputs[j].value = ch; }
        });
        const last = Math.min(paste.length, 6) - 1;
        if (inputs[last]) inputs[last].focus();
        updateHidden();
    });
});

function updateHidden() {
    hidden.value = Array.from(inputs).map(i => i.value).join('');
}

form.addEventListener('submit', () => updateHidden());

// Countdown timer — reads initial value from data attribute on timer element
const timerEl = document.getElementById('timer');
let remaining = parseInt(timerEl.dataset.remaining) || 0;

function tick() {
    if (remaining <= 0) {
        timerEl.textContent = 'Expired';
        timerEl.style.color = 'var(--danger)';
        return;
    }
    remaining--;
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    timerEl.textContent = m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}`;
}

setInterval(tick, 1000);
