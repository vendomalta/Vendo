// Pagination dinamik render sistemi
export function renderPagination(currentPage, totalPages, container) {
    if (!container || totalPages <= 1) return;
    container.setAttribute('role', 'navigation');
    container.setAttribute('aria-label', 'Sayfalama');

    const maxVisible = 5;
    const pages = [];

    // İlk sayfa
    pages.push(1);

    // Başlangıçtan önce nokta
    if (currentPage > 3) {
        pages.push('...');
    }

    // Mevcut aralık
    const startPage = Math.max(2, currentPage - 1);
    const endPage = Math.min(totalPages - 1, currentPage + 1);

    for (let i = startPage; i <= endPage; i++) {
        if (!pages.includes(i)) {
            pages.push(i);
        }
    }

    // Sondan önce nokta
    if (currentPage < totalPages - 2) {
        pages.push('...');
    }

    // Son sayfa
    if (totalPages > 1 && !pages.includes(totalPages)) {
        pages.push(totalPages);
    }

    // HTML oluştur
    const paginationHTML = `
        <button class="prev ${currentPage === 1 ? 'disabled' : ''}" 
                data-page="${currentPage - 1}"
                ${currentPage === 1 ? 'disabled aria-disabled="true"' : ''} aria-label="Önceki sayfa">
            <i class="fas fa-chevron-left"></i>
        </button>
        ${pages.map(p => {
            if (p === '...') {
                return '<span class="dots" aria-hidden="true">...</span>';
            }
            return `
                <button class="page-number ${p === currentPage ? 'active' : ''}" 
                        data-page="${p}"
                        ${p === currentPage ? 'aria-current="page"' : ''} aria-label="${p}. sayfa">
                    ${p}
                </button>
            `;
        }).join('')}
        <button class="next ${currentPage === totalPages ? 'disabled' : ''}" 
                data-page="${currentPage + 1}"
                ${currentPage === totalPages ? 'disabled aria-disabled="true"' : ''} aria-label="Sonraki sayfa">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;

    container.innerHTML = paginationHTML;

    // Event listeners ekle
    container.querySelectorAll('button[data-page]').forEach(btn => {
        btn.addEventListener('click', function(e) {
            if (this.disabled) return;
            const page = parseInt(this.dataset.page);
            if (typeof window.loadListings === 'function') {
                window.loadListings({ page });
                // URL'yi güncelle (yeniden yükleme olmadan)
                try {
                    const url = new URL(window.location.href);
                    if (page > 1) {
                        url.searchParams.set('page', String(page));
                    } else {
                        url.searchParams.delete('page');
                    }
                    window.history.replaceState(null, '', url.toString());
                } catch (_) {}
                // Listeye odaklan
                try {
                    const grid = document.querySelector('.listings-grid');
                    if (grid) grid.focus({ preventScroll: true });
                } catch (_) {}
            }
        });
    });
}

// Sayfa yüklendiğinde pagination'ı güncelle
document.addEventListener('DOMContentLoaded', () => {
    // listings-loader.js'den gelen sonuçları dinle
    const originalLoadListings = window.loadListings;
    
    if (originalLoadListings) {
        window.loadListings = async function(...args) {
            // Forward all arguments (isFirstLoad, options)
            const result = await originalLoadListings(...args);
            
            // Extract options for pagination logic
            const options = (typeof args[0] === 'object') ? args[0] : (args[1] || {});
            
            // Pagination container'ı bul ve güncelle
            const paginationContainer = document.querySelector('.pagination');
            if (paginationContainer && result) {
                // URL'den ya da options'dan geçerli sayfayı hesapla
                let currentPage = 1;
                if (typeof options.page === 'number') currentPage = options.page;
                else {
                    try {
                        const url = new URL(window.location.href);
                        const qp = parseInt(url.searchParams.get('page'));
                        if (!isNaN(qp) && qp > 0) currentPage = qp;
                    } catch (_) {}
                }
                const totalPages = result.totalPages || 1;
                renderPagination(currentPage, totalPages, paginationContainer);
            }
            
            return result;
        };
    }
});

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { renderPagination };
}
