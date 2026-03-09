// ✅ Logger import et
import logger from './logger.js';
import TransactionApprovalManager from './transaction-approval.js';

// Satıcı Değerlendirme Formu Modalı
async function showRatingForm(listingId, sellerId) {
    try {
        // Supabase global olarak erişilebilir olmalı
        if (typeof supabase === 'undefined') {
            logger.error('Supabase client not found', new Error('Supabase undefined'));
            return;
        }

        // Kullanıcı kontrol et
        const user = await getCurrentUser();
        if (!user) {
            logger.toast('Please sign in to leave a review', 'warning');
            window.location.href = '/login.html';
            return;
        }

        // 🆕 İşlem Onay Sistemi Kontrolü
        const approvalManager = new TransactionApprovalManager(supabase);
        const canRateResult = await approvalManager.canUserRate(listingId, sellerId, user.id);

        if (!canRateResult.canRate) {
            logger.toast(canRateResult.reason, 'warning');
            return;
        }

        // Daha önce bu satıcıya yorum yapıp yapmadığını kontrol et
        const { data: existingReview, error: checkError } = await supabase
            .from('seller_ratings')
            .select('id')
            .eq('listing_id', listingId)
            .eq('buyer_id', user.id)
            .single();

        if (existingReview) {
            logger.toast('Bu satıcının bu ürünü için zaten yorum yapmışsınız', 'info');
            return;
        }

        // Form HTML'ini oluştur
        const formHtml = `
            <div class="rating-form-container">
                <form id="seller-rating-form">
                    <div class="form-group">
                        <label>Değerlendirme (1-5 Yıldız)</label>
                        <div class="star-selector" id="star-selector">
                            <i class="fas fa-star" data-rating="1"></i>
                            <i class="fas fa-star" data-rating="2"></i>
                            <i class="fas fa-star" data-rating="3"></i>
                            <i class="fas fa-star" data-rating="4"></i>
                            <i class="fas fa-star" data-rating="5"></i>
                        </div>
                        <input type="hidden" id="rating-value" name="rating" value="0" required>
                        <small id="rating-display" style="color: #64748b;">Lütfen yıldız seçiniz</small>
                    </div>

                    <div class="form-group">
                        <label for="rating-comment">Yorum (Opsiyonel)</label>
                        <textarea 
                            id="rating-comment" 
                            name="comment" 
                            placeholder="Satıcının hizmeti hakkında düşüncelerinizi yazınız..."
                            rows="4"
                            maxlength="500"
                            style="width: 100%; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px; font-family: inherit;"
                        ></textarea>
                        <small style="color: #64748b; display: block; margin-top: 0.25rem;">
                            <span id="char-count">0</span>/500
                        </small>
                    </div>

                    <div class="form-group" style="display: flex; gap: 1rem;">
                        <button type="submit" class="btn-submit" style="flex: 1; padding: 0.75rem; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                            Yorum Gönder
                        </button>
                        <button type="button" class="btn-cancel" style="flex: 1; padding: 0.75rem; background: #f1f5f9; color: #1e293b; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; font-weight: 600;" onclick="Modal.close()">
                            İptal
                        </button>
                    </div>

                    <small style="color: #94a3b8; text-align: center; display: block; margin-top: 1rem;">
                        Yorum onaylanmadan önce inceleme yapılacaktır
                    </small>
                </form>
            </div>
        `;

        // Modal göster
        if (typeof Modal !== 'undefined' && Modal.open) {
            Modal.open('Satıcıyı Değerlendir', formHtml, []);
        } else {
            console.warn('Modal system not available');
            return;
        }

        // Yıldız seçici event listener
        const starSelector = document.getElementById('star-selector');
        const ratingValue = document.getElementById('rating-value');
        const ratingDisplay = document.getElementById('rating-display');
        const stars = starSelector.querySelectorAll('i');

        stars.forEach(star => {
            star.addEventListener('click', function() {
                const rating = this.getAttribute('data-rating');
                ratingValue.value = rating;
                
                // Yıldızları güncelle
                stars.forEach((s, index) => {
                    if (index < rating) {
                        s.style.color = '#fbbf24';
                    } else {
                        s.style.color = '#e5e7eb';
                    }
                });

                ratingDisplay.textContent = `${rating} yıldız seçtiniz`;
                ratingDisplay.style.color = '#10b981';
            });

            // Hover efekti
            star.addEventListener('mouseenter', function() {
                const hoverRating = this.getAttribute('data-rating');
                stars.forEach((s, index) => {
                    if (index < hoverRating) {
                        s.style.color = '#fbbf24';
                    } else {
                        s.style.color = '#e5e7eb';
                    }
                });
            });
        });

        starSelector.addEventListener('mouseleave', () => {
            const currentRating = ratingValue.value;
            stars.forEach((s, index) => {
                if (index < currentRating) {
                    s.style.color = '#fbbf24';
                } else {
                    s.style.color = '#e5e7eb';
                }
            });
        });

        // Character count
        const commentTextarea = document.getElementById('rating-comment');
        commentTextarea.addEventListener('input', function() {
            document.getElementById('char-count').textContent = this.value.length;
        });

        // Form gönderme
        const form = document.getElementById('seller-rating-form');
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            const rating = parseInt(ratingValue.value);
            const comment = commentTextarea.value.trim();

            if (rating === 0) {
                logger.toast('Lütfen yıldız seçiniz', 'warning');
                return;
            }

            try {
                // 🆕 İşlem onay ID'sini bul
                const approvalManager = new TransactionApprovalManager(supabase);
                const approval = await approvalManager.getOrCreateApproval(listingId, user.id, sellerId);

                // Rating'i veritabanına ekle
                const { error: insertError } = await supabase
                    .from('seller_ratings')
                    .insert({
                        seller_id: sellerId,
                        listing_id: listingId,
                        buyer_id: user.id,
                        rating: rating,
                        comment: comment || null,
                        is_approved: false, // Admin tarafından onaylanmayı bekle
                        requires_transaction_approval: true, // 🆕 İşlem onayı gerekli
                        transaction_approval_id: approval.id // 🆕 İşlem onay referansı
                    });

                if (insertError) throw insertError;

                // 🆕 Transaction approval'da buyer_rated flag'ini güncelle
                await supabase
                    .from('transaction_approvals')
                    .update({ buyer_rated: true })
                    .eq('id', approval.id);

                Modal.close();
                logger.success('Yorum gönderildi! Admin tarafından onaylanınca yayınlanacaktır.');
                
                // Sayfayı yenile
                location.reload();
            } catch (error) {
                // ✅ Logger ile hata işleme
                logger.error('Review submission error', error);
            }
        });

    } catch (error) {
        // ✅ Logger ile hata işleme
        logger.error('Error opening rating form', error);
    }
}

// Mevcut kullanıcıyı al
async function getCurrentUser() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    } catch (error) {
        console.error('Kullanıcı bilgisi alırken hata:', error);
        return null;
    }
}
