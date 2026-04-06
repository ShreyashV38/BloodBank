// Password strength meter for reset-password page
function checkPwStrength(pw) {
    const el = document.getElementById('pwStr');
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pw)) s++;
    el.className = 'password-strength ' +
        (s <= 1 ? 'weak' : s === 2 ? 'medium' : s === 3 ? 'strong' : 'very-strong');
}
