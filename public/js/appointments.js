// public/js/appointments.js — CSP-compliant fulfill panel logic
(function () {
    const overlay = document.getElementById('fulfillOverlay');
    const panel   = document.getElementById('fulfillPanel');
    const closeBtn = document.getElementById('closePanel');
    const form     = document.getElementById('fulfillForm');
    const nameEl   = document.getElementById('panelDonorName');
    const groupEl  = document.getElementById('panelBloodGroup');

    function openPanel(appId, donorName, bloodGroup) {
        nameEl.textContent  = donorName;
        groupEl.textContent = bloodGroup;
        form.action = '/hospital-portal/appointments/fulfill/' + appId;
        overlay.style.display = 'block';
        panel.style.display   = 'block';
    }

    function closePanel() {
        overlay.style.display = 'none';
        panel.style.display   = 'none';
    }

    // Wire up all Fulfill buttons via event delegation
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.js-fulfill-btn');
        if (btn) {
            openPanel(
                btn.dataset.id,
                btn.dataset.name,
                btn.dataset.group
            );
            return;
        }
        if (e.target === overlay || e.target === closeBtn) {
            closePanel();
        }
    });
})();
