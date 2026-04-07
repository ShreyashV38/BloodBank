// Reports page — Chart.js initialization with dark theme
// Reads data from a <script type="application/json" id="chartData"> block in the page
document.addEventListener('DOMContentLoaded', () => {
    const dataEl = document.getElementById('chartData');
    if (!dataEl) return;

    // Guard: wait for Chart.js to load
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded – charts will not render.');
        return;
    }

    const data = JSON.parse(dataEl.textContent);

    // ── Global Chart.js defaults for dark theme ────────────────
    Chart.defaults.color = '#B0B0B0';
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 12;

    // Blood group colors
    const bloodGroupColors = [
        '#E53935', '#C62828', '#1E88E5', '#1565C0',
        '#8E24AA', '#6A1B9A', '#FB8C00', '#EF6C00'
    ];

    // ── Blood Stock Bar Chart ────────────────────────────────────
    const stockColors = data.stockData.map(u =>
        u <= 3 ? '#EF5350' : u <= 7 ? '#FF9800' : '#4CAF50'
    );

    new Chart(document.getElementById('stockChart'), {
        type: 'bar',
        data: {
            labels: data.stockLabels,
            datasets: [{
                label: 'Units Available',
                data: data.stockData,
                backgroundColor: stockColors.map(c => c + '99'),
                borderColor: stockColors,
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1A1A1A',
                    borderColor: '#2D2D2D',
                    borderWidth: 1,
                    padding: 12,
                    titleFont: { weight: '600' },
                    callbacks: { label: ctx => ` ${ctx.parsed.y} unit(s)` }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,.06)', drawBorder: false },
                    ticks: { padding: 8 }
                },
                x: {
                    grid: { display: false },
                    ticks: { padding: 8, font: { weight: '600' } }
                }
            }
        }
    });

    // ── Request Status Doughnut ──────────────────────────────────
    const statusColors = {
        'Fulfilled': '#4CAF50',
        'Rejected': '#F44336',
        'Pending': '#FF9800',
        'Approved': '#2196F3',
        'Cancelled': '#9E9E9E'
    };
    const reqColors = data.reqLabels.map(s => statusColors[s] || '#6366F1');

    new Chart(document.getElementById('requestChart'), {
        type: 'doughnut',
        data: {
            labels: data.reqLabels,
            datasets: [{
                data: data.reqData,
                backgroundColor: reqColors.map(c => c + 'CC'),
                borderColor: '#1A1A1A',
                borderWidth: 3,
                hoverBorderColor: '#2D2D2D',
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 16,
                        usePointStyle: true,
                        pointStyleWidth: 12,
                        font: { size: 12, weight: '500' }
                    }
                },
                tooltip: {
                    backgroundColor: '#1A1A1A',
                    borderColor: '#2D2D2D',
                    borderWidth: 1,
                    padding: 12
                }
            }
        }
    });

    // ── Donation Units Bar Chart (horizontal) ────────────────────
    new Chart(document.getElementById('donationChart'), {
        type: 'bar',
        data: {
            labels: data.donLabels,
            datasets: [{
                label: 'Units Donated',
                data: data.donData,
                backgroundColor: bloodGroupColors.slice(0, data.donLabels.length).map(c => c + '80'),
                borderColor: bloodGroupColors.slice(0, data.donLabels.length),
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1A1A1A',
                    borderColor: '#2D2D2D',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: { label: ctx => ` ${ctx.parsed.x} unit(s) donated` }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,.06)', drawBorder: false },
                    ticks: { padding: 8 }
                },
                y: {
                    grid: { display: false },
                    ticks: { padding: 8, font: { weight: '600' } }
                }
            }
        }
    });

    // ── Monthly Trends Area Chart ────────────────────────────────
    const monthlyCtx = document.getElementById('monthlyChart');
    if (monthlyCtx) {
        const gradient = monthlyCtx.getContext('2d');
        const gradientFill = gradient.createLinearGradient(0, 0, 0, 280);
        gradientFill.addColorStop(0, 'rgba(183, 28, 28, 0.35)');
        gradientFill.addColorStop(1, 'rgba(183, 28, 28, 0.01)');

        new Chart(monthlyCtx, {
            type: 'line',
            data: {
                labels: data.monthLabels,
                datasets: [{
                    label: 'Donations',
                    data: data.monthDonations,
                    borderColor: '#EF5350',
                    backgroundColor: gradientFill,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#EF5350',
                    pointBorderColor: '#1A1A1A',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                }, {
                    label: 'Units Collected',
                    data: data.monthUnits,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.08)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#4CAF50',
                    pointBorderColor: '#1A1A1A',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    borderDash: [6, 3],
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: {
                            padding: 16,
                            usePointStyle: true,
                            pointStyleWidth: 12,
                            font: { size: 12, weight: '500' }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1A1A1A',
                        borderColor: '#2D2D2D',
                        borderWidth: 1,
                        padding: 12
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,.06)', drawBorder: false },
                        ticks: { padding: 8 }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { padding: 8, font: { weight: '500' } }
                    }
                }
            }
        });
    }

    // ── Animate summary stat counters ────────────────────────────
    document.querySelectorAll('.analytics-stat-val[data-count]').forEach(el => {
        const target = parseInt(el.dataset.count) || 0;
        if (target === 0) { el.textContent = '0'; return; }
        let current = 0;
        const duration = 1200;
        const step = Math.max(1, Math.ceil(target / (duration / 16)));
        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            el.textContent = current.toLocaleString();
        }, 16);
    });
});
