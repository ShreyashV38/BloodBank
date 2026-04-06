// Approve modal logic for blood requests page
function openApprove(reqId, units) {
    document.getElementById('modalReqId').textContent = reqId;
    document.getElementById('modalUnits').value = units;
    document.getElementById('approveForm').action = '/requests/approve/' + reqId;
    const m = document.getElementById('approveModal');
    m.style.display = 'flex';
}
function closeApprove() {
    document.getElementById('approveModal').style.display = 'none';
}
