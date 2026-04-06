// Role selector toggle
function selectRole(role) {
    document.querySelectorAll('.role-option').forEach(el => el.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    document.querySelectorAll('.role-fields').forEach(el => el.classList.remove('active'));
    const fields = document.getElementById(role.toLowerCase() + '-fields');
    if (fields) fields.classList.add('active');
}

// Password strength meter
function checkPasswordStrength(pw) {
    const el = document.getElementById('pwStrength');
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pw)) score++;
    el.className = 'password-strength ' +
        (score <= 1 ? 'weak' : score === 2 ? 'medium' : score === 3 ? 'strong' : 'very-strong');
}

// Show fields for pre-selected role on page load
document.addEventListener('DOMContentLoaded', () => {
    const checkedRole = document.querySelector('input[name="role"]:checked');
    if (checkedRole) {
        const fields = document.getElementById(checkedRole.value.toLowerCase() + '-fields');
        if (fields) fields.classList.add('active');
    }
});
