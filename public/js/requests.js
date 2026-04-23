// Approve modal logic for blood requests page
function openApprove(reqId, units, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    alert('Approve button clicked! Request ID: ' + reqId);
    console.log('[APPROVE-UI] openApprove called', { reqId, units });
    document.getElementById('modalReqId').textContent = reqId;
    document.getElementById('modalUnits').value = units;
    document.getElementById('approveForm').action = '/requests/approve/' + reqId;
    console.log('[APPROVE-UI] Form action set to:', document.getElementById('approveForm').action);
    const m = document.getElementById('approveModal');
    m.style.display = 'flex';
    console.log('[APPROVE-UI] Modal displayed');
}

function closeApprove() {
    document.getElementById('approveModal').style.display = 'none';
}

// Add form submit debugging
document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('approveForm');
    if (form) {
        form.addEventListener('submit', function (e) {
            alert('Confirm Approve clicked! Submitting form to server...');
            const formData = new FormData(form);
            const data = {};
            formData.forEach((v, k) => data[k] = v);
            console.log('[APPROVE-UI] Form submitting to:', form.action);
            console.log('[APPROVE-UI] Form data:', data);

            // Validate before submit
            const invId = form.querySelector('[name="inventory_id"]').value;
            const unitsProv = form.querySelector('[name="units_provided"]').value;
            console.log('[APPROVE-UI] inventory_id:', invId, '| units_provided:', unitsProv);

            if (!invId || !unitsProv) {
                console.error('[APPROVE-UI] BLOCKED: Missing required field(s)');
                e.preventDefault();
                alert('Please fill in all required fields (Inventory ID and Units).');
                return false;
            }

            console.log('[APPROVE-UI] Validation passed, submitting form...');
        });
    }
});
