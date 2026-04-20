document.addEventListener('DOMContentLoaded', () => {
    const mobileSortBtn = document.getElementById('mobileSortBtn');
    if (!mobileSortBtn) return;

    const sortOptions = [
        { key: 'newest', label: 'Newest', params: { sortBy: 'created_at', sortOrder: 'desc', random: false } },
        { key: 'cheapest', label: 'Cheapest', params: { sortBy: 'price', sortOrder: 'asc', random: false } },
        { key: 'most_expensive', label: 'Most Expensive', params: { sortBy: 'price', sortOrder: 'desc', random: false } },
        { key: 'oldest', label: 'Oldest', params: { sortBy: 'created_at', sortOrder: 'asc', random: false } },
        { key: 'mixed', label: 'Mixed', params: { sortBy: 'created_at', sortOrder: 'desc', random: true } }
    ];

    let activeIndex = 0;

    const updateSortButton = () => {
        const span = mobileSortBtn.querySelector('span');
        if (span) span.textContent = sortOptions[activeIndex].label;
        mobileSortBtn.setAttribute('data-sort-key', sortOptions[activeIndex].key);
        mobileSortBtn.setAttribute('title', `Sort: ${sortOptions[activeIndex].label}`);
    };

    const applySort = () => {
        const activeOption = sortOptions[activeIndex];
        if (!activeOption || !window.loadListings) return;

        window.loadListings(true, {
            sortBy: activeOption.params.sortBy,
            sortOrder: activeOption.params.sortOrder,
            random: activeOption.params.random
        });
    };

    mobileSortBtn.addEventListener('click', () => {
        activeIndex = (activeIndex + 1) % sortOptions.length;
        updateSortButton();
        applySort();
    });

    updateSortButton();

    // Mobile Filter Button - Open modal with filters
    const mobileFilterBtn = document.getElementById('mobileFilterBtn');
    const mobileFilterModal = document.getElementById('mobileFilterModal');
    const mobileFilterClose = document.getElementById('mobileFilterClose');
    const mobileFilterApply = document.getElementById('mobileFilterApply');
    const mobileFilterClear = document.getElementById('mobileFilterClear');
    const mobileSidebarFilters = document.getElementById('mobileSidebarFilters');

    if (mobileFilterBtn && mobileFilterModal) {
        mobileFilterBtn.addEventListener('click', () => {
            // Copy sidebar filters to modal
            const sidebarFilters = document.getElementById('sidebarFilters');
            if (sidebarFilters && mobileSidebarFilters) {
                mobileSidebarFilters.innerHTML = sidebarFilters.innerHTML;
                // Re-bind events after copying
                if (window.sidebarFilters && typeof window.sidebarFilters.bindDynamicEvents === 'function') {
                    setTimeout(() => window.sidebarFilters.bindDynamicEvents(), 100);
                }
            }
            mobileFilterModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        });

        // Close modal
        const closeModal = () => {
            mobileFilterModal.style.display = 'none';
            document.body.style.overflow = '';
        };

        mobileFilterClose?.addEventListener('click', closeModal);
        mobileFilterModal.querySelector('.mobile-filter-overlay')?.addEventListener('click', closeModal);

        // Apply filters
        mobileFilterApply?.addEventListener('click', () => {
            if (window.sidebarFilters && typeof window.sidebarFilters.executeSearch === 'function') {
                window.sidebarFilters.executeSearch();
            }
            closeModal();
        });

        // Clear filters
        mobileFilterClear?.addEventListener('click', () => {
            if (window.sidebarFilters && typeof window.sidebarFilters.clearFilters === 'function') {
                window.sidebarFilters.clearFilters();
            }
            closeModal();
        });
    }
});
