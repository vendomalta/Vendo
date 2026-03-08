/**
 * 💬 Mesajlaşma Sayfası - İşlem Onay Sistem Entegrasyonu
 * Bu örnek, messages.js'ye nasıl ekleneceğini gösterir
 */

// ==========================================
// ADIM 1: IMPORT EKLEME (messages.js başında)
// ==========================================

import MessageTransactionUI from './message-transaction-ui.js';
import TransactionApprovalManager from './transaction-approval.js';

// ==========================================
// ADIM 2: GLOBAL DEĞIŞKENLER (messages.js içinde)
// ==========================================

let messageTransactionUI = null;
let transactionApprovalManager = null;

// ==========================================
// ADIM 3: İNİTİALİZASYON (init fonksiyonunda)
// ==========================================

async function init() {
    // ... varolan init kodları ...
    
    // 🆕 İşlem Onay Sistemini Başlat
    try {
        messageTransactionUI = new MessageTransactionUI(supabase);
        transactionApprovalManager = new TransactionApprovalManager(supabase);
        console.log('✅ İşlem Onay Sistemi başlatıldı');
    } catch (error) {
        console.error('❌ İşlem Onay Sistemi başlatılamadı:', error);
    }
    
    // ... varolan init kodları ...
}

// ==========================================
// ADIM 4: KONUŞMA SEÇİLDİĞİNDE BUTON GÖSTER
// ==========================================

async function selectConversation(listingId, otherUserId) {
    try {
        // ... varolan selectConversation kodları ...

        // 🆕 İşlem onay butonlarını göster
        if (messageTransactionUI && currentUser) {
            const transactionContainer = document.getElementById('transaction-container');
            
            if (transactionContainer) {
                // Satıcı kimdir kontrol et
                const { data: listing, error } = await supabase
                    .from('listings')
                    .select('user_id')
                    .eq('id', listingId)
                    .single();

                if (!error && listing) {
                    const sellerId = listing.user_id;
                    const buyerId = currentUser.id;

                    // Alıcı mı satıcı mı belirle
                    const isCurrentUserBuyer = currentUser.id === buyerId;
                    const isCurrentUserSeller = currentUser.id === sellerId;

                    if (isCurrentUserBuyer || isCurrentUserSeller) {
                        await messageTransactionUI.renderTransactionButtons(
                            listingId,
                            buyerId,
                            sellerId,
                            currentUser.id,
                            transactionContainer
                        );
                    }
                }
            }
        }

    } catch (error) {
        console.error('Konuşma seçme hatası:', error);
    }
}

// ==========================================
// ADIM 5: HTML YAPISINDA (mesajlar.html)
// ==========================================

/*
<!DOCTYPE html>
<html>
<head>
    <!-- ... varolan head kodları ... -->
    
    <!-- 🆕 İşlem Onay CSS'i ekle -->
    <link rel="stylesheet" href="css/transaction-approval.css">
</head>
<body>
    <!-- ... varolan body kodları ... -->
    
    <!-- Mesajlar içerik alanı -->
    <div id="messagesContent">
        <!-- Mesajlar burada gösterilir -->
    </div>
    
    <!-- 🆕 İşlem Onay Konteynerı Ekle -->
    <div id="transaction-container" style="margin-top: 1rem;"></div>
    
    <!-- ... varolan script kodları ... -->
    <script type="module">
        import { supabase } from './js/supabase.js';
        import MessageTransactionUI from './js/message-transaction-ui.js';
        import TransactionApprovalManager from './js/transaction-approval.js';
        
        // Sayfa yüklendikten sonra mesajlar.js yüklenir
    </script>
</body>
</html>
*/

// ==========================================
// ADIM 6: MESAJ GÖNDERME SONRASI
// ==========================================

async function sendMessage() {
    const content = messageInput.value.trim();

    if (!content || !currentConversation || !currentUser) {
        console.error('Mesaj gönderilemedi: Kullanıcı/Konuşma bilgisi eksik.');
        return; 
    }

    try {
        // ... varolan sendMessage kodları ...

        // 🆕 Mesaj gönderdikten sonra transaction approval'ı kontrol et
        if (transactionApprovalManager && currentConversation.listingId) {
            try {
                // Satıcı ID'sini getir
                const { data: listing, error } = await supabase
                    .from('listings')
                    .select('user_id')
                    .eq('id', currentConversation.listingId)
                    .single();

                if (!error && listing) {
                    // İşlem onayı oluştur (yoksa getir)
                    const approval = await transactionApprovalManager.getOrCreateApproval(
                        currentConversation.listingId,
                        currentUser.id,
                        listing.user_id,
                        null // conversation_id (opsiyonel)
                    );
                    
                    console.log('✅ İşlem onayı hazır:', approval);
                }
            } catch (approvalError) {
                console.error('İşlem onayı oluşturma hatası:', approvalError);
            }
        }

    } catch (error) {
        console.error('❌ Mesaj gönderilirken hata:', error);
    }
}

// ==========================================
// ADIM 7: REALTIME SUBSCRIPTION'DA
// ==========================================

function subscribeToMessages(listingId, otherUserId) {
    // ... varolan subscription kodları ...

    messageSubscription = supabase
        .channel(`messages:${listingId}:${otherUserId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `listing_id=eq.${listingId}`
        }, (payload) => {
            // ... varolan payload işlemleri ...

            // 🆕 Yeni mesaj sonrası transaction approval'ı güncelle
            if (messageTransactionUI && transactionApprovalManager) {
                try {
                    // İşlem onayını yenile
                    const transactionContainer = document.getElementById('transaction-container');
                    if (transactionContainer) {
                        selectConversation(listingId, otherUserId);
                    }
                } catch (error) {
                    console.error('UI güncelleme hatası:', error);
                }
            }
        })
        .subscribe();
}

// ==========================================
// ADIM 8: TEST FONKSİYONLARI
// ==========================================

/**
 * Test: İşlem onaylarını göster
 */
async function testShowApprovals() {
    if (!transactionApprovalManager || !currentUser) {
        console.log('❌ Test başarısız: Manager veya kullanıcı eksik');
        return;
    }

    try {
        const approvals = await transactionApprovalManager.getPendingApprovals(currentUser.id);
        console.log('📋 Bekleyen İşlem Onayları:', approvals);
        
        approvals.forEach(approval => {
            console.log(`
                İşlem Onayı:
                - İlan: ${approval.listings?.title || 'Bilinmiyor'}
                - Alıcı: ${approval.buyer?.full_name || 'Bilinmiyor'}
                - Satıcı: ${approval.seller?.full_name || 'Bilinmiyor'}
                - Alıcı Onayı: ${approval.buyer_approved ? '✓' : '✗'}
                - Satıcı Onayı: ${approval.seller_approved ? '✓' : '✗'}
                - Tamamlandı: ${approval.transaction_completed ? '✓' : '✗'}
            `);
        });
    } catch (error) {
        console.error('❌ Test hatası:', error);
    }
}

/**
 * Test: Değerlendirme yapabilme kontrolü
 */
async function testCanRate(listingId, sellerId) {
    if (!transactionApprovalManager || !currentUser) {
        console.log('❌ Test başarısız: Manager veya kullanıcı eksik');
        return;
    }

    try {
        const result = await transactionApprovalManager.canUserRate(
            listingId,
            sellerId,
            currentUser.id
        );
        console.log('🎯 Değerlendirme Yapabilme Durumu:', result);
    } catch (error) {
        console.error('❌ Test hatası:', error);
    }
}

/**
 * Test: İşlem onayını güncelle
 */
async function testUpdateApproval(approvalId, approve = true) {
    if (!transactionApprovalManager || !currentUser) {
        console.log('❌ Test başarısız: Manager veya kullanıcı eksik');
        return;
    }

    try {
        const result = await transactionApprovalManager.updateApproval(
            approvalId,
            approve, // isApprovedByBuyer
            approve  // isApprovedBySeller
        );
        console.log('✅ Onay Güncellendi:', result);
    } catch (error) {
        console.error('❌ Test hatası:', error);
    }
}

// ==========================================
// ADIM 9: KONSOLDA TEST ETME
// ==========================================

/*
// Konsolda (F12 > Console) şunları çalıştırabilirsiniz:

// 1. Bekleyen onayları göster
testShowApprovals();

// 2. Değerlendirme yapabilme kontrolü
testCanRate('LISTING_ID', 'SELLER_ID');

// 3. İşlem onayını güncelle
testUpdateApproval('APPROVAL_ID', true);

// Çıktı örneği:
// ✅ İşlem Onay Sistemi başlatıldı
// 📋 Bekleyen İşlem Onayları: [Array]
// 🎯 Değerlendirme Yapabilme Durumu: {canRate: true, approvalId: "..."}
// ✅ Onay Güncellendi: {buyer_approved: true, seller_approved: false, ...}
*/

// ==========================================
// ADIM 10: ERROR HANDLING
// ==========================================

/**
 * Hata İşleme Şablonu
 */
try {
    // İşlem onay işlemleri
    const approval = await transactionApprovalManager.getOrCreateApproval(...);
} catch (error) {
    // 1. Konsola yaz
    console.error('Hata:', error);
    
    // 2. Kullanıcıya göster
    if (typeof logger !== 'undefined') {
        logger.toast('İşlem onay sistemi bir hata oluştu', 'error');
    }
    
    // 3. Graceful fallback
    // Hata olsa da sayfa çalışmaya devam etsin
    console.warn('İşlem onay sistemi devre dışı, normal mesajlaşma devam ediyor');
}

// ==========================================
// EXPORTS (Modüller için)
// ==========================================

export {
    messageTransactionUI,
    transactionApprovalManager,
    testShowApprovals,
    testCanRate,
    testUpdateApproval
};
