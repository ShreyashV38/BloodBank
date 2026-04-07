// public/js/signup.js — Multi-step wizard logic
let currentStep = 1;
const totalSteps = 3;

// Role selector toggle
function selectRole(role, element) {
    document.querySelectorAll('.role-card').forEach(el => el.classList.remove('selected'));
    if (element) {
        element.classList.add('selected');
        const radio = element.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
    }
    
    // Hide all role-specific detail sections in Step 3
    document.querySelectorAll('.role-fields').forEach(el => el.style.display = 'none');
    
    // Show the selected role's details
    const fields = document.getElementById(role.toLowerCase() + '-fields');
    if (fields) fields.style.display = 'block';

    // Disable required attributes for hidden fields to allow form submission
    document.querySelectorAll('.role-fields input, .role-fields select').forEach(input => {
        input.removeAttribute('required');
    });

    // Enable required attributes for the visible fields
    if (fields) {
        fields.querySelectorAll('input[placeholder*="*"], select').forEach(input => {
             // Basic heuristic: if it has an asterisk placeholder or is a select, make it required
             // A better approach is explicit data-required attributes, but this works for the current template
             if (input.name !== 'address') {
                 input.setAttribute('required', 'required');
             }
        });
    }
}

// Password strength meter
function checkPasswordStrength(pw) {
    const el = document.getElementById('pwStrength');
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pw)) score++;
    
    if (score <= 1) el.className = 'password-strength weak';
    else if (score === 2) el.className = 'password-strength medium';
    else if (score === 3) el.className = 'password-strength strong';
    else el.className = 'password-strength very-strong';
}

// Wizard Navigation
function goToStep(step) {
    // Basic validation before moving forward
    if (step > currentStep) {
        if (currentStep === 1) {
            const role = document.querySelector('input[name="role"]:checked');
            if (!role) {
                alert("Please select a role to continue.");
                return;
            }
        } else if (currentStep === 2) {
            // Check HTML5 validation for visible inputs in step 2
            const step2Inputs = document.querySelectorAll('#step2 input[required]');
            let valid = true;
            for (const input of step2Inputs) {
                if (!input.checkValidity()) {
                    input.reportValidity();
                    valid = false;
                    break;
                }
            }
            if (!valid) return;
            
            // Custom password match check
            const pw = document.getElementById('signupPassword').value;
            const confirmPw = document.querySelector('input[name="confirm_password"]').value;
            if (pw !== confirmPw) {
                alert("Passwords do not match.");
                return;
            }
        }
    }

    currentStep = step;
    
    // Update Panels
    document.querySelectorAll('.wizard-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`step${step}`).classList.add('active');

    // Update Indicators
    for (let i = 1; i <= totalSteps; i++) {
        const indicator = document.querySelector(`.wizard-step-indicator[data-step="${i}"]`);
        const connector = document.getElementById(`conn${i - 1}`);
        
        if (i < step) {
            indicator.className = 'wizard-step-indicator completed';
            if (connector) connector.classList.add('active');
        } else if (i === step) {
            indicator.className = 'wizard-step-indicator active';
            if (connector) connector.classList.remove('active');
        } else {
            indicator.className = 'wizard-step-indicator';
            if (connector) connector.classList.remove('active');
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Attach event listeners for role cards
    document.querySelectorAll('.role-card').forEach(card => {
        card.addEventListener('click', function() {
            const role = this.getAttribute('data-role');
            selectRole(role, this);
        });
    });

    // Attach event listeners for wizard navigation buttons
    const btnNext1 = document.getElementById('btnNext1');
    if (btnNext1) btnNext1.addEventListener('click', () => goToStep(2));

    const btnBack1 = document.getElementById('btnBack1');
    if (btnBack1) btnBack1.addEventListener('click', () => goToStep(1));

    const btnNext2 = document.getElementById('btnNext2');
    if (btnNext2) btnNext2.addEventListener('click', () => goToStep(3));

    const btnBack2 = document.getElementById('btnBack2');
    if (btnBack2) btnBack2.addEventListener('click', () => goToStep(2));

    // If a role is pre-selected (e.g. form validation error occurred and state was kept)
    const checkedRole = document.querySelector('input[name="role"]:checked');
    if (checkedRole) {
        const label = checkedRole.closest('.role-card');
        selectRole(checkedRole.value, label);
    } else {
        // Default to Donor if nothing is selected
        const donorCard = document.querySelector('input[value="Donor"]').closest('.role-card');
        selectRole('Donor', donorCard);
    }
});
