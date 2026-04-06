// ============================================================
// public/js/app.js — UI Enhancements
// Staggered animations, auto-dismiss alerts, number counters
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // ── Staggered entrance animations ────────────────────────
    const animateElements = document.querySelectorAll('.stat-card, .stat-box, .card, .camp-card, .eligibility-card');
    animateElements.forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(() => {
            el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, 80 * i);
    });

    // ── Auto-dismiss alerts after 6 seconds ──────────────────
    document.querySelectorAll('.alert-success, .alert-info').forEach(alert => {
        setTimeout(() => {
            alert.style.transition = 'opacity 0.5s ease, transform 0.5s ease, max-height 0.5s ease';
            alert.style.opacity = '0';
            alert.style.transform = 'translateY(-10px)';
            alert.style.maxHeight = '0';
            alert.style.overflow = 'hidden';
            alert.style.marginBottom = '0';
            alert.style.padding = '0 18px';
            setTimeout(() => alert.remove(), 500);
        }, 6000);
    });

    // ── Smooth number counters ───────────────────────────────
    document.querySelectorAll('.stat-val, .stat-box .num').forEach(el => {
        const text = el.textContent.trim();
        const num = parseFloat(text);
        if (isNaN(num) || num === 0 || text.includes('✓') || text.includes('d')) return;
        
        const isDecimal = text.includes('.');
        const duration = 800;
        const start = performance.now();
        
        const animate = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = num * eased;
            el.textContent = isDecimal ? current.toFixed(1) : Math.round(current);
            if (progress < 1) requestAnimationFrame(animate);
        };
        
        el.textContent = '0';
        requestAnimationFrame(animate);
    });

    // ── Mobile sidebar toggle ────────────────────────────────
    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth <= 768) {
        const toggle = document.createElement('button');
        toggle.className = 'sidebar-toggle';
        toggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
        toggle.addEventListener('click', () => sidebar.classList.toggle('sidebar-open'));
        document.body.prepend(toggle);

        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('sidebar-open') && 
                !sidebar.contains(e.target) && !toggle.contains(e.target)) {
                sidebar.classList.remove('sidebar-open');
            }
        });
    }

    // ── Time-based greeting ──────────────────────────────────
    const greetingEl = document.getElementById('greeting');
    if (greetingEl) {
        const hour = new Date().getHours();
        let greeting = 'Good evening';
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 17) greeting = 'Good afternoon';
        greetingEl.textContent = greeting;
    }
});
