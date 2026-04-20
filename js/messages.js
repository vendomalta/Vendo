/**
 * 💬 MESSAGES.JS - Mesajlaşma Sistemi (Backend Entegrasyon)
 * Supabase Realtime ile mesajlaşma
 */

import { supabase } from './supabase.js';
import { sanitizeHTML, sanitizeText } from './xss-protection.js';
import MessageTransactionUI from './message-transaction-ui.js';
import TransactionApprovalManager from './transaction-approval.js';
import { messageLimiter } from './rate-limiter.js';

(function() {
    'use strict';
  
    // --- 1. DOM ELEMENTLERİNİ SEÇ ---
    const conversationsList = document.getElementById('conversationsList');
    const messagesContent = document.getElementById('messagesContent');
    const messageDetail = document.getElementById('messageDetail');
    const adReference = document.getElementById('adReference');
    const messageInput = document.querySelector('.message-input');
    const messageInputArea = document.querySelector('.message-input-area');
    const sendBtn = document.querySelector('.send-btn');
    const fileInput = document.getElementById('fileInput');
    const inputTools = document.querySelectorAll('.input-tool');
    const approvalToggleBtn = document.querySelector('.approval-toggle-btn');
    const conversationSearch = document.getElementById('conversationSearch'); // 🔎 Arama kutusu

    // Native Mobile Elements
    const nativeConversationsList = document.getElementById('nativeConversationsList');
    const nativeChatContent = document.getElementById('nativeChatContent');
    const nativeInboxScreen = document.getElementById('mobile-inbox-screen');
    const nativeChatScreen = document.getElementById('mobile-chat-screen');
    const nativeInboxBackBtn = document.getElementById('native-inbox-back');
    const nativeChatBackBtn = document.getElementById('native-chat-back');
    const nativeChatInput = document.getElementById('native-chat-input');
    const nativeChatSendBtn = document.getElementById('native-chat-send');
    const nativeHeaderImg = document.getElementById('native-header-listing-img');
    const nativeHeaderTitle = document.getElementById('native-header-title');
    const nativeHeaderSubtitle = document.getElementById('native-header-subtitle');

    // --- 2. STATE (DURUM) YÖNETİMİ ---
    let currentUser = null;
    let currentConversation = null;
    let conversations = [];
    let messages = [];
    let messageSubscription = null;
    let typingTimeout = null;
    let bulkDeleteMode = false;
    let selectedConversations = new Set();
    let searchTerm = ''; // 🔎 Arama terimi

    // --- 3. YARDIMCI FONKSİYONLAR ---
  
    // Mobil görünüm kontrolü
    function isMobileView() {
        return window.innerWidth <= 768;
    }

    // Mobilde chat alanına geç
    function showChatArea() {
        if (isMobileView()) {
            const container = document.querySelector('.messages-container');
            if (container) {
                container.classList.add('chat-active');
            }
            if (nativeInboxScreen && nativeChatScreen) {
                nativeInboxScreen.classList.remove('active');
                nativeChatScreen.classList.add('active');
            }
            const bottomNav = document.querySelector('.bottom-nav');
            if (bottomNav) bottomNav.style.display = 'none';
        }
    }

    // Show the message composer (only when a conversation is open)
    function showComposer() {
        if (messageInputArea) {
            messageInputArea.style.display = 'block';
            // ensure input is visible and focused
            if (messageInput) messageInput.focus();
        }
    }

    // Hide the message composer (used on conversation list view)
    function hideComposer() {
        if (messageInputArea) {
            messageInputArea.style.display = 'none';
            if (messageInput) {
                messageInput.value = '';
                messageInput.blur();
            }
        }
    }

    // Mobilde konuşma listesine dön
    function showConversationList() {
        if (isMobileView()) {
            const container = document.querySelector('.messages-container');
            if (container) {
                container.classList.remove('chat-active');
            }
            if (nativeInboxScreen && nativeChatScreen) {
                nativeChatScreen.classList.remove('active');
                nativeInboxScreen.classList.add('active');
            }
            const bottomNav = document.querySelector('.bottom-nav');
            if (bottomNav) bottomNav.style.display = 'flex';
            if (nativeChatInput) {
                nativeChatInput.value = '';
            }
        }
    }
  
    function formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }

    function formatDate(timestamp) {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        }
    }
  
    function scrollToBottom() {
        if (messagesContent) {
            messagesContent.scrollTop = messagesContent.scrollHeight;
        }
        if (nativeChatContent) {
            nativeChatContent.scrollTop = nativeChatContent.scrollHeight;
        }
    }

    /**
     * Özel onay dialogu göster (tarayıcı confirm yerine)
     */
    function showConfirmDialog(message, title = 'Confirm') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'confirm-modal';
            modal.innerHTML = `
                <div class="confirm-modal-overlay"></div>
                <div class="confirm-modal-content">
                    <div class="confirm-modal-header">
                        <h3>${sanitizeText(title)}</h3>
                    </div>
                    <div class="confirm-modal-body">
                        <p>${sanitizeText(message)}</p>
                    </div>
                    <div class="confirm-modal-footer">
                        <button class="btn-cancel">Cancel</button>
                        <button class="btn-confirm">Delete</button>
                    </div>
                </div>
            `;
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10001;
                display: flex; align-items: center; justify-content: center;
            `;
            
            const overlay = modal.querySelector('.confirm-modal-overlay');
            overlay.style.cssText = `
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
            `;
            
            const content = modal.querySelector('.confirm-modal-content');
            content.style.cssText = `
                position: relative; background: white; border-radius: 12px;
                max-width: 500px; width: 90%; padding: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                animation: modalSlideIn 0.3s ease-out;
            `;
            
            const header = modal.querySelector('.confirm-modal-header h3');
            header.style.cssText = 'margin: 0 0 16px 0; font-size: 1.25rem; color: #1f2937;';
            
            const body = modal.querySelector('.confirm-modal-body p');
            body.style.cssText = 'margin: 0; color: #6b7280; line-height: 1.6;';
            
            const footer = modal.querySelector('.confirm-modal-footer');
            footer.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;';
            
            const btnCancel = modal.querySelector('.btn-cancel');
            btnCancel.style.cssText = `
                padding: 10px 20px; border: 1px solid #d1d5db; background: white;
                color: #374151; border-radius: 6px; cursor: pointer; font-weight: 500;
                transition: all 0.2s;
            `;
            btnCancel.onmouseover = () => btnCancel.style.background = '#f3f4f6';
            btnCancel.onmouseout = () => btnCancel.style.background = 'white';
            
            const btnConfirm = modal.querySelector('.btn-confirm');
            btnConfirm.style.cssText = `
                padding: 10px 20px; border: none; background: #ef4444;
                color: white; border-radius: 6px; cursor: pointer; font-weight: 500;
                transition: all 0.2s;
            `;
            btnConfirm.onmouseover = () => btnConfirm.style.background = '#dc2626';
            btnConfirm.onmouseout = () => btnConfirm.style.background = '#ef4444';
            
            btnCancel.onclick = () => {
                modal.remove();
                resolve(false);
            };
            
            btnConfirm.onclick = () => {
                modal.remove();
                resolve(true);
            };
            
            overlay.onclick = () => {
                modal.remove();
                resolve(false);
            };
            
            document.body.appendChild(modal);
            
            // Animation keyframes
            if (!document.getElementById('modal-animations')) {
                const style = document.createElement('style');
                style.id = 'modal-animations';
                style.textContent = `
                    @keyframes modalSlideIn {
                        from { opacity: 0; transform: translateY(-20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `;
                document.head.appendChild(style);
            }
        });
    }

    function showLoading(element, message = 'Loading...') {
        element.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>${sanitizeText(message)}</p>
            </div>
        `;
    }

    function showError(element, message) {
        element.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>${sanitizeText(message)}</p>
                <button onclick="location.reload()" class="btn-primary">Retry</button>
            </div>
        `;
    }

    function showEmpty(element, message, icon = 'fa-comments') {
        element.innerHTML = `
            <div class="empty-state">
                <i class="fas ${sanitizeText(icon)}" style="font-size: 4rem; color: #d1d5db; margin-bottom: 1rem;"></i>
                <p>${sanitizeText(message)}</p>
            </div>
        `;
    }
  
    // --- 4. BACKEND FONKSİYONLARI ---

    /**
     * Kullanıcının tüm konuşmalarını getir (Değişiklik Yok)
     */
    async function loadConversations() {
        try {
            showLoading(conversationsList, 'Loading conversations...');

            // Kullanıcının mesajlarını getir (hem gönderen hem alıcı olarak)
            const { data: userMessages, error } = await supabase
                .from('messages')
                .select('*')
                .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ Mesajlar getirme hatası:', error);
                throw error;
            }

            console.log('📬 Toplam indirilen mesaj sayısı (ham):', userMessages?.length || 0);

            if (!userMessages || userMessages.length === 0) {
                showEmpty(conversationsList, "You don't have any messages yet", 'fa-inbox');
                return;
            }

            // 🟢 Soft Delete Filtreleme (LocalStorage + DB):
            // - LocalStorage'da 'deleted_LISTINGID_USERID' varsa GİZLE
            // - DB'de deleted_by_sender/receiver varsa GİZLE (sütun varsa çalışır)
            const visibleMessages = userMessages.filter(msg => {
                const isReceived = msg.receiver_id === currentUser.id;
                const otherUid = isReceived ? msg.sender_id : msg.receiver_id;
                const localKey = `deleted_${msg.listing_id}_${otherUid}`;

                // 1. LocalStorage kontrolü
                if (localStorage.getItem(localKey) === 'true') return false;

                // 2. DB kontrolü (sütun varsa)
                if (msg.sender_id === currentUser.id && msg.deleted_by_sender) return false;
                if (msg.receiver_id === currentUser.id && msg.deleted_by_receiver) return false;
                
                return true;
            });

            console.log('📬 Görüntülenebilir mesaj sayısı:', visibleMessages.length);

            if (visibleMessages.length === 0) {
                showEmpty(conversationsList, "You don't have any messages yet", 'fa-inbox');
                return;
            }

            // Konuşmaları grupla (listing_id ve karşı taraf kullanıcıya göre)
            const conversationMap = new Map();
            const userIds = new Set();
            const listingIds = new Set();

            visibleMessages.forEach(msg => {
                const isReceived = msg.receiver_id === currentUser.id;
                const otherUserId = isReceived ? msg.sender_id : msg.receiver_id;
                const key = `${msg.listing_id}_${otherUserId}`;

                userIds.add(otherUserId);
                if (msg.listing_id) listingIds.add(msg.listing_id);

                if (!conversationMap.has(key)) {
                    conversationMap.set(key, {
                        listing_id: msg.listing_id,
                        other_user_id: otherUserId,
                        last_message: msg.content,
                        last_message_time: msg.created_at,
                        unread_count: 0
                    });
                }

                // Okunmamış mesaj sayısı
                if (isReceived && !msg.is_read) {
                    conversationMap.get(key).unread_count++;
                }
            });

            // Profilleri toplu olarak getir
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', Array.from(userIds));

            const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

            // İlanları toplu olarak getir
            const { data: listings } = await supabase
                .from('listings')
                .select('id, title, price, currency, photos, user_id')
                .in('id', Array.from(listingIds));

            const listingMap = new Map(listings?.map(l => [l.id, l]) || []);

            // Blokladığımız kullanıcıları toplu olarak getir
            const { data: blockRecords } = await supabase
                .from('blocked_users')
                .select('blocked_id')
                .eq('blocker_id', currentUser.id);
            const blockedSet = new Set(blockRecords?.map(b => b.blocked_id) || []);

            // Konuşmaları oluştur
            conversations = Array.from(conversationMap.values()).map(conv => ({
                ...conv,
                other_user: profileMap.get(conv.other_user_id) || { id: conv.other_user_id, full_name: 'User', avatar_url: null },
                listing: listingMap.get(conv.listing_id) || null,
                isBlocked: blockedSet.has(conv.other_user_id)
            }));

            // Tür sınıflandırması: eğer ilanın `user_id` alanı bizim kullanıcımıza aitse "selling",
            // değilse ve biz o ilan için mesaj göndermişsek "buying" olarak işaretle.
            conversations = conversations.map(conv => {
                const listing = conv.listing;
                let type = 'other';
                if (listing && typeof listing.user_id !== 'undefined' && listing.user_id !== null) {
                    if (listing.user_id === currentUser.id) {
                        type = 'selling';
                    } else {
                        const iSent = userMessages.some(m => m.listing_id === conv.listing_id && m.sender_id === currentUser.id);
                        type = iSent ? 'buying' : 'selling';
                    }
                }
                return { ...conv, type };
            });

            console.log('💬 Toplam konuşma sayısı:', conversations.length);

            renderConversations();

        } catch (error) {
            console.error('Konuşmalar yüklenirken hata:', error);
            showError(conversationsList, 'Could not load conversations');
        }
    }

    /**
     * 🟢 GELİŞTİRİLMİŞ: Konuşmaları listele
     * Typing indicators, unread badges ve ARAMA FİLTRESİ ile
     */
    function renderConversations() {
        // 🔎 Arama Filtreleme
        let filteredConversations = conversations;
        if (searchTerm.trim() !== '') {
            const lowerTerm = searchTerm.toLocaleLowerCase("tr");
            filteredConversations = conversations.filter(conv => {
                const title = (conv.listing ? conv.listing.title : '').toLocaleLowerCase("tr");
                const userName = (conv.other_user.full_name || '').toLocaleLowerCase("tr");
                const lastMsg = (conv.last_message || '').toLocaleLowerCase("tr");
                return title.includes(lowerTerm) || userName.includes(lowerTerm) || lastMsg.includes(lowerTerm);
            });
        }

        if (filteredConversations.length === 0) {
            conversationsList.innerHTML = `
                <div class="empty-state" style="padding: 20px; text-align: center; color: #6b7280;">
                    <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5;"></i>
                    <p>No results found.</p>
                </div>
            `;
            if (nativeConversationsList) {
                nativeConversationsList.innerHTML = `<div style="padding: 30px; text-align: center; color: #64748b;">No results found.</div>`;
            }
            return;
        }

        let desktopHtml = '';
        let nativeHtml = '';

        filteredConversations.forEach((conv, index) => {
            // İlk ilan fotoğrafını avatar olarak kullan; yoksa logo kullan
            const avatarUrl = (conv.listing && Array.isArray(conv.listing.photos) && conv.listing.photos.length > 0)
                ? conv.listing.photos[0]
                : 'assets/images/verde-logo.svg';

            const conversationKey = `${conv.listing_id}_${conv.other_user.id}`;
            const isSelected = selectedConversations.has(conversationKey);
            const isArchived = (typeof localStorage !== 'undefined') && localStorage.getItem(`conv_archived_${conversationKey}`) === 'true';

            const title = sanitizeText(conv.listing ? conv.listing.title : 'Listing');
            const userName = sanitizeText(conv.other_user.full_name || 'User');
            
            desktopHtml += `
                <div class="conversation-item ${!currentConversation && index === 0 && !bulkDeleteMode && searchTerm === '' ? 'active' : ''} ${conv.unread_count > 0 ? 'unread' : ''} ${isSelected ? 'selected' : ''} ${conv.type || ''} ${isArchived ? 'archived' : ''}" 
                     data-listing-id="${conv.listing_id}" 
                     data-user-id="${conv.other_user.id}"
                     data-conversation-key="${conversationKey}"
                     data-type="${conv.type || 'other'}"
                     data-archived="${isArchived ? 'true' : 'false'}"
                     data-blocked="${conv.isBlocked ? 'true' : 'false'}">
                    ${bulkDeleteMode ? `
                        <div class="conversation-checkbox">
                            <input type="checkbox" 
                                   class="conversation-select" 
                                   data-conversation-key="${conversationKey}"
                                   ${isSelected ? 'checked' : ''}>
                        </div>
                    ` : ''}
                    <div class="conversation-avatar">
                        <img src="${avatarUrl}" alt="${userName}">
                    </div>
                    <div class="conversation-content">
                        <div class="conversation-header">
                            <h4>${title}</h4>
                            <span class="conversation-time">${formatDate(conv.last_message_time)}</span>
                        </div>
                        <p class="conversation-listing-title">${userName}</p>
                        <p class="last-message ${conv.unread_count > 0 ? 'unread-text' : ''}">${sanitizeText(conv.last_message.substring(0, 50) + (conv.last_message.length > 50 ? '...' : ''))}</p>
                    </div>
                    ${conv.unread_count > 0 ? `<span class="unread-badge">${conv.unread_count > 99 ? '99+' : conv.unread_count}</span>` : ''}
                    
                    <!-- Swipe Actions -->
                    <div class="conversation-swipe-actions">
                        <button class="swipe-action-btn" onclick="window.MessagesApp?.deleteConversation('${conv.listing_id}', '${conv.other_user.id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;

            nativeHtml += `
                <div class="native-conv-item" data-listing-id="${conv.listing_id}" data-user-id="${conv.other_user.id}" data-blocked="${conv.isBlocked ? 'true' : 'false'}">
                    <div class="native-avatar-container">
                        <img src="${avatarUrl}" alt="${userName}" class="native-avatar">
                    </div>
                    <div class="native-conv-content">
                        <div class="native-conv-header">
                            <h4 class="native-listing-title">${title}</h4>
                            <span class="native-conv-time">${formatTime(conv.last_message_time)}</span>
                        </div>
                        <p class="native-user-name">${userName}</p>
                        <p class="native-last-msg ${conv.unread_count > 0 ? 'unread' : ''}">
                            ${sanitizeText(conv.last_message.substring(0, 40) + (conv.last_message.length > 40 ? '...' : ''))}
                        </p>
                    </div>
                    ${conv.unread_count > 0 ? `<span class="native-unread-badge">${conv.unread_count > 99 ? '99+' : conv.unread_count}</span>` : ''}
                </div>
            `;
        });

        conversationsList.innerHTML = desktopHtml;
        if (nativeConversationsList) {
            nativeConversationsList.innerHTML = nativeHtml;
        }

        // İlk konuşmayı otomatik seç (Mobilde listeyi göster, Desktop'ta ilk mesajı seç)
        if (conversations.length > 0 && !currentConversation && !bulkDeleteMode && searchTerm === '' && !isMobileView()) {
            selectConversation(conversations[0].listing_id, conversations[0].other_user.id);
        } else if (currentConversation && bulkDeleteMode === false) {
             // Arama yaparken veya normal durumda aktif konuşmayı highlight et
             const activeItem = conversationsList.querySelector(`.conversation-item[data-listing-id="${currentConversation.listingId}"][data-user-id="${currentConversation.otherUserId}"]`);
             if (activeItem) activeItem.classList.add('active');
        }
        
        // Swipe dinleyicilerini ekle (timeout ile DOM hazır olmasını bekle)
        setTimeout(() => initSwipeListeners(), 100);
        
        // Checkbox event listeners ekle
        if (bulkDeleteMode) {
            attachCheckboxListeners();
        }
    }



    /**
     * 🟢 GELİŞTİRİLMİŞ: Bir konuşmayı seç ve mesajları yükle
     * Other user name ve timestamp bilgisini sakla
     */
    async function selectConversation(listingId, otherUserId) {
        try {
            const conversation = conversations.find(c => 
                c.listing_id == listingId && c.other_user.id == otherUserId
            );

            if (!conversation) return;

            // 🟢 Other user name'i sakla (notifications için)
            currentConversation = { 
                listingId, 
                otherUserId,
                otherUserName: conversation.other_user.full_name
            };

            // Aktif konuşmayı işaretle
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.listingId == listingId && item.dataset.userId == otherUserId) {
                    item.classList.add('active');
                    // Active item'ın unread badge'ini temizle
                    item.classList.remove('unread');
                }
            });

            // İlan bilgisini göster
            if (conversation && conversation.listing) {
                const listing = conversation.listing;
                const mainImage = listing.photos && listing.photos.length > 0 ? listing.photos[0] : 'https://via.placeholder.com/150';
                
                // Native header update
                if (nativeHeaderImg) nativeHeaderImg.src = mainImage;
                if (nativeHeaderTitle) nativeHeaderTitle.textContent = listing.title;
                if (nativeHeaderSubtitle) nativeHeaderSubtitle.textContent = conversation.other_user.full_name;

                adReference.style.display = 'flex';
                adReference.innerHTML = `
                    <button class="back-to-list-btn" onclick="window.MessagesApp?.backToList()" title="Back">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                    <img src="${mainImage}" alt="${listing.title}">
                    <div class="ad-info">
                        <h5>${listing.title}</h5>
                        <p class="ad-price">${listing.currency || '€'}${listing.price.toLocaleString()}</p>
                    </div>
                    <div class="ad-actions">
                        ${listing.user_id === currentUser.id ? `
                            <button class="btn-seller-action sell-btn" id="markAsSoldBtn" title="Mark as Sold">
                                <i class="fas fa-check-circle"></i>
                                <span>Sold</span>
                            </button>
                        ` : ''}
                        <button class="view-ad-btn" onclick="window.location.href='ilan-detay.html?id=${listing.id}'">View Listing</button>
                        <div class="action-menu-wrapper">
                            <button class="three-dots-btn" title="Other actions"> 
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div class="ad-action-menu" style="display:none;">
                                <button class="ad-action archive-action">Archive Chat</button>
                                <button class="ad-action delete-action">Delete Chat</button>
                                <button class="ad-action report-action">Report</button>
                                <button class="ad-action block-action">Block</button>
                            </div>
                        </div>
                    </div>
                `;

                // Logic for Mark as Sold
                if (listing.user_id === currentUser.id) {
                    const soldBtn = adReference.querySelector('#markAsSoldBtn');
                    if (soldBtn) {
                        soldBtn.addEventListener('click', async () => {
                            const confirmed = confirm('Are you sure you want to mark this item as sold?');
                            if (confirmed) {
                                try {
                                    const { error } = await supabase
                                        .from('listings')
                                        .update({ status: 'sold' })
                                        .eq('id', listing.id);
                                    if (error) throw error;
                                    alert('Item marked as sold!');
                                    soldBtn.disabled = true;
                                    soldBtn.classList.add('disabled');
                                } catch (err) {
                                    alert('Error: ' + err.message);
                                }
                            }
                        });
                    }
                }

                // initialize actions after inserting markup
                const conversationKey = `${listing.id}_${conversation.other_user.id}`;
                initConversationActions(listing.id, conversation.other_user.id, conversationKey);
            }

            // Mobilde chat alanını göster
            showChatArea();

            // 🟢 YENİ: Subscribe BEFORE loading to ensure no messages are missed in the selection gap
            subscribeToMessages(listingId, otherUserId);

            // Mesajları yükle
            await loadMessages(listingId, otherUserId);

            // Mesaj input alanına odaklan
            if (messageInput) {
                messageInput.focus();
            }

            // Göster composer (sadece açık konuşmada)
            showComposer();

            // 🆕 İşlem Onay Bölümü bilgilerini hazırla (Render'ı toggle ile yapacağız)
            try {
                const { data: listings, error: listingError } = await supabase
                    .from('listings')
                    .select('user_id')
                    .eq('id', listingId);

                if (!listingError && listings && listings.length > 0) {
                    const listing = listings[0];
                    const sellerId = listing.user_id;
                    // Satıcı listingi sahibi, alıcı ise o kişi değil
                    const buyerId = currentUser.id === sellerId ? otherUserId : currentUser.id;
                    const transactionContainer = document.getElementById('transaction-container');
                    if (transactionContainer) {
                        // Varsayılan olarak gizli kalsın; verileri sakla
                        transactionContainer.classList.remove('open');
                        transactionContainer.style.display = 'none';
                        transactionContainer.dataset.listingId = listingId;
                        transactionContainer.dataset.buyerId = buyerId;
                        transactionContainer.dataset.sellerId = sellerId;
                        transactionContainer.dataset.currentUserId = currentUser.id;
                        transactionContainer.dataset.rendered = 'false';
                    }
                }
            } catch (approvalError) {
                console.error('İşlem onay bölümü yükleme hatası:', approvalError);
            }

        } catch (error) {
            console.error('Konuşma seçilirken hata:', error);
        }
    }

    /**
     * 🟢 GELİŞTİRİLMİŞ: Mesajları getir
     * Otomatik yükle ve chatte göster
     */
    // BATCHED MESSAGES: yükleme mantığı (10'erli) + sonsuz kaydırma
    const MESSAGE_BATCH_SIZE = 10;
    let messagesTotalCount = 0;
    let earliestMessageIndex = 0; // index (0-based) of the first loaded message in the full ordered set
    let isLoadingMoreMessages = false;

    /**
     * 🟢 YENİ: Blok Durumunu Kontrol Et
     */
    async function checkBlockedStatus(otherUserId) {
        try {
            // 1. Ben onu engelledim mi?
            const { data: iBlocked, error: err1 } = await supabase
                .from('blocked_users')
                .select('*')
                .eq('blocker_id', currentUser.id)
                .eq('blocked_id', otherUserId)
                .maybeSingle();

            if (iBlocked) return { isBlocked: true, type: 'me', record: iBlocked };

            // 2. O beni engelledi mi?
            const { data: theyBlocked, error: err2 } = await supabase
                .from('blocked_users')
                .select('*')
                .eq('blocker_id', otherUserId)
                .eq('blocked_id', currentUser.id)
                .maybeSingle();

            if (theyBlocked) return { isBlocked: true, type: 'other', record: theyBlocked };

            // 3. LocalStorage Fallback (Demo Modu)
            const myBlockKey = `blocked_${currentUser.id}_${otherUserId}`;
            if (localStorage.getItem(myBlockKey) === 'true') return { isBlocked: true, type: 'me', record: { id: 'local' } };

            return { isBlocked: false };

        } catch (error) {
            console.error('Blok durumu kontrol hatası:', error);
            return { isBlocked: false };
        }
    }

    async function loadMessages(listingId, otherUserId) {
        try {
            showLoading(messagesContent, 'Loading messages...');

            // 1) Toplam mesaj sayısını al
            const countResp = await supabase
                .from('messages')
                .select('id', { count: 'exact' })
                .eq('listing_id', listingId)
                .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUser.id})`);

            messagesTotalCount = countResp.count || 0;

            if (!messagesTotalCount) {
                messages = [];
                showEmpty(messagesContent, 'No messages yet. Send the first message!', 'fa-comment-dots');
                return;
            }

            // 2) İlk batch: son (en yeni) MESSAGE_BATCH_SIZE mesajı al
            const start = Math.max(0, messagesTotalCount - MESSAGE_BATCH_SIZE);
            const end = messagesTotalCount - 1;

            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('listing_id', listingId)
                .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUser.id})`)
                .order('created_at', { ascending: true })
                .range(start, end);

            if (error) throw error;

            messages = data || [];
            earliestMessageIndex = start;

            // render and position to bottom
            renderMessages();
            scrollToBottom();

            // mark as read for the conversation
            markAsRead(listingId, otherUserId);

            // 🟢 YENİ: Blok Durumunu Kontrol Et
            try {
                const blockStatus = await checkBlockedStatus(otherUserId);
                const inputArea = document.querySelector('.message-input-area');
                
                // Varsa eski uyarıyı temizle
                const oldWarning = document.getElementById('blocked-user-warning');
                if (oldWarning) oldWarning.remove();

                if (blockStatus.isBlocked) {
                    if (inputArea) inputArea.style.display = 'none';

                    // Uyarı Mesajı Oluştur
                    const warningDiv = document.createElement('div');
                    warningDiv.id = 'blocked-user-warning';
                    warningDiv.style.cssText = `
                        padding: 15px;
                        background: #fef2f2;
                        border-top: 1px solid #fee2e2;
                        text-align: center;
                        color: #b91c1c;
                        display: flex; 
                        flex-direction: column;
                        align-items: center;
                        gap: 10px;
                    `;

                    if (blockStatus.type === 'me') {
                        warningDiv.innerHTML = `
                            <div>
                                <i class="fas fa-ban"></i> 
                                <strong>You blocked this user.</strong>
                            </div>
                            <button id="unblockUserBtn" style="
                                background: white; 
                                border: 1px solid #ef4444; 
                                color: #ef4444; 
                                padding: 6px 16px; 
                                border-radius: 20px; 
                                cursor: pointer; 
                                font-weight: 500;
                                transition: all 0.2s;
                            ">Unblock</button>
                        `;
                    } else {
                        warningDiv.innerHTML = `
                            <div>
                                <i class="fas fa-ban"></i> 
                                <strong>You have been blocked by this user. You cannot send messages.</strong>
                            </div>
                        `;
                    }

                    // Mesaj alanının altına ekle
                    const messagesContainer = document.querySelector('.message-detail');
                    if (messagesContainer) {
                        messagesContainer.appendChild(warningDiv);
                        
                        // Unblock butonu dinleyicisi
                        const unblockBtn = document.getElementById('unblockUserBtn');
                        if (unblockBtn) {
                            unblockBtn.addEventListener('click', async () => {
                                // Custom Confirm Dialog for Unblock Action
                                const confirmUnblock = await new Promise(resolve => {
                                    const overlay = document.createElement('div');
                                    overlay.style.cssText = `
                                        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                                        background: rgba(0,0,0,0.5); z-index: 99999;
                                        display: flex; align-items: center; justify-content: center;
                                    `;
                                    overlay.innerHTML = `
                                    <div style="background: white; padding: 25px; border-radius: 12px; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
                                            <div style="margin-bottom: 15px;">
                                                <i class="fas fa-unlock" style="font-size: 3rem; color: #10b981;"></i>
                                            </div>
                                            <h3 style="margin: 0 0 10px 0; color: #1f2937; font-size: 1.25rem; font-weight: 600;">Unblock</h3>
                                            <p style="color: #4b5563; margin-bottom: 20px; line-height: 1.5;">
                                                Do you want to unblock the user? The user will be able to message you again.
                                            </p>
                                            <div style="display: flex; gap: 10px; justify-content: center;">
                                                <button id="cancelUnblockBtn" style="padding: 10px 20px; border: 1px solid #d1d5db; background: white; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 0.95rem; color: #374151;">Cancel</button>
                                                <button id="confirmUnblockBtn" style="padding: 10px 20px; border: none; background: #10b981; color: white; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.95rem;">Unblock</button>
                                            </div>
                                        </div>
                                    `;
                                    document.body.appendChild(overlay);

                                    // Button hover effects
                                    const cancelBtn = overlay.querySelector('#cancelUnblockBtn');
                                    const confirmBtn = overlay.querySelector('#confirmUnblockBtn');
                                    
                                    cancelBtn.onmouseover = () => { cancelBtn.style.background = '#f3f4f6'; };
                                    cancelBtn.onmouseout = () => { cancelBtn.style.background = 'white'; };
                                    confirmBtn.onmouseover = () => { confirmBtn.style.background = '#059669'; };
                                    confirmBtn.onmouseout = () => { confirmBtn.style.background = '#10b981'; };

                                    cancelBtn.onclick = () => { overlay.remove(); resolve(false); };
                                    confirmBtn.onclick = () => { overlay.remove(); resolve(true); };
                                    overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
                                });

                                if (confirmUnblock) {
                                    // Remove from DB
                                    if (blockStatus.record && blockStatus.record.id !== 'local') {
                                        await supabase.from('blocked_users').delete().eq('id', blockStatus.record.id);
                                    }
                                    // Remove from LocalStorage
                                    localStorage.removeItem(`blocked_${currentUser.id}_${otherUserId}`);
                                    
                                    showNotification('Unblocked.', 'success');
                                    // Refresh UI
                                    setTimeout(() => location.reload(), 1000);
                                }
                            });
                        }
                    }

                } else {
                    // Blok yoksa input alanını göster
                    if (inputArea) inputArea.style.display = 'block';
                }
            } catch (blockCheckErr) {
                console.warn('Block check failed:', blockCheckErr);
            }

            // attach scroll listener to load older messages when user scrolls to top
            if (messagesContent && !messagesContent._infiniteScrollAttached) {
                messagesContent._infiniteScrollAttached = true;
                messagesContent.addEventListener('scroll', async () => {
                    // if near top and there are older messages, load previous batch
                    if (messagesContent.scrollTop <= 120 && earliestMessageIndex > 0 && !isLoadingMoreMessages) {
                        await loadPreviousBatch(listingId, otherUserId);
                    }
                });
            }

        } catch (error) {
            console.error('Mesajlar yüklenirken hata:', error);
            showError(messagesContent, 'Could not load messages');
        }
    }

    async function loadPreviousBatch(listingId, otherUserId) {
        if (isLoadingMoreMessages) return;
        if (earliestMessageIndex <= 0) return;

        isLoadingMoreMessages = true;
        try {
            const newStart = Math.max(0, earliestMessageIndex - MESSAGE_BATCH_SIZE);
            const newEnd = earliestMessageIndex - 1;

            // remember current scrollHeight to restore position after prepend
            const previousScrollHeight = messagesContent.scrollHeight;

            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('listing_id', listingId)
                .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUser.id})`)
                .order('created_at', { ascending: true })
                .range(newStart, newEnd);

            if (error) throw error;

            if (data && data.length) {
                // prepend older messages
                messages = data.concat(messages);
                earliestMessageIndex = newStart;

                // re-render and keep scroll position stable
                renderMessages();

                // after rendering, calculate new scrollTop so user stays at same message
                const newScrollHeight = messagesContent.scrollHeight;
                messagesContent.scrollTop = newScrollHeight - previousScrollHeight + messagesContent.scrollTop;
            }

        } catch (err) {
            console.error('Önceki mesajlar yüklenirken hata:', err);
        } finally {
            isLoadingMoreMessages = false;
        }
    }

    /**
     * Mesajları görüntüle (Değişiklik Yok)
     */
    function renderMessages() {
        if (messages.length === 0) {
            showEmpty(messagesContent, 'Henüz mesaj yok. İlk mesajı siz gönderin!', 'fa-comment-dots');
            if (nativeChatContent) nativeChatContent.innerHTML = `<div style="padding: 30px; text-align: center; color: #64748b;">No messages yet.</div>`;
            return;
        }

        // 🟢 YENİ: Her zaman kronolojik olarak sırala (Eşzamanlı mesajlarda düzeni korur)
        messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        let desktopHtml = '';
        let nativeHtml = '';

        messages.forEach(msg => {
            const isSent = msg.sender_id === currentUser.id;
            let tickMarkup = '';
            let nativeTickMarkup = '';
            
            if (isSent) {
                if (msg.is_blocked_delivery) {
                     tickMarkup = '<span class="read-receipt sent" title="Delivered"><i class="fas fa-check"></i></span>';
                     nativeTickMarkup = '<i class="fas fa-check native-status-icon"></i>';
                } else if (msg.is_read) {
                    tickMarkup = '<span class="read-receipt read" title="Read"><i class="fas fa-check"></i><i class="fas fa-check"></i></span>';
                    nativeTickMarkup = '<i class="fas fa-check-double native-status-icon read"></i>';
                } else {
                    tickMarkup = '<span class="read-receipt sent" title="Sent"><i class="fas fa-check"></i><i class="fas fa-check"></i></span>';
                    nativeTickMarkup = '<i class="fas fa-check-double native-status-icon"></i>';
                }
            }

            desktopHtml += `
                <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${msg.id}">
                    <div class="message-bubble">
                        <p>${sanitizeHTML(msg.content)}</p>
                        <span class="message-time">${formatTime(msg.created_at)}</span>
                        ${tickMarkup}
                    </div>
                </div>
            `;

            nativeHtml += `
                <div class="native-bubble-group">
                    <div class="native-bubble ${isSent ? 'sent' : 'received'}">
                        ${sanitizeHTML(msg.content)}
                        <div class="native-bubble-meta">
                            <span>${formatTime(msg.created_at)}</span>
                            ${nativeTickMarkup}
                        </div>
                    </div>
                </div>
            `;
        });

        // Yazıyor göstergesi için placeholder ekle
        const typingHtml = `<div id="typing-indicator-wrapper" style="display: none;">
                    <div class="typing-indicator">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <span style="margin-left: 8px;">typing...</span>
                    </div>
                 </div>`;

        messagesContent.innerHTML = desktopHtml + typingHtml;
        if (nativeChatContent) {
            nativeChatContent.innerHTML = nativeHtml + typingHtml;
        }
        
        scrollToBottom();
    }

    /**
     * 🟢 GELİŞTİRİLMİŞ: Mesaj gönder
     * Gönderilen mesaj otomatik chatte görünsün
     */
    async function sendMessage(source = 'desktop') {
        // 🟢 YENİ: Rate Limit Kontrolü
        if (messageLimiter.isLimited('user_' + currentUser?.id)) {
            const minutesRemaining = messageLimiter.getLockTimeRemaining('user_' + currentUser?.id);
             if (typeof showNotification === 'function') {
                showNotification(`Too many messages. Please wait ${minutesRemaining} minutes.`, 'warning');
            }
            return;
        }

        const inputField = source === 'native' ? nativeChatInput : messageInput;
        const currentSendBtn = source === 'native' ? nativeChatSendBtn : sendBtn;
        
        let content = '';
        if (inputField) content = inputField.value.trim();
        else content = messageInput.value.trim() || (nativeChatInput ? nativeChatInput.value.trim() : '');

        // Kontrol: Mesaj, konuşma ve kullanıcı bilgisi var mı?
        if (!content || !currentConversation || !currentUser) {
            console.error('Mesaj gönderilemedi: Kullanıcı/Konuşma bilgisi eksik.');
            if (typeof showNotification === 'function') {
                 showNotification('Log in or select a valid conversation to send a message.', 'warning');
            }
            return; 
        }

        // 🟢 YENİ: Karakter Sınırı Kontrolü (1000 karakter)
        if (content.length > 1000) {
            if (typeof showNotification === 'function') {
                showNotification(`Message is too long. Maximum 1000 characters allowed (Current: ${content.length}).`, 'warning');
            }
            return;
        }

        // Dosya veya metin yoksa gönderme
        // TODO: Dosya eklendiğinde bu kontrol güncellenecek
        if (!content) return;

        // 🟢 YENİ: Blok Kontrolü
        if (currentConversation) {
            const blockStatus = await checkBlockedStatus(currentConversation.otherUserId);
            if (blockStatus.isBlocked) {
                if (blockStatus.type === 'me') {
                    showNotification('You blocked this user. You cannot send messages.', 'error');
                } else {
                    // "Tek tık" simülasyonu: Mesajı sadece yerel olarak ekle ama sunucuya gönderme
                    // Kullanıcı engellendiğini anlamasın diye "gönderildi" gibi davranabiliriz 
                    // YADA direkt hata verebiliriz. İstenen: "mesaj tek tık olarak kalsın iletilmesin"
                    
                    // 1. Mesajı yerel diziye ekle (Fake Message)
                    const fakeMsg = {
                        id: 'temp_' + Date.now(),
                        listing_id: currentConversation.listingId,
                        sender_id: currentUser.id,
                        receiver_id: currentConversation.otherUserId,
                        content: content,
                        created_at: new Date().toISOString(),
                        is_read: false,
                        is_blocked_delivery: true // Özel bayrak
                    };
                    
                    messages.push(fakeMsg);
                    renderMessages();
                    scrollToBottom();
                    
                    // Input temizle
                    messageInput.value = '';
                    
                    // Bildirim gösterme veya sessizce geç
                    console.log('User is blocked, message simulated but not sent to DB.');
                }
                return;
            }
        }

        let originalIcon = '';
        try {
            // 🟢 YENİ: Send butonunu disable et (double-click'i önle)
            if (currentSendBtn) {
                currentSendBtn.disabled = true;
                originalIcon = currentSendBtn.innerHTML;
                currentSendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            }

            const { data, error } = await supabase
                .from('messages')
                .insert({
                    listing_id: currentConversation.listingId,
                    sender_id: currentUser.id,
                    receiver_id: currentConversation.otherUserId,
                    content: content,
                    is_read: false
                })
                .select()
                .single();

            if (error) throw error;

            // 🟢 YENİ: Rate Limit Kaydet
            messageLimiter.recordAttempt('user_' + currentUser.id);

            // 🟢 YENİ: Mesajı otomatik olarak chate ekle (subscription beklemeden!)
            messages.push(data);
            renderMessages();
            scrollToBottom();

            // Input'u temizle
            if (messageInput) messageInput.value = '';
            if (nativeChatInput) {
                nativeChatInput.value = '';
                nativeChatSendBtn.disabled = true;
            }
            
            if (inputField) inputField.focus();

            // 🟢 YENİ: Konuşma listesini de güncelle
            updateConversationPreview(
                currentConversation.listingId,
                currentConversation.otherUserId,
                data
            );

            console.log('✅ Mesaj gönderildi ve otomatik gösterildi:', data);

        } catch (error) {
            console.error('❌ Mesaj gönderilirken hata:', error);
            if (typeof showNotification === 'function') {
                showNotification('❌ Message could not be sent. Please try again.', 'error');
            } else if (typeof showInlineToast === 'function') {
                showInlineToast('❌ Message could not be sent. Please try again.', 'error');
            } else {
                console.warn('Message could not be sent. Please try again.');
            }
        } finally {
            // 🟢 YENİ: Send butonunu tekrar enable et
            if (currentSendBtn) {
                currentSendBtn.disabled = false;
                currentSendBtn.innerHTML = originalIcon;
            }
        }
    }

    /**
     * Mesajları okundu işaretle (Değişiklik Yok)
     */
    async function markAsRead(listingId, otherUserId) {
        try {
            const { error } = await supabase
                .from('messages')
                .update({ is_read: true })
                .eq('listing_id', listingId)
                .eq('sender_id', otherUserId)
                .eq('receiver_id', currentUser.id)
                .eq('is_read', false);

            if (error) throw error;

        } catch (error) {
            console.error('Mesajlar okundu işaretlenirken hata:', error);
        }
    }

    /**
     * 🔔 REALTIME MESAJ DİNLEME - GELİŞTİRİLMİŞ
     * Mesajları dinler ve conversations listesini otomatik güncellemeler
     */
    function subscribeToMessages(listingId, otherUserId) {
        // Önceki subscription varsa tamamen kaldır
        if (messageSubscription) {
            console.log(`[Realtime] Removing old channel: ${messageSubscription.topic}`);
            supabase.removeChannel(messageSubscription);
            messageSubscription = null;
        }

        // --- 🟢 YENİ: Yarım kalmış tik güncellemeleri için yardımcı fonksiyon ---
        const updateMessageTicksLocally = (messageId, statusInfo) => {
            const msgEl = document.querySelector(`[data-message-id="${messageId}"]`);
            if (!msgEl) return;

            const readReceipt = msgEl.querySelector('.read-receipt');
            const nativeIcon = msgEl.querySelector('.native-status-icon');

            if (statusInfo.is_read) {
                if (readReceipt) {
                    readReceipt.className = 'read-receipt read';
                    readReceipt.innerHTML = '<i class="fas fa-check"></i><i class="fas fa-check"></i>';
                }
                if (nativeIcon) {
                    nativeIcon.className = 'fas fa-check-double native-status-icon read';
                }
            }
        };

        // --- 🟢 DETERMINISTIC CHANNEL NAME (Crucial for Seen/Typing Sync) ---
        // Her iki taraf da aynı "odaya" girebilmesi için User ID'leri alfabetik sıralıyoruz.
        const sortedIds = [currentUser.id, otherUserId].sort().join('_');
        const channelName = `chat:${listingId}_${sortedIds}`;
        
        console.log(`[Realtime] Joining deterministic channel: ${channelName}`);
        
        messageSubscription = supabase
            .channel(channelName)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `listing_id=eq.${listingId}`
            }, (payload) => {
                const newMessage = payload.new;
                
                // Bu konuşmaya ait mesaj mı kontrol et
                if ((newMessage.sender_id == currentUser.id && newMessage.receiver_id == otherUserId) ||
                    (newMessage.sender_id == otherUserId && newMessage.receiver_id == currentUser.id)) {
                    
                    // Kendi gönderdiğimiz INSERT eventi için UI'de zaten gösterildi; tekrar eklemeyi önle
                    const alreadyExists = messages.some(m => m.id === newMessage.id);
                    if (alreadyExists) return;
                    
                    messages.push(newMessage);
                    renderMessages();
                    scrollToBottom();

                    // Conversations listesini güncelle
                    updateConversationPreview(listingId, otherUserId, newMessage);

                    // Gelen mesajı okundu işaretle (Gecikmeli ve Broadcast ile)
                    if (newMessage.receiver_id === currentUser.id) {
                        setTimeout(() => {
                            markAsRead(listingId, otherUserId);
                            // 🟢 YENİ: Anlık Broadcast gönder (DB beklemeden karşı tarafa söyle)
                            messageSubscription.send({
                                type: 'broadcast',
                                event: 'seen',
                                payload: { message_id: newMessage.id, seen_at: new Date().toISOString() }
                            });
                        }, 300);
                    }
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
                filter: `listing_id=eq.${listingId}`
            }, (payload) => {
                const updatedMessage = payload.new;
                console.log('[Realtime] Message updated:', updatedMessage);
                
                // Aktif mesajlar listesinde güncelle
                const index = messages.findIndex(m => m.id === updatedMessage.id);
                if (index !== -1) {
                    messages[index] = updatedMessage;
                    // 🟢 OPTİMİZE: Tüm sayfayı renderlamak yerine sadece ilgili mesajın tiklerini düzelt
                    updateMessageTicksLocally(updatedMessage.id, { is_read: updatedMessage.is_read });
                }
            })
            .on('broadcast', { event: 'seen' }, (payload) => {
                console.log('[Realtime] Broadcast Seen received:', payload);
                // 🟢 OPTİMİZE: Veritabanından önce broadcast gelirse tikleri mavi yap
                updateMessageTicksLocally(payload.payload.message_id, { is_read: true });
                
                // Local state'i de güncelle ki ilerde renderMessages çağrılırsa bozulmasın
                const index = messages.findIndex(m => m.id === payload.payload.message_id);
                if (index !== -1) messages[index].is_read = true;
            })
            .on('presence', { event: 'sync' }, () => {
                const state = messageSubscription.presenceState();
                const otherUserPresence = Object.values(state).flat().find(p => p.user_id === otherUserId);
                const wrapper = document.getElementById('typing-indicator-wrapper');
                if (wrapper) {
                    wrapper.style.display = otherUserPresence?.is_typing ? 'block' : 'none';
                    if (otherUserPresence?.is_typing) scrollToBottom();
                }
            })
            .subscribe(async (status) => {
                console.log(`[Realtime] Channel status (${channelName}):`, status);
                if (status === 'SUBSCRIBED') {
                    await messageSubscription.track({
                        user_id: currentUser.id,
                        is_typing: false
                    });
                } else if (status === 'CHANNEL_ERROR') {
                    console.error(`[Realtime] Channel error on ${channelName}`);
                    // Re-subscribe attempt after a delay
                    setTimeout(() => subscribeToMessages(listingId, otherUserId), 3000);
                }
            });
    }

    /**
     * Yazıyor durumunu bildir
     */
    function sendTypingStatus(isTyping) {
        if (messageSubscription) {
            messageSubscription.track({
                user_id: currentUser.id,
                is_typing: isTyping
            });
        }
    }

    /**
     * 🟢 Yeni: Conversations listesi güncellemesi
     * Yeni mesaj geldiğinde conversation preview'ı ve sırasını güncelle
     */
    function updateConversationPreview(listingId, otherUserId, newMessage) {
        const conversationIndex = conversations.findIndex(c => 
            c.listing_id == listingId && c.other_user.id == otherUserId
        );

        if (conversationIndex !== -1) {
            // Konuşmayı güncelle
            conversations[conversationIndex].last_message = newMessage.content;
            conversations[conversationIndex].last_message_time = newMessage.created_at;

            // Eğer gelen mesaj varsa unread_count'u artır
            if (newMessage.receiver_id === currentUser.id) {
                conversations[conversationIndex].unread_count++;
            }

            // Konuşmayı başa taşı (en son mesaj olacak şekilde)
            const updatedConv = conversations.splice(conversationIndex, 1)[0];
            conversations.unshift(updatedConv);

            // Conversations listesini yeniden oluştur
            renderConversations();
        }
    }

    /**
     * 🟢 Yeni: Tüm konuşmaları realtime dinle (yeni mesajlar için)
     * Arka planda tüm konuşmaları izle
     */
    function subscribeToAllConversations() {
        const channelName = 'all-messages-global';
        return supabase
            .channel(channelName)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${currentUser.id}`
            }, async (payload) => {
                const newMessage = payload.new;
                console.log('[Realtime-Global] Event received:', newMessage);

                const isCurrentChat = currentConversation && 
                                    currentConversation.listingId == newMessage.listing_id && 
                                    (currentConversation.otherUserId == newMessage.sender_id || currentConversation.otherUserId == newMessage.receiver_id);

                // EĞER AKTİF KONUŞMAYSA: Güvenlik ağı (Safety Net)
                // Spesifik kanal (`chat:ID_ID`) çalışmazsa veya koparsa bu global dinleyici mesajı yakalar.
                if (isCurrentChat) {
                    console.log('[Realtime-Global] Safety net: Message belongs to active chat.');
                    const alreadyExists = messages.some(m => m.id === newMessage.id);
                    if (!alreadyExists) {
                        console.log('[Realtime-Global] Pushing missing message to UI.');
                        messages.push(newMessage);
                        renderMessages();
                        scrollToBottom();
                        
                        // Okundu işaretle
                        if (newMessage.receiver_id === currentUser.id) {
                            markAsRead(newMessage.listing_id, newMessage.sender_id);
                        }
                    }
                }

                // KONUŞMA LİSTESİNİ GÜNCELLE (Her durumda)
                if (!currentConversation || currentConversation.listingId != newMessage.listing_id || currentConversation.otherUserId != newMessage.sender_id) {
                    const convIndex = conversations.findIndex(c =>
                        c.listing_id == newMessage.listing_id && c.other_user.id == newMessage.sender_id
                    );

                    if (convIndex !== -1) {
                        // Mevcut konuşmayı güncelle ve başa taşı
                        conversations[convIndex].unread_count++;
                        conversations[convIndex].last_message = newMessage.content;
                        conversations[convIndex].last_message_time = newMessage.created_at;
                        
                        const conv = conversations.splice(convIndex, 1)[0];
                        conversations.unshift(conv);
                        renderConversations();
                    } else if (!isCurrentChat) {
                        // Yeni konuşma tespit edildi - detayları çek ve ekle
                        await addNewConversationToList(newMessage.listing_id, newMessage.sender_id, newMessage);
                    }
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
                filter: `sender_id=eq.${currentUser.id}`
            }, (payload) => {
                const updatedMessage = payload.new;
                console.log('[Realtime] Global message updated:', updatedMessage);
                
                // Eğer benden çıkan bir mesaj okunmuşsa, listedeki unread_count'u sıfırla (eğer gerekliyse)
                // Ama genellikle unread_count alıcı tarafındadır.
                // Eğer BİZ alıcıysak ve bir şekilde başka bir cihazdan okundu olarak işaretlenmişse:
                if (updatedMessage.receiver_id === currentUser.id && updatedMessage.is_read) {
                    const convIndex = conversations.findIndex(c =>
                        c.listing_id == updatedMessage.listing_id && c.other_user.id == updatedMessage.sender_id
                    );
                    if (convIndex !== -1) {
                        conversations[convIndex].unread_count = 0;
                        renderConversations();
                    }
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${currentUser.id}`
            }, (payload) => {
                const updatedMessage = payload.new;
                console.log('[Realtime-Global] Message updated (Seen):', updatedMessage);

                // Eğer bu mesaj okunduysa, konuşma listesindeki unread_count'u güncelle
                if (updatedMessage.is_read) {
                    const convIndex = conversations.findIndex(c =>
                        c.listing_id == updatedMessage.listing_id && c.other_user.id == updatedMessage.sender_id
                    );

                    if (convIndex !== -1) {
                        conversations[convIndex].unread_count = 0; // Tek mesaj bile okunsa o chat genellikle okunmuş sayılır (basit mantık)
                        // Veya daha iyisi DB'den tekrar çekmek ama burada sıfırlamak performansı artırır
                        renderConversations();
                    }
                }
            })
            .subscribe((status) => {
                console.log(`[Realtime] Global channel status (${channelName}):`, status);
            });
    }

    /**
     * Listede olmayan yeni bir konuşmayı dinamik olarak ekle
     */
    async function addNewConversationToList(listingId, otherUserId, initialMessage) {
        try {
            // İlan ve profil bilgilerini paralel çek
            const [listingResp, profileResp] = await Promise.all([
                supabase.from('listings').select('id, title, price, currency, photos, user_id').eq('id', listingId).single(),
                supabase.from('profiles').select('id, full_name, avatar_url').eq('id', otherUserId).single()
            ]);

            if (listingResp.error || profileResp.error) return;

            const listing = listingResp.data;
            const profile = profileResp.data;

            // Tip belirle
            const type = listing.user_id === currentUser.id ? 'selling' : 'buying';

            const newConv = {
                listing_id: listingId,
                other_user_id: otherUserId,
                other_user: profile,
                listing: listing,
                last_message: initialMessage.content,
                last_message_time: initialMessage.created_at,
                unread_count: 1,
                type: type
            };

            conversations.unshift(newConv);
            renderConversations();
            
            if (typeof showNotification === 'function') {
                showNotification(`💬 ${profile.full_name}: ${initialMessage.content.substring(0, 30)}...`, 'info', () => {
                    selectConversation(listingId, otherUserId);
                });
            }
        } catch (e) {
            console.error('Yeni konuşma eklenirken hata:', e);
        }
    }
  
    // --- 5. EVENT LISTENER'LAR (Değişiklik Yok) ---

    // Desktop/Default Events
    if (sendBtn) {
        sendBtn.addEventListener('click', () => sendMessage('desktop'));
    }
    
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage('desktop');
                sendTypingStatus(false);
            }
        });

        messageInput.addEventListener('input', () => {
            sendTypingStatus(true);
            
            if (typingTimeout) clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                sendTypingStatus(false);
            }, 3000);
        });
    }

    // Native Mobile Events
    if (nativeChatSendBtn) {
        nativeChatSendBtn.addEventListener('click', () => sendMessage('native'));
    }

    if (nativeChatInput) {
        nativeChatInput.addEventListener('input', (e) => {
            // Enable/disable send button based on input
            if (nativeChatSendBtn) {
                nativeChatSendBtn.disabled = e.target.value.trim() === '';
            }
            sendTypingStatus(true);
            if (typingTimeout) clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => sendTypingStatus(false), 3000);
        });

        nativeChatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (e.target.value.trim() !== '') {
                    sendMessage('native');
                    sendTypingStatus(false);
                }
            }
        });
    }

    if (nativeInboxBackBtn) {
        nativeInboxBackBtn.addEventListener('click', () => {
            // Can add logic to go back to previous page or close app wrapper
            window.location.href = '/';
        });
    }

    if (nativeChatBackBtn) {
        nativeChatBackBtn.addEventListener('click', () => {
            showConversationList();
        });
    }

    // Native List item selection
    if (nativeConversationsList) {
        nativeConversationsList.addEventListener('click', (e) => {
            const item = e.target.closest('.native-conv-item');
            if (item) {
                const listingId = item.dataset.listingId;
                const userId = item.dataset.userId;
                selectConversation(listingId, userId);
            }
        });
    }

    // Konuşma seçme (Desktop)
    if (conversationsList) {
        conversationsList.addEventListener('click', (e) => {
            // Checkbox tıklandıysa, seçim işlemini yap
            if (e.target.classList.contains('conversation-select')) {
                return; // Checkbox kendi event'ini halleder
            }

            const item = e.target.closest('.conversation-item');
            if (item) {
                // Bulk delete modundaysa checkbox'u toggle et
                if (bulkDeleteMode) {
                    const checkbox = item.querySelector('.conversation-select');
                    if (checkbox) {
                        checkbox.checked = !checkbox.checked;
                        const event = new Event('change');
                        checkbox.dispatchEvent(event);
                    }
                } else {
                    // Normal modda konuşmayı aç
                    const listingId = item.dataset.listingId;
                    const userId = item.dataset.userId;
                    selectConversation(listingId, userId);
                }
            }
        });
    }

    // Dosya yükleme
    inputTools.forEach(btn => {
        btn.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });
    });

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                // TODO: Dosya yükleme implementasyonu
                console.log('Dosya seçildi:', e.target.files);
                if (typeof showNotification === 'function') {
                    showNotification('File upload feature will be added soon!', 'info');
                } else if (typeof showInlineToast === 'function') {
                    showInlineToast('File upload feature will be added soon!', 'info');
                } else {
                    console.info('File upload feature will be added soon!');
                }
            }
        });
    }

    // İşlem Onayı Toggle
    if (approvalToggleBtn) {
        approvalToggleBtn.addEventListener('click', async () => {
            const container = document.getElementById('transaction-container');
            if (!container) return;

            const isOpen = container.classList.contains('open');
            if (isOpen) {
                container.classList.remove('open');
                container.style.display = 'none';
                return;
            }

            // Açılacaksa, gerekirse render et
            if (container.dataset.rendered !== 'true') {
                const listingId = container.dataset.listingId;
                const buyerId = container.dataset.buyerId;
                const sellerId = container.dataset.sellerId;
                const currentUserId = container.dataset.currentUserId;

                try {
                    const ui = new MessageTransactionUI(supabase);
                    await ui.renderTransactionButtons(
                        listingId,
                        buyerId,
                        sellerId,
                        currentUserId,
                        container
                    );
                    container.dataset.rendered = 'true';
                } catch (err) {
                    console.error('İşlem onayı render hatası:', err);
                }
            }

            container.classList.add('open');
            container.style.display = 'block';
        });
    }

    // 🔎 Arama Event Listener
    if (conversationSearch) {
        conversationSearch.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            renderConversations();
        });
    }
  
    // --- TOPLU SİLME FONKSİYONLARI ---

    /**
     * Toplu silme modunu aç/kapat
     */
    function toggleBulkDeleteMode() {
        bulkDeleteMode = !bulkDeleteMode;
        selectedConversations.clear();
        
        const bulkDeleteActions = document.getElementById('bulkDeleteActions');
        const bulkDeleteToggleBtn = document.getElementById('bulkDeleteToggleBtn');
        
        if (bulkDeleteMode) {
            bulkDeleteActions.style.display = 'flex';
            bulkDeleteToggleBtn.style.display = 'none';
        } else {
            bulkDeleteActions.style.display = 'none';
            bulkDeleteToggleBtn.style.display = 'flex';
        }
        
        updateSelectedCount();
        renderConversations();
    }

    /**
     * Checkbox event listener'larını ekle
     */
    function attachCheckboxListeners() {
        const checkboxes = document.querySelectorAll('.conversation-select');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const key = e.target.dataset.conversationKey;
                if (e.target.checked) {
                    selectedConversations.add(key);
                } else {
                    selectedConversations.delete(key);
                }
                updateSelectedCount();
                
                // Seçili item'a sınıf ekle
                const item = e.target.closest('.conversation-item');
                if (item) {
                    if (e.target.checked) {
                        item.classList.add('selected');
                    } else {
                        item.classList.remove('selected');
                    }
                }
            });
        });
    }

    /**
     * Seçili konuşma sayısını güncelle
     */
    function updateSelectedCount() {
        const countElement = document.getElementById('selectedCount');
        const deleteBtn = document.getElementById('deleteSelectedBtn');
        
        if (countElement) {
            countElement.textContent = selectedConversations.size;
        }
        
        if (deleteBtn) {
            deleteBtn.disabled = selectedConversations.size === 0;
        }
    }

    /**
     * Tüm konuşmaları seç/seçimi kaldır
     */
    function toggleSelectAll() {
        const checkboxes = document.querySelectorAll('.conversation-select');
        const allSelected = selectedConversations.size === conversations.length;
        
        if (allSelected) {
            // Tüm seçimleri kaldır
            selectedConversations.clear();
            checkboxes.forEach(cb => cb.checked = false);
        } else {
            // Tümünü seç
            conversations.forEach(conv => {
                const key = `${conv.listing_id}_${conv.other_user.id}`;
                selectedConversations.add(key);
            });
            checkboxes.forEach(cb => cb.checked = true);
        }
        
        updateSelectedCount();
        renderConversations();
    }

    /**
     * Seçili konuşmaları sil
     */
    async function deleteSelectedConversations() {
        if (selectedConversations.size === 0) return;
        
        const confirmMessage = `Are you sure you want to delete ${selectedConversations.size} conversations and all messages inside them? This action cannot be undone.`;
        
        // Uygulama içi onay bildirimi
        const confirmed = await showConfirmDialog(confirmMessage, 'Delete Conversations');
        if (!confirmed) return;
        
        try {
            let totalDeleted = 0;
            let hasErrors = false;
            
            // Her seçili konuşma için mesajları "Soft Delete" yap (LocalStorage)
            for (const key of selectedConversations) {
                const [listingId, otherUserId] = key.split('_');
                
                console.log(`🗑️ Siliniyor (Local): listing_id=${listingId}, otherUserId=${otherUserId}`);
                
                // LocalStorage'a kaydet
                localStorage.setItem(`deleted_${listingId}_${otherUserId}`, 'true');
                totalDeleted++;
            }
            
            // Sonuç mesajı
            if (hasErrors) {
                console.warn('⚠️ Bazı mesajlar silinemedi');
                if (typeof showNotification === 'function') {
                    showNotification(`⚠️ ${totalDeleted} messages deleted, some errors occurred`, 'warning');
                }
            } else {
                console.log(`✅ Toplam ${totalDeleted} mesaj başarıyla silindi`);
                if (typeof showNotification === 'function') {
                    showNotification(`✅ ${selectedConversations.size} conversations deleted (${totalDeleted} messages)`, 'success');
                }
            }
            
            // State'i temizle
            selectedConversations.clear();
            toggleBulkDeleteMode();
            
            // Konuşmaları yeniden yükle
            await loadConversations();
            
        } catch (error) {
            console.error('❌ Mesajlar silinirken hata:', error);
            if (typeof showNotification === 'function') {
                showNotification('❌ Messages could not be deleted', 'error');
            } else if (typeof showInlineToast === 'function') {
                showInlineToast('❌ Messages could not be deleted', 'error');
            } else {
                console.warn('Messages could not be deleted. Please try again.');
            }
        }
    }

    // Toplu silme butonları için event listener'lar
    const bulkDeleteToggleBtn = document.getElementById('bulkDeleteToggleBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const cancelBulkDeleteBtn = document.getElementById('cancelBulkDeleteBtn');

    if (bulkDeleteToggleBtn) {
        bulkDeleteToggleBtn.addEventListener('click', toggleBulkDeleteMode);
    }

    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', toggleSelectAll);
    }

    if (deleteSelectedBtn) {
        deleteSelectedBtn.addEventListener('click', deleteSelectedConversations);
    }

    if (cancelBulkDeleteBtn) {
        cancelBulkDeleteBtn.addEventListener('click', toggleBulkDeleteMode);
    }
  
    // --- 6. BAŞLATMA ---
    
    let allConversationsSubscription = null;

    async function init() {
        try {
            // Kullanıcı oturumunu kontrol et
            const { data: { session } } = await supabase.auth.getSession();
            
            // 🟢 Kritik Kontrol: Eğer oturum yoksa, kullanıcıyı login sayfasına yönlendir.
            if (!session) {
                console.log('❌ Oturum bulunamadı, login sayfasına yönlendiriliyor...');
                window.location.href = 'login.html';
                return;
            }

            currentUser = session.user;
            console.log('✅ Kullanıcı oturumu:', currentUser.email);

            // 🟢 Tüm konuşmaları realtime dinle
            allConversationsSubscription = subscribeToAllConversations();

            // Tarayıcı bildirimleri devre dışı - uygulama içi bildirimler kullanılıyor
            console.log('📱 Uygulama içi bildirimler aktif');

            // URL parametrelerini kontrol et (ilan detaydan geliyorsa)
            const urlParams = new URLSearchParams(window.location.search);
            const listingId = urlParams.get('listing_id');
            const sellerId = urlParams.get('seller_id');

            console.log('🔍 URL parametreleri kontrol ediliyor...');
            console.log('📋 listing_id parametresi:', listingId);
            console.log('👤 seller_id parametresi:', sellerId);

            if (listingId && sellerId) {
                // 🟢 Kritik Kontrol: Kendi kendine mesajlaşmayı engelle.
                if (currentUser.id === sellerId) {
                     if (typeof showNotification === 'function') {
                        showNotification('You cannot send a message to your own listing.', 'warning');
                    }
                    // URL'yi temizle ve normal konuşmaları yükle
                    window.history.replaceState({}, document.title, 'mesajlar.html');
                    await loadConversations();
                    return;
                }
                
                console.log('✅ URL parametreleri mevcut, yeni konuşma başlatılacak');
                
                // Önce tüm konuşmaları yükle
                await loadConversations();
                
                // Sonra hedef konuşmayı seç veya ekle
                await startNewConversation(listingId, sellerId);
            } else {
                console.log('📋 URL parametresi yok, tüm konuşmalar yüklenecek');
                await loadConversations();
            }

            // Eğer henüz bir konuşma seçilmediyse, composer'ı gizle
            if (!currentConversation) {
                hideComposer();
            }
            
            // Filtreleri başlat
            initFilters();

        } catch (error) {
            console.error('❌ Başlatma hatası:', error);
            showError(conversationsList, 'An error occurred. Please refresh the page.');
        }
    }

    /**
     * Yeni konuşma başlat (ilan detaydan geldiğinde) (Değişiklik Yok)
     */
    async function startNewConversation(listingId, sellerId) {
        try {
            console.log('🆕 Konuşma kontrol ediliyor/başlatılıyor...');
            
            // 1. Zaten listede var mı?
            const existingConvIndex = conversations.findIndex(c => c.listing_id == listingId && c.other_user.id == sellerId);
            
            if (existingConvIndex !== -1) {
                console.log('✅ Konuşma zaten listede bulundu, seçiliyor.');
                selectConversation(listingId, sellerId);
                
                // URL temizle
                window.history.replaceState({}, document.title, 'mesajlar.html');
                return;
            }

            // 2. Listede yoksa, detayları çek ve ekle
            showLoading(conversationsList, 'Preparing conversation...');

            // İlan bilgilerini getir
            // Note: The original code matches this structure. I'm replacing the top of the function.
            // But let's be careful. The previous failure said "target content not found".
            // I will target simpler lines.

            // İlan bilgilerini getir
            const { data: listing, error: listingError } = await supabase
                .from('listings')
                .select('id, title, price, currency, photos')
                .eq('id', listingId)
                .single();

            if (listingError) throw listingError;

            // Satıcı bilgilerini getir
            const { data: seller, error: sellerError } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .eq('id', sellerId)
                .single();

            if (sellerError) throw sellerError;

            // Bu konuşma daha önce var mı kontrol et (DB'den)
            const { data: existingMessages, error: messageError } = await supabase
                .from('messages')
                .select('*')
                .eq('listing_id', listingId)
                .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${sellerId}),and(sender_id.eq.${sellerId},receiver_id.eq.${currentUser.id})`)
                .order('created_at', { ascending: false })
                .limit(1);

            if (messageError) throw messageError;

            // Yeni konuşma objesi
            const newConv = {
                listing_id: listingId,
                other_user: seller,
                listing: listing,
                last_message: existingMessages && existingMessages.length > 0 ? existingMessages[0].content : 'Write a message to start a conversation',
                last_message_time: existingMessages && existingMessages.length > 0 ? existingMessages[0].created_at : new Date().toISOString(),
                unread_count: 0,
                type: listing.user_id === currentUser.id ? 'selling' : 'buying'
            };

            // Başa ekle
            conversations.unshift(newConv);
            
            // Renderla ve seç
            renderConversations();
            selectConversation(listingId, sellerId);

            // URL temizle
            window.history.replaceState({}, document.title, 'mesajlar.html');
            console.log('✅ Konuşma listeye eklendi ve seçildi');

        } catch (error) {
            console.error('❌ Yeni konuşma başlatılırken hata:', error);
            showError(conversationsList, 'Could not start conversation');
            // Hata olsa bile mevcut listeyi göster
            renderConversations();
        }
    }

    // Sayfa yüklendiğinde başlat
    document.addEventListener('DOMContentLoaded', init);

    // 🟢 YENİ: Sayfanın görünürlüğü değiştiğinde (tab değişimi vs) konuşmaları yenile
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && currentUser && conversations.length > 0) {
            console.log('👁️ Sayfa tekrar görünür hale geldi, konuşmalar yenileniyor...');
            loadConversations();
        }
    });

    // Sayfa kapatılırken subscription'ları temizle
    window.addEventListener('beforeunload', () => {
        if (messageSubscription) {
            messageSubscription.unsubscribe();
        }
        if (allConversationsSubscription) {
            allConversationsSubscription.unsubscribe();
        }
    });

    // --- SWIPE ACTIONS & FILTERS ---
    
    // Swipe dinleyicilerini başlat
    function initSwipeListeners() {
        const items = document.querySelectorAll('.conversation-item');
        items.forEach(item => {
            let startX = 0;
            let currentX = 0;
            let isDragging = false;

            item.addEventListener('touchstart', (e) => {
                if (bulkDeleteMode) return;
                startX = e.touches[0].clientX;
                isDragging = true;
            });

            item.addEventListener('touchmove', (e) => {
                if (!isDragging || bulkDeleteMode) return;
                currentX = e.touches[0].clientX;
                const diff = startX - currentX;
                
                if (diff > 30) {
                    item.classList.add('swiped-left');
                } else if (diff < -10) {
                    item.classList.remove('swiped-left');
                }
            });

            item.addEventListener('touchend', () => {
                isDragging = false;
            });

            // Mouse desteği
            item.addEventListener('mousedown', (e) => {
                if (bulkDeleteMode) return;
                startX = e.clientX;
                isDragging = true;
            });

            item.addEventListener('mousemove', (e) => {
                if (!isDragging || bulkDeleteMode) return;
                currentX = e.clientX;
                const diff = startX - currentX;
                
                if (diff > 50) {
                    item.classList.add('swiped-left');
                }
            });

            item.addEventListener('mouseup', () => {
                isDragging = false;
            });
        });
    }

    // Arama filtreleri başlatma
    function initFilters() {
        const filterChips = document.querySelectorAll('.filter-chip');
        let activeFilter = 'all';

        filterChips.forEach(chip => {
            chip.addEventListener('click', () => {
                // Aktif sınıfı değiştir
                filterChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                
                activeFilter = chip.dataset.filter;
                applyFilter(activeFilter);
            });
        });
    }

    function applyFilter(filter) {
        const items = document.querySelectorAll('.conversation-item');
        
        items.forEach(item => {
            const unread = item.classList.contains('unread');
            const isArchived = item.dataset.archived === 'true';
            
            switch(filter) {
                case 'unread':
                    item.style.display = (unread && !isArchived) ? '' : 'none';
                    break;
                case 'buying':
                    item.style.display = (item.dataset.type === 'buying' && !isArchived) ? '' : 'none';
                    break;
                case 'selling':
                    item.style.display = (item.dataset.type === 'selling' && !isArchived) ? '' : 'none';
                    break;
                case 'archived':
                    // Show ONLY archived items
                    item.style.display = isArchived ? '' : 'none';
                    break;
                case 'blocked':
                    item.style.display = (item.dataset.blocked === 'true' && !isArchived) ? '' : 'none';
                    break;
                case 'all':
                default:
                    // Show everything EXCEPT archived items
                    item.style.display = !isArchived ? '' : 'none';
                    break;
            }
        });
    }

    // Konuşma başındaki üç nokta menüsünü ve eylemleri başlat
    function initConversationActions(listingId, otherUserId, conversationKey) {
        const wrapper = adReference.querySelector('.action-menu-wrapper');
        if (!wrapper) return;

        const dotsBtn = wrapper.querySelector('.three-dots-btn');
        const menu = wrapper.querySelector('.ad-action-menu');
        const blockBtn = wrapper.querySelector('.block-action');
        const reportBtn = wrapper.querySelector('.report-action');
        const archiveBtn = wrapper.querySelector('.archive-action');
        const deleteBtn = wrapper.querySelector('.delete-action');

        function closeAllMenus() {
            document.querySelectorAll('.ad-action-menu').forEach(m => { if (m !== menu) m.style.display = 'none'; });
        }

        function openMenu() {
            closeAllMenus();
            menu.style.display = 'flex';
            menu.style.flexDirection = 'column';
            menu.style.zIndex = 10001;
            
            // Prevent clicks inside menu from closing it immediately (bubbling to document)
            // But actually, we want clicks on buttons to propagate to their handlers, 
            // and those handlers call closeMenu().
            // The document listener checks !wrapper.contains(target), so clicks inside allow standard processing.
        }

        function closeMenu() {
            if (menu) { menu.style.display = 'none'; menu.style.zIndex = ''; }
        }

        // Toggle menu (desktop) or show bottom sheet (mobile)
        dotsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isMobileView()) {
                showActionSheet(listingId, otherUserId, conversationKey);
                return;
            }
            if (menu.style.display === 'flex') closeMenu(); else openMenu();
        });

        // Click outside to close (fallback)
        document.addEventListener('click', (e) => {
            if (menu.style.display === 'flex' && !wrapper.contains(e.target)) {
                closeMenu();
            }
        });

        // Block handler
        if (blockBtn) {
            blockBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeMenu();
                window.MessagesApp.blockUser(listingId, otherUserId);
            });
        }

        // Report handler
        if (reportBtn) {
            reportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeMenu();
                window.MessagesApp.openReportModal(listingId, otherUserId);
            });
        }

        // Archive handler: toggle archived state locally (and try DB update)
        archiveBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            closeMenu();
            const convKey = conversationKey;
            const items = document.querySelectorAll(`[data-conversation-key="${convKey}"]`);
            const archivedState = localStorage.getItem(`conv_archived_${convKey}`) === 'true' ? false : true;

            items.forEach(it => {
                it.dataset.archived = archivedState ? 'true' : 'false';
                if (archivedState) it.classList.add('archived'); else it.classList.remove('archived');
            });
            localStorage.setItem(`conv_archived_${convKey}`, archivedState ? 'true' : 'false');

            // Try to persist to DB (optional): currently commenting out to avoid 400 errors if column missing
            // const { error } = await supabase
            //     .from('messages')
            //     .update({ archived: archivedState })
            //     .eq('listing_id', listingId)
            //     .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUser.id})`);

            // Apply filter immediately to refresh view (hide item if needed)
            const activeFilter = document.querySelector('.filter-chip.active')?.dataset.filter || 'all';
            applyFilter(activeFilter);

            if (typeof showNotification === 'function') {
                const action = archivedState ? 'Chat archived' : 'Chat unarchived';
                showNotification(action, 'success');
                // Kullanıcı isteği: Sayfa yenilensin
                setTimeout(() => {
                    location.reload();
                }, 1000);
            }
        });

        // Delete handler uses existing global deleteConversation
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            closeMenu();
            // confirmation and deletion handled in window.MessagesApp.deleteConversation
            window.MessagesApp?.deleteConversation(listingId, otherUserId);
        });
    }

    // Mobile bottom sheet for actions
    function showActionSheet(listingId, otherUserId, conversationKey) {
        let sheet = document.getElementById('ad-action-sheet');
        if (!sheet) {
            sheet = document.createElement('div');
            sheet.id = 'ad-action-sheet';
            document.body.appendChild(sheet);
        }

        sheet.innerHTML = `
            <div class="sheet-backdrop"></div>
            <div class="sheet-panel">
                <div class="sheet-handle"></div>
                <button class="sheet-action block-action">Block this user</button>
                <button class="sheet-action report-action">Report this user</button>
                <button class="sheet-action archive-action">Archive Chat</button>
                <button class="sheet-action delete-action">Delete Chat</button>
            </div>
        `;

        const backdrop = sheet.querySelector('.sheet-backdrop');
        const blockBtn = sheet.querySelector('.block-action');
        const reportBtn = sheet.querySelector('.report-action');
        const archiveBtn = sheet.querySelector('.archive-action');
        const deleteBtn = sheet.querySelector('.delete-action');

        function hideSheet() { sheet.classList.remove('open'); setTimeout(() => { sheet.remove(); }, 250); }

        // close when user taps outside the panel (backdrop)
        backdrop.addEventListener('click', hideSheet);

        if (blockBtn) {
            blockBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                hideSheet();
                window.MessagesApp.blockUser(listingId, otherUserId);
            });
        }

        if (reportBtn) {
            reportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                hideSheet();
                window.MessagesApp.openReportModal(listingId, otherUserId);
            });
        }

        archiveBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            hideSheet();
            // reuse archive logic: toggle localStorage and try DB update
            const convKey = conversationKey;
            const archivedState = localStorage.getItem(`conv_archived_${convKey}`) === 'true' ? false : true;
            document.querySelectorAll(`[data-conversation-key="${convKey}"]`).forEach(it => {
                it.dataset.archived = archivedState ? 'true' : 'false';
                if (archivedState) it.classList.add('archived'); else it.classList.remove('archived');
            });
            localStorage.setItem(`conv_archived_${convKey}`, archivedState ? 'true' : 'false');
            // Try to persist to DB (optional): commented out to avoid errors
            // try {
            //     await supabase
            //         .from('messages')
            //         .update({ archived: archivedState })
            //         .eq('listing_id', listingId)
            //         .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUser.id})`);
            // } catch (err) { console.warn('Archiving in DB failed:', err); }

            // Apply filter immediately
            const activeFilter = document.querySelector('.filter-chip.active')?.dataset.filter || 'all';
            applyFilter(activeFilter);

            if (typeof showNotification === 'function') {
                const action = archivedState ? 'Chat archived' : 'Chat unarchived';
                showNotification(action, 'success');
                // Kullanıcı isteği: Sayfa yenilensin
                setTimeout(() => {
                    location.reload();
                }, 1000);
            }
        });

        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            hideSheet();
            window.MessagesApp?.deleteConversation(listingId, otherUserId);
        });

        // show
        requestAnimationFrame(() => sheet.classList.add('open'));
    }

    // Yazıyor göstergesini ekle/kaldır
    function showTypingIndicator(listingId, userId, isTyping) {
        const item = document.querySelector(`[data-listing-id="${listingId}"][data-user-id="${userId}"]`);
        if (!item) return;

        const lastMessage = item.querySelector('.last-message');
        if (!lastMessage) return;

        if (isTyping) {
            lastMessage.innerHTML = `
                <span class="typing-indicator">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                    typing...
                </span>
            `;
        } else {
            // Orijinal mesajı geri yükle (bu fonksiyonu ihtiyaç halinde genişletebilirsiniz)
            loadConversations();
        }
    }

    // --- Report & Block Logic ---
    let currentReportTarget = null;

    window.closeReportModal = function() {
        const modal = document.getElementById('report-modal');
        if (modal) modal.style.display = 'none';
        document.getElementById('report-form').reset();
        currentReportTarget = null;
    };

    function openReportModal(listingId, userId) {
        currentReportTarget = { listingId, userId };
        const modal = document.getElementById('report-modal');
        if (modal) {
            modal.style.display = 'flex';
            // Focus on reason
            document.getElementById('report-reason').focus();
        }
    }

    // Initialize Report Form Listener
    const reportForm = document.getElementById('report-form');
    if (reportForm) {
        reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentReportTarget) return;

            const reason = document.getElementById('report-reason').value;
            const email = document.getElementById('report-email').value;
            const description = document.getElementById('report-description').value;
            const submitBtn = reportForm.querySelector('button[type="submit"]');
            
            try {
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Sending...';
                submitBtn.disabled = true;

                // 1. Try Supabase Insert
                const { error } = await supabase.from('reports').insert({
                    reporter_id: currentUser ? currentUser.id : null,
                    reported_id: currentReportTarget.userId,
                    listing_id: currentReportTarget.listingId,
                    reason,
                    email,
                    description,
                    status: 'pending'
                });

                if (error) {
                    console.warn('Report DB insert failed, falling back to LocalStorage', error);
                    throw error; // Trigger catch for fallback
                }

                showNotification('Your report has been submitted successfully. Thank you.', 'success');

            } catch (err) {
                // 2. Fallback to LocalStorage
                const report = {
                    id: 'local_' + Date.now(),
                    reporter_id: currentUser ? currentUser.id : 'anon',
                    reported_id: currentReportTarget.userId,
                    listing_id: currentReportTarget.listingId,
                    reason,
                    email,
                    description,
                    status: 'pending',
                    created_at: new Date().toISOString()
                };
                
                // Store in a list
                const reports = JSON.parse(localStorage.getItem('reports_backup') || '[]');
                reports.push(report);
                localStorage.setItem('reports_backup', JSON.stringify(reports));

                showNotification('Your report has been received (Demo Mode).', 'success');
            } finally {
                submitBtn.textContent = 'Report';
                submitBtn.disabled = false;
                window.closeReportModal();
            }
        });
    }
    
    // Close modal on outside click
    const reportModal = document.getElementById('report-modal');
    if (reportModal) {
        reportModal.addEventListener('click', (e) => {
            if (e.target === reportModal) window.closeReportModal();
        });
    }

    // Cancel buttons
    document.getElementById('cancelReportBtn')?.addEventListener('click', window.closeReportModal);
    document.getElementById('closeReportModalBtn')?.addEventListener('click', window.closeReportModal);


    // Global fonksiyon (geri butonu için ve dışarıdan erişim için)
    window.MessagesApp = {
        backToList: function() {
            showConversationList();
            hideComposer();
        },
        showTyping: showTypingIndicator,
        
        openReportModal: openReportModal,

        blockUser: async function(listingId, userId) {
            // Custom Confirm Dialog for Block Action
            const confirmed = await new Promise(resolve => {
                const overlay = document.createElement('div');
                overlay.style.cssText = `
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5); z-index: 99999;
                    display: flex; align-items: center; justify-content: center;
                `;
                overlay.innerHTML = `
                    <div style="background: white; padding: 25px; border-radius: 12px; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
                        <div style="margin-bottom: 15px;">
                            <i class="fas fa-ban" style="font-size: 3rem; color: #ef4444;"></i>
                        </div>
                        <h3 style="margin: 0 0 10px 0; color: #1f2937; font-size: 1.25rem; font-weight: 600;">Block User</h3>
                        <p style="color: #4b5563; margin-bottom: 20px; line-height: 1.5;">
                            Are you sure you want to block this user? Blocked users cannot send you messages.
                        </p>
                        <div style="display: flex; gap: 10px; justify-content: center;">
                            <button id="cancelBlockBtn" style="padding: 10px 20px; border: 1px solid #d1d5db; background: white; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 0.95rem; color: #374151;">Cancel</button>
                            <button id="confirmBlockBtn" style="padding: 10px 20px; border: none; background: #ef4444; color: white; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.95rem;">Block</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(overlay);

                // Button hover effects
                const cancelBtn = overlay.querySelector('#cancelBlockBtn');
                const confirmBtn = overlay.querySelector('#confirmBlockBtn');
                
                cancelBtn.onmouseover = () => { cancelBtn.style.background = '#f3f4f6'; };
                cancelBtn.onmouseout = () => { cancelBtn.style.background = 'white'; };
                confirmBtn.onmouseover = () => { confirmBtn.style.background = '#dc2626'; };
                confirmBtn.onmouseout = () => { confirmBtn.style.background = '#ef4444'; };

                cancelBtn.onclick = () => { overlay.remove(); resolve(false); };
                confirmBtn.onclick = () => { overlay.remove(); resolve(true); };
                overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
            });

            if (confirmed) {
                try {
                    // 1. Try Supabase
                    const { error } = await supabase.from('blocked_users').insert({
                        blocker_id: currentUser.id,
                        blocked_id: userId
                    });

                    if (error) throw error;
                    showNotification('User successfully blocked.', 'success');

                } catch (err) {
                    // 2. Fallback LocalStorage
                    console.warn('Block DB insert failed, using LocalStorage', err);
                    const key = `blocked_${currentUser.id}_${userId}`;
                    localStorage.setItem(key, 'true');
                    showNotification('User blocked.', 'success');
                }
                
                // Refresh to potentially hide chat or update UI
                setTimeout(() => location.reload(), 1000);
            }
        },

        // 🟢 Soft Delete Implementation (LocalStorage Only to avoid DB errors)
        deleteConversation: async function(listingId, userId) {
            // Swipe delete işlemi veya Dropdown delete
            const confirmed = await showConfirmDialog('Are you sure you want to delete this chat? (It will only be deleted from your screen)', 'Delete Chat');
            if (confirmed) {
                try {
                    // LocalStorage'a kaydet
                    const key = `deleted_${listingId}_${userId}`;
                    localStorage.setItem(key, 'true');

                    // Başarılı
                    if (typeof showNotification === 'function') {
                        showNotification('Chat deleted.', 'success');
                        // Kullanıcı isteği: Sayfa yenilensin
                        setTimeout(() => {
                            location.reload();
                        }, 1000);
                    }
                    
                    // Listeyi yenile (Sayfa yenilendiği için buna gerek kalmayabilir ama kalsın)
                    await loadConversations();

                    // Eğer açık olan konuşmaysa listeye dön
                    if (currentConversation && currentConversation.listingId == listingId && currentConversation.otherUserId == userId) {
                        window.MessagesApp.backToList();
                    }

                } catch (error) {
                    console.error('Konuşma silinirken hata:', error);
                    if (typeof showNotification === 'function') {
                        showNotification('Deletion failed.', 'error');
                    }
                }
            }
        }
    };

})();