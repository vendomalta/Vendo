// Toggle collapsible profile sections (e.g., Personal Info)
(function(){
    'use strict';

    function initProfileToggles() {
        // Move personal-info edit button below the bio section for better UX
        try {
            const personal = document.querySelector('#personal-info');
            if (personal) {
                const header = personal.querySelector('.section-header');
                const editBtn = header ? header.querySelector('.edit-btn') : null;
                const bio = personal.querySelector('.bio-section');
                if (editBtn && bio) {
                    // ensure button isn't already moved
                    if (!bio.parentElement.contains(editBtn) || editBtn.previousElementSibling !== bio) {
                        // detach and re-insert after bio
                        editBtn.remove();
                        const wrapper = document.createElement('div');
                        wrapper.className = 'bio-edit-wrap';
                        wrapper.appendChild(editBtn);
                        bio.after(wrapper);
                    }
                }
            }
        } catch (err) {
            console.warn('profile-toggle: could not move edit button', err);
        }
        document.querySelectorAll('.section-header').forEach(header => {
            // make header clickable
            header.style.cursor = 'pointer';

            // Add an affordance if not present
            if (!header.querySelector('.toggle-chevron')) {
                const chevron = document.createElement('span');
                chevron.className = 'toggle-chevron';
                chevron.setAttribute('aria-hidden', 'true');
                chevron.innerHTML = '<i class="fas fa-chevron-up"></i>';
                header.appendChild(chevron);
            }

            header.addEventListener('click', (e) => {
                // avoid toggling when clicking the edit button inside header
                const editBtn = header.querySelector('.edit-btn');
                if (editBtn && (editBtn === e.target || editBtn.contains(e.target))) return;

                const section = header.nextElementSibling;
                if (!section) return;

                // Toggle active/collapsed state on the parent container
                const container = header.closest('.tab-content');
                if (!container) return;

                const chevron = header.querySelector('.toggle-chevron i');

                if (container.classList.toggle('collapsed')) {
                    // collapsed
                    if (chevron) chevron.className = 'fas fa-chevron-down';
                } else {
                    // expanded
                    if (chevron) chevron.className = 'fas fa-chevron-up';
                }
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initProfileToggles);
    } else {
        initProfileToggles();
    }
})();
