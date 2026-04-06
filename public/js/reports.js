// Reports page — Chart.js initialization
// Reads data from a <script type="application/json" id="chartData"> block in the page
document.addEventListener('DOMContentLoaded', () => {
    const dataEl = document.getElementById('chartData');
    if (!dataEl) return;
    const data = JSON.parse(dataEl.textContent);

    // ── Blood Stock Bar Chart ────────────────────────────────────
    const stockColors = data.stockData.map(u => u <= 3 ? '#dc2626' : u <= 7 ? '#d97706' : '#16a34a');

    new Chart(document.getElementById('stockChart'), {
        type: 'bar',
        data: {
            labels: data.stockLabels,
            datasets: [{
                label: 'Units Available',
                data: data.stockData,
                backgroundColor: stockColors,
                borderRadius: 8,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false }, tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.parsed.y} unit(s)`
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,.08)' } },
                x: { grid: { display: false } }
            }
        }
    });

    // ── Request Status Doughnut ──────────────────────────────────
    const reqColors = data.reqLabels.map(s =>
        s === 'Fulfilled' ? '#16a34a' : s === 'Rejected' ? '#dc2626' :
            s === 'Pending' ? '#d97706' : '#2563eb'
    );

    new Chart(document.getElementById('requestChart'), {
        type: 'doughnut',
        data: {
            labels: data.reqLabels,
            datasets: [{ data: data.reqData, backgroundColor: reqColors, borderWidth: 3, borderColor: '#1a1a2e' }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });

    // ── Donation Units Line Chart ────────────────────────────────
    new Chart(document.getElementById('donationChart'), {
        type: 'line',
        data: {
            labels: data.donLabels,
            datasets: [{
                label: 'Units Donated (Approved)',
                data: data.donData,
                borderColor: '#c0392b',
                backgroundColor: 'rgba(192,57,43,.15)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#c0392b',
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,.08)' } },
                x: { grid: { display: false } }
            }
        }
    });
});
