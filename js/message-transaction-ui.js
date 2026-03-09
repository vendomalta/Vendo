/**
 * 🎯 Mesajlaşma Panelinde İşlem Onay Sistemi
 * Alıcı-Satıcı doğrulaması ve değerlendirme formu yönetimi
 */

import TransactionApprovalManager from './transaction-approval.js';
import logger from './logger.js';
import { sanitizeHTML, sanitizeText } from './xss-protection.js';

export class MessageTransactionUI {
    constructor(supabase) {
        this.supabase = supabase;
        this.approvalManager = new TransactionApprovalManager(supabase);
    }

    /**
     * Mesaj panelinde işlem onay butonlarını göster
     */
    /**
     * Mesaj panelinde işlem onay butonlarını göster
     */
    async renderTransactionButtons(listingId, buyerId, sellerId, currentUserId, containerElement) {
        try {
            // İşlem onayını getir veya oluştur
            const approval = await this.approvalManager.getOrCreateApproval(
                listingId, 
                buyerId, 
                sellerId
            );

            if (!approval) {
                return;
            }

            // Kullanıcı alıcı mı satıcı mı belirle
            // Loose equality check for safety involved with IDs
            const isCurrentUserBuyer = String(currentUserId) === String(buyerId);
            const isCurrentUserSeller = String(currentUserId) === String(sellerId);

            if (!isCurrentUserBuyer && !isCurrentUserSeller) {
                containerElement.innerHTML = ''; // Clear container if it had content
                return; 
            }

            // Şimdiden onaylanmış mı kontrol et (Explicit boolean cast)
            const isBuyerApproved = !!approval.buyer_approved;
            const isSellerApproved = !!approval.seller_approved;
            const isConvertedTransactionCompleted = !!approval.transaction_completed;
            
            const userApproved = isCurrentUserBuyer ? isBuyerApproved : isSellerApproved;

            // HTML oluştur
            let html = `<div class="transaction-approval-section" data-approval-id="${approval.id}">`;
            html += `<div class="approval-header">
                        <button class="collapse-btn" title="Aç/Kapat">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        <i class="fas fa-handshake"></i>
                        <span>İşlem Onayı</span>
                    </div>`;
            
            // Collapse içeriği
            html += `<div class="approval-content">`;

            // Onay durumları
            html += `<div class="approval-status">
                        <div class="status-item buyer-status">
                            <span class="user-label">Alıcı</span>
                            <span class="status-indicator ${isBuyerApproved ? 'approved' : 'pending'}">
                                <i class="fas ${isBuyerApproved ? 'fa-check-circle' : 'fa-hourglass-half'}"></i>
                                ${isBuyerApproved ? 'Onaylandı' : 'Bekleniyor'}
                            </span>
                        </div>
                        <div class="status-item seller-status">
                            <span class="user-label">Satıcı</span>
                            <span class="status-indicator ${isSellerApproved ? 'approved' : 'pending'}">
                                <i class="fas ${isSellerApproved ? 'fa-check-circle' : 'fa-hourglass-half'}"></i>
                                ${isSellerApproved ? 'Onaylandı' : 'Bekleniyor'}
                            </span>
                        </div>
                    </div>`;

            // Mevcut kullanıcı için butonlar
            // Logic: Show button if user Has NOT approved AND transaction is NOT completed
            if (!userApproved && !isConvertedTransactionCompleted) {
                const buttonText = isCurrentUserBuyer ? 'Ürünü Aldım' : 'Ürünü Sattım';
                const buttonClass = isCurrentUserBuyer ? 'buyer-approval-btn' : 'seller-approval-btn';
                
                html += `<div class="approval-actions" style="display: flex;">
                            <button class="btn-approve ${buttonClass}" data-approval-id="${approval.id}" title="Tıkla: İşlem tamamlandı">
                                <i class="fas fa-check"></i>
                                ${buttonText}
                            </button>
                        </div>`;
            }

            // İşlem tamamlandı mesajı
            if (isConvertedTransactionCompleted) {
                html += `<div class="transaction-complete-message">
                            <i class="fas fa-check-circle"></i>
                            <span>İşlem Tamamlandı! Artık değerlendirme yapabilirsiniz.</span>
                        </div>`;
                
                // Değerlendirme bölümü - hem alıcı hem satıcı yapabilir
                const userAlreadyRated = isCurrentUserBuyer ? !!approval.buyer_rated : !!approval.seller_rated;
                
                if (!userAlreadyRated) {
                    const ratingLabel = isCurrentUserBuyer ? 'Satıcıyı' : 'Alıcıyı';
                    const otherUserId = isCurrentUserBuyer ? sellerId : buyerId;
                    
                    html += `<div class="rating-section">
                                <div class="rating-header">
                                    <span>✨ ${ratingLabel} Değerlendir</span>
                                </div>
                                <div class="rating-container">
                                    <div class="stars-wrapper">
                                        <div class="stars" data-approval-id="${approval.id}" data-other-user-id="${otherUserId}">
                                            ${[1,2,3,4,5].map(star => `
                                                <button class="star" data-value="${star}" title="${star} Yıldız">
                                                    <i class="fas fa-star"></i>
                                                </button>
                                            `).join('')}
                                        </div>
                                        <span class="rating-value">0/5</span>
                                    </div>
                                    <textarea class="rating-comment" placeholder="Yorum yazınız... (opsiyonel)" maxlength="500" rows="3"></textarea>
                                    <button class="btn-submit-rating" data-approval-id="${approval.id}" data-is-buyer="${isCurrentUserBuyer}">
                                        <i class="fas fa-heart"></i> Değerlendirme Gönder
                                    </button>
                                </div>
                            </div>`;
                }
            }

            html += `</div>`;
            html += `</div>`;

            // DOM'a ekle
            containerElement.innerHTML = html;
            
            // Event listener'ları ekle
            this.attachButtonListeners(containerElement);

        } catch (error) {
            logger.error('İşlem onay UI oluşturma hatası', error);
        }
    }

    /**
     * Onay butonu event listener'larını ekle
     */
    attachButtonListeners(containerElement) {
        // Collapse butonunu ekle
        const collapseBtn = containerElement.querySelector('.collapse-btn');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const content = containerElement.querySelector('.approval-content');
                const icon = collapseBtn.querySelector('i');
                
                content.classList.toggle('collapsed');
                icon.classList.toggle('rotated');
            });
        }

        const buttons = containerElement.querySelectorAll('.btn-approve');
        
        buttons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                const approvalId = button.getAttribute('data-approval-id');
                
                try {
                    const { data: { user } } = await this.supabase.auth.getUser();
                    if (!user) {
                        logger.toast('Please sign in', 'warning');
                        return;
                    }

                    // Onayı güncelle
                    const isApprovedByBuyer = button.classList.contains('buyer-approval-btn') ? true : null;
                    const isApprovedBySeller = button.classList.contains('seller-approval-btn') ? true : null;

                    await this.approvalManager.updateApproval(
                        approvalId,
                        isApprovedByBuyer,
                        isApprovedBySeller
                    );

                    logger.toast('✅ Onay kaydedildi! Sayfa yenileniyor...', 'success');
                    
                    // Sayfayı yenile
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);

                } catch (error) {
                    logger.error('Onay kaydı hatası', error);
                    logger.toast('Onay kaydedilemedi', 'error');
                }
            });
        });

        // Yıldız rating listener'ları
        this.attachStarRatingListeners(containerElement);
        
        // Değerlendirme gönderme listener'ı
        this.attachRatingSubmitListeners(containerElement);
    }

    /**
     * Yıldız rating listener'larını ekle
     */
    attachStarRatingListeners(containerElement) {
        const stars = containerElement.querySelectorAll('.star');
        
        stars.forEach(star => {
            star.addEventListener('click', (e) => {
                e.preventDefault();
                const value = parseInt(star.getAttribute('data-value'));
                const starsContainer = star.closest('.stars');
                const ratingValue = starsContainer.parentElement.querySelector('.rating-value');
                
                // Tüm yıldızları temizle
                starsContainer.querySelectorAll('.star').forEach(s => {
                    s.classList.remove('active');
                });
                
                // Seçilen ve önceki yıldızları aktif yap
                starsContainer.querySelectorAll('.star').forEach((s, index) => {
                    if (index < value) {
                        s.classList.add('active');
                    }
                });
                
                // Değer göster
                ratingValue.textContent = `${value}/5`;
                starsContainer.setAttribute('data-rating', value);
            });
            
            // Hover efekti
            star.addEventListener('mouseenter', (e) => {
                const value = parseInt(star.getAttribute('data-value'));
                const starsContainer = star.closest('.stars');
                
                starsContainer.querySelectorAll('.star').forEach((s, index) => {
                    if (index < value) {
                        s.classList.add('hover');
                    } else {
                        s.classList.remove('hover');
                    }
                });
            });
        });
        
        // Hover'dan çıkma
        const starsContainers = containerElement.querySelectorAll('.stars');
        starsContainers.forEach(container => {
            container.addEventListener('mouseleave', () => {
                container.querySelectorAll('.star').forEach(s => {
                    s.classList.remove('hover');
                });
            });
        });
    }

    /**
     * Değerlendirme gönderme listener'ı
     */
    attachRatingSubmitListeners(containerElement) {
        const submitButtons = containerElement.querySelectorAll('.btn-submit-rating');
        
        submitButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                
                try {
                    const { data: { user } } = await this.supabase.auth.getUser();
                    if (!user) {
                        logger.toast('Please sign in', 'warning');
                        return;
                    }

                    const approvalId = button.getAttribute('data-approval-id');
                    const isBuyer = button.getAttribute('data-is-buyer') === 'true';
                    const ratingSection = button.closest('.rating-section');
                    const starsContainer = ratingSection.querySelector('.stars');
                    const comment = ratingSection.querySelector('.rating-comment').value;
                    const rating = parseInt(starsContainer.getAttribute('data-rating')) || 0;

                    if (rating === 0) {
                        logger.toast('⭐ Lütfen yıldız seçiniz', 'warning');
                        return;
                    }

                    button.disabled = true;
                    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gönderiliyor...';

                    // 🎯 İşlem bilgilerini getir
                    const { data: approval, error: approvalError } = await this.supabase
                        .from('transaction_approvals')
                        .select('listing_id, buyer_id, seller_id')
                        .eq('id', approvalId)
                        .single();

                    if (approvalError) throw approvalError;

                    // Değerlendirmeyi veritabanına kaydet (seller_ratings tablosuna)
                    const { error: reviewError } = await this.supabase
                        .from('seller_ratings')
                        .insert([{
                            seller_id: approval.seller_id,
                            buyer_id: user.id,
                            listing_id: approval.listing_id,
                            rating: rating,
                            comment: comment,
                            is_approved: true // İşlem üzerinden yapıldığı için otomatik onayla
                        }]);

                    // Eğer UNIQUE constraint hatası (23505) gelirse, zaten değerlendirme yapılmış demektir
                    if (reviewError && reviewError.code !== '23505') throw reviewError;

                    // İşlem onay tablosunda bayrağı güncelle
                    const { error: updateError } = await this.supabase
                        .from('transaction_approvals')
                        .update({
                            [isBuyer ? 'buyer_rated' : 'seller_rated']: true,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', approvalId);

                    if (updateError) throw updateError;

                    logger.toast('✅ Değerlendirme kaydedildi!', 'success');
                    
                    // Bölümü gizle
                    ratingSection.style.opacity = '0.5';
                    ratingSection.querySelector('.rating-header').innerHTML = '<span>✅ Değerlendirme Tamamlandı!</span>';
                    button.disabled = true;

                } catch (error) {
                    logger.error('Değerlendirme kaydı hatası', error);
                    logger.toast('Değerlendirme kaydedilemedi', 'error');
                    button.disabled = false;
                    button.innerHTML = '<i class="fas fa-heart"></i> Değerlendirme Gönder';
                }
            });
        });
    }

    /**
     * Değerlendirme formunu göster (işlem tamamlandıktan sonra)
     */
    async showRatingFormIfCompleted(listingId, sellerId, buyerId, currentUserId) {
        try {
            const { data: { user } } = await this.supabase.auth.getUser();
            if (!user) return;

            // Sadece alıcı değerlendirme yapabilir
            if (currentUserId !== buyerId) return;

            // İşlem tamamlandı mı kontrol et
            const canRateResult = await this.approvalManager.canUserRate(listingId, sellerId, currentUserId);

            if (canRateResult.canRate) {
                // Değerlendirme formunu göster
                return canRateResult;
            }

        } catch (error) {
            logger.error('Değerlendirme form kontrol hatası', error);
        }
    }

    /**
     * Satıcı bilgi bölümünde değerlendirme butonunu değiştir
     */
    async replaceRatingButtonWithForm(listingId, sellerId, buttonContainer) {
        try {
            const { data: { user } } = await this.supabase.auth.getUser();
            if (!user) return;

            // İşlem tamamlandı mı kontrol et
            const canRateResult = await this.approvalManager.canUserRate(listingId, sellerId, user.id);

            if (!canRateResult.canRate) {
                // Değerlendirme butonunu devre dışı bırak
                const ratingButton = buttonContainer.querySelector('[data-action="rate-seller"]');
                if (ratingButton) {
                    ratingButton.disabled = true;
                    ratingButton.title = canRateResult.reason;
                    ratingButton.style.opacity = '0.5';
                    ratingButton.style.cursor = 'not-allowed';
                }
            }

        } catch (error) {
            logger.error('Değerlendirme buton güncelleme hatası', error);
        }
    }
}

export default MessageTransactionUI;
