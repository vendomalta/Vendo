// Gerçek Zamanlı Bildirim Sistemi
import { supabase } from './supabase.js';

class RealtimeNotifications {
    constructor() {
        this.channels = [];
        this.notificationCount = 0;
        this.user = null;
        this.listEls = [];
    }

    async initialize() {
        // Kullanıcı kontrolü
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        this.user = user;
        this.syncInitialCountFromBadge();
        document.addEventListener('headerLoaded', () => this.syncInitialCountFromBadge());
        document.addEventListener('headerLoaded', () => this.bindDropdown());
        this.bindDropdown();
        
        // Realtime kanallarını başlat
        this.subscribeToMessages();
        await this.subscribeToFavorites();
        this.subscribeToGeneralNotifications(); // Yeni: Merkezi bildirimler
        this.subscribeToListingUpdates();
        await this.loadInitialNotifications();
        
        console.log('🔔 Realtime bildirimler aktif!');
    }

    syncInitialCountFromBadge() {
        const badge = document.querySelector('#notificationBtn .notification-badge');
        if (!badge) return;
        const current = parseInt(badge.textContent, 10);
        if (!Number.isNaN(current) && current > this.notificationCount) {
            this.notificationCount = current;
            this.updateBadge();
        }
    }

    bindDropdown() {
        this.listEls = document.querySelectorAll('.notification-list');
        const clearBtns = document.querySelectorAll('.clear-notifications');

        clearBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                
                // 1. UI'ı hemen temizle
                this.listEls.forEach(el => {
                    el.innerHTML = '';
                    this.renderEmptyState(el);
                });
                this.notificationCount = 0;
                this.updateBadge();

                // LocalStorage'a temizleme zamanını kaydet (Favoriler için)
                localStorage.setItem('lastNotificationClearTime', new Date().toISOString());

                // 2. Arka planda okundu işaretle
                try {
                    await supabase
                        .from('messages')
                        .update({ is_read: true })
                        .eq('receiver_id', this.user.id)
                        .eq('is_read', false);
                        
                    await supabase
                        .from('notifications')
                        .update({ is_read: true })
                        .eq('user_id', this.user.id)
                        .eq('is_read', false);
                } catch (err) {
                    console.error('Bildirim temizleme hatası:', err);
                }
            });
        });
    }

    async loadInitialNotifications() {
        try {
            if (!this.user) return;

            // 1. Mesajları yükle (Sadece okunmamışlar)
            const { data: messages, error: msgErr } = await supabase
                .from('messages')
                .select('id, content, created_at, sender_id, listing_id, is_read')
                .eq('receiver_id', this.user.id)
                .eq('is_read', false) // Sadece okunmamışlar
                .order('created_at', { ascending: false })
                .limit(20);

            if (msgErr) throw msgErr;

            // 2. Favorileri yükle
            const { data: listingRows } = await supabase
                .from('listings')
                .select('id, title')
                .eq('user_id', this.user.id);
            const listingIds = listingRows?.map(l => l.id) || [];

            let favorites = [];
            if (listingIds.length) {
                const { data: favRows, error: favErr } = await supabase
                    .from('favorites')
                    .select('id, listing_id, created_at')
                    .in('listing_id', listingIds)
                    .neq('user_id', this.user.id)
                    .order('created_at', { ascending: false })
                    .limit(20);
                if (favErr) throw favErr;
                
                // Favorileri son temizleme zamanına göre filtrele
                const lastClearTime = localStorage.getItem('lastNotificationClearTime');
                if (lastClearTime) {
                    const clearDate = new Date(lastClearTime);
                    favorites = (favRows || []).filter(f => new Date(f.created_at) > clearDate);
                } else {
                    favorites = favRows || [];
                }
            }

            // 3. Merkezi Bildirimler (Sadece okunmamışlar)
            const { data: generalNotifications, error: genErr } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', this.user.id)
                .eq('is_read', false) // Sadece okunmamışlar
                .order('created_at', { ascending: false })
                .limit(20);

            if (genErr) throw genErr;

            if (this.listEls.length > 0) {
                this.listEls.forEach(el => el.innerHTML = '');
                
                // Tüm bildirimleri birleştir ve tarihe göre sırala
                const allNotifications = [
                    ...(messages || []).map(m => ({
                        type: 'message',
                        text: m.content,
                        time: m.created_at,
                        unread: !m.is_read,
                        listingId: m.listing_id
                    })),
                    ...(favorites || []).map(f => ({
                        type: 'favorite',
                        text: 'İlanınız favorilere eklendi',
                        time: f.created_at,
                        listingId: f.listing_id
                    })),
                    ...(generalNotifications || []).map(n => ({
                        type: n.type,
                        text: n.message,
                        time: n.created_at,
                        unread: !n.is_read,
                        listingId: n.related_listing_id,
                        title: n.title
                    }))
                ].sort((a, b) => new Date(b.time) - new Date(a.time)); // Limit 20 kaldırıldı, zaten kaynaklarda limit var

                this.notificationCount = allNotifications.length;
                this.updateBadge(); // Badge'i güncelle

                allNotifications.forEach(n => this.renderDropdownItem(n));

                if (allNotifications.length === 0) {
                    this.listEls.forEach(el => this.renderEmptyState(el));
                }
            }
        } catch (err) {
            console.error('Başlangıç bildirimleri yüklenemedi:', err);
            this.listEls.forEach(el => this.renderEmptyState(el));
        }
    }

    renderEmptyState(el) {
        if (!el) return;
        el.innerHTML = `
            <div style="padding: 1rem; text-align: center; color: var(--text-muted);">
                <i class="fas fa-bell-slash" style="font-size: 1.25rem; margin-bottom: .25rem;"></i>
                <div>Şu anda bildiriminiz yok</div>
            </div>
        `;
    }

    renderDropdownItem({ type, text, time, unread = false, listingId = null, title = null }) {
        if (this.listEls.length === 0) return;
        
        let icon = 'fas fa-info-circle';
        let color = 'var(--info)';
        
        if (type === 'message') {
            icon = 'fas fa-comment';
            color = 'var(--primary)';
        } else if (type === 'favorite') {
            icon = 'fas fa-heart';
            color = 'var(--danger)';
        } else if (type === 'price_drop') {
            icon = 'fas fa-tag';
            color = '#f59e0b'; // Amber/Warning color
        }

        const prettyTime = this.prettyTime(time);
        const displayTitle = title || (type === 'message' ? 'Yeni Mesaj' : (type === 'favorite' ? 'Favori' : 'Bildirim'));
        const itemHtml = `
            <div class="notification-item ${unread ? 'unread' : ''}" ${listingId ? `data-listing-id="${listingId}"` : ''}>
                <div class="notification-icon">
                    <i class="${icon}" style="color: ${color};"></i>
                </div>
                <div class="notification-content">
                    <p class="notification-title" style="font-weight: 600; font-size: 0.85rem; margin-bottom: 2px;">${this.escape(displayTitle)}</p>
                    <p class="notification-text" style="font-size: 0.8rem; line-height: 1.3;">${this.escape(text)}</p>
                    <span class="notification-time">${prettyTime}</span>
                </div>
            </div>
        `;
        
        this.listEls.forEach(el => {
            el.insertAdjacentHTML('afterbegin', itemHtml);
            const last = el.firstElementChild;
            if (!last) return;
            last.style.cursor = 'pointer';
            last.addEventListener('click', () => {
                if (type === 'message') {
                    window.location.href = 'mesajlar.html';
                } else if ((type === 'favorite' || type === 'price_drop') && listingId) {
                    window.location.href = `ilan-detay.html?id=${listingId}`;
                }
            });
        });
    }

    prettyTime(ts) {
        try {
            const d = new Date(ts);
            return d.toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        } catch { return 'az önce'; }
    }

    escape(s) {
        return String(s || '').replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
        })[c]);
    }

    // Mesajlar için realtime dinleyici
    subscribeToMessages() {
        const messagesChannel = supabase
            .channel('messages-channel')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `receiver_id=eq.${this.user.id}`
                },
                (payload) => {
                    this.handleNewMessage(payload.new);
                }
            )
            .subscribe();

        this.channels.push(messagesChannel);
    }

    // Genel bildirimler (notifications tablosu) için realtime dinleyici
    subscribeToGeneralNotifications() {
        const notificationsChannel = supabase
            .channel('general-notifications-channel')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${this.user.id}`
                },
                (payload) => {
                    this.handleGeneralNotification(payload.new);
                }
            )
            .subscribe();

        this.channels.push(notificationsChannel);
    }

    // Favoriler için realtime dinleyici
    async subscribeToFavorites() {
        const ids = await this.getUserListingIds();
        const favoritesChannel = supabase
            .channel('favorites-channel')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'favorites',
                    filter: `listing_id=in.(${ids})`
                },
                (payload) => {
                    this.handleNewFavorite(payload.new);
                }
            )
            .subscribe();

        this.channels.push(favoritesChannel);
    }

    // İlan güncellemeleri için realtime dinleyici
    subscribeToListingUpdates() {
        const listingsChannel = supabase
            .channel('listings-channel')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'listings',
                    filter: `user_id=eq.${this.user.id}`
                },
                (payload) => {
                    this.handleListingUpdate(payload.new);
                }
            )
            .subscribe();

        this.channels.push(listingsChannel);
    }

    // Yeni mesaj geldiğinde
    async handleNewMessage(message) {
        this.notificationCount++;
        this.updateBadge();
        
        // Gönderen profilini getir
        let senderName = 'Yeni Mesaj';
        try {
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', message.sender_id)
                .single();
            if (profile) senderName = profile.full_name;
        } catch (e) { console.warn('Gönderen ismi alınamadı'); }

        // Bildirim göster
        this.showNotification({
            title: senderName,
            body: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
            icon: 'fas fa-comment',
            color: 'primary',
            action: () => window.location.href = 'mesajlar.html'
        });

        // Diğer scriptler (örn: messages.js) için global event yayınla
        document.dispatchEvent(new CustomEvent('newMessageReceived', { 
            detail: { message, senderName } 
        }));

        // Dropdown'a ekle
        this.renderDropdownItem({
            type: 'message',
            text: message.content,
            time: message.created_at,
            unread: true,
            listingId: message.listing_id
        });

        // Ses çal
        this.playNotificationSound();
    }

    // Genel bildirim geldiğinde (Fiyat düşüşü vb.)
    handleGeneralNotification(notification) {
        this.notificationCount++;
        this.updateBadge();

        let icon = 'fas fa-info-circle';
        let color = 'info';

        if (notification.type === 'price_drop') {
            icon = 'fas fa-tag';
            color = 'warning';
        }

        this.showNotification({
            title: notification.title,
            body: notification.message,
            icon: icon,
            color: color,
            action: () => {
                if (notification.related_listing_id) {
                    window.location.href = `ilan-detay.html?id=${notification.related_listing_id}`;
                }
            }
        });

        // Dropdown'a ekle
        this.renderDropdownItem({
            type: notification.type,
            text: notification.message,
            time: notification.created_at,
            unread: true,
            listingId: notification.related_listing_id,
            title: notification.title
        });

        this.playNotificationSound();
    }

    // İlanınız favoriye eklendiğinde
    handleNewFavorite(favorite) {
        this.notificationCount++;
        this.updateBadge();
        
        this.showNotification({
            title: 'İlanınız Favorilere Eklendi',
            body: 'Birisi ilanınızı beğendi!',
            icon: 'fas fa-heart',
            color: 'danger',
            action: () => window.location.href = 'ilanlarim.html'
        });

        // Dropdown'a ekle
        this.renderDropdownItem({
            type: 'favorite',
            text: 'İlanınız favorilere eklendi',
            time: favorite.created_at,
            listingId: favorite.listing_id
        });

        this.playNotificationSound();
    }

    // İlan güncellendiğinde
    handleListingUpdate(listing) {
        // Sadece önemli güncellemelerde bildir (örn: fiyat değişikliği)
        this.showNotification({
            title: 'İlan Güncellendi',
            body: `"${listing.title}" ilanınız güncellendi`,
            icon: 'fas fa-info-circle',
            color: 'info'
        });
    }

    // Bildirim göster
    showNotification({ title, body, icon, color = 'primary', action = null }) {
        // Toast bildirimi oluştur
        const notification = document.createElement('div');
        notification.className = `realtime-notification ${color}`;
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="${icon}"></i>
            </div>
            <div class="notification-content">
                <h4>${title}</h4>
                <p>${body}</p>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Style
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: white;
            padding: 1rem;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 1rem;
            min-width: 320px;
            max-width: 400px;
            z-index: 10001;
            animation: slideInRight 0.3s ease;
            cursor: pointer;
            border-left: 4px solid var(--${color});
        `;

        document.body.appendChild(notification);

        // Tıklama ile aksiyon
        if (action) {
            notification.addEventListener('click', (e) => {
                if (!e.target.closest('.notification-close')) {
                    action();
                }
            });
        }

        // Kapat butonu
        notification.querySelector('.notification-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeNotification(notification);
        });

        }, 5000);
    }

    closeNotification(notification) {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }

    // Bildirim sayısını güncelle
    updateBadge() {
        const badges = document.querySelectorAll('.notification-badge');
        badges.forEach(badge => {
            if (badge.closest('#notificationBtn') || badge.closest('.mobile-notification-toggle')) {
                badge.textContent = this.notificationCount;
                badge.style.display = this.notificationCount > 0 ? 'flex' : 'none';
            }
        });
    }

    // Bildirim sesi çal
    playNotificationSound() {
        // Basit beep sesi (Web Audio API ile)
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    }

    // Kullanıcının ilan ID'lerini al (favoriler için)
    async getUserListingIds() {
        const { data, error } = await supabase
            .from('listings')
            .select('id')
            .eq('user_id', this.user.id);

        if (error) return '';
        return data.map(l => l.id).join(',') || '0';
    }

    // Temizlik
    cleanup() {
        this.channels.forEach(channel => {
            supabase.removeChannel(channel);
        });
        this.channels = [];
    }
}

// Global instance
const realtimeNotifications = new RealtimeNotifications();

// Sayfa yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', async () => {
    // Kullanıcı girişi varsa realtime'ı başlat
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        await realtimeNotifications.initialize();
    }
});

// Sayfa kapanırken temizle
window.addEventListener('beforeunload', () => {
    realtimeNotifications.cleanup();
});

// CSS animasyonları ekle
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }

    .realtime-notification {
        font-family: 'Inter', sans-serif;
    }

    .realtime-notification .notification-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
        flex-shrink: 0;
    }

    .realtime-notification.primary .notification-icon {
        background: var(--primary-light, #e6f7f1);
        color: var(--primary, #10b981);
    }

    .realtime-notification.danger .notification-icon {
        background: #fee;
        color: #ef4444;
    }

    .realtime-notification.info .notification-icon {
        background: #eff6ff;
        color: #3b82f6;
    }

    .realtime-notification .notification-content h4 {
        margin: 0 0 0.25rem 0;
        font-size: 0.95rem;
        font-weight: 600;
        color: #1f2937;
    }

    .realtime-notification .notification-content p {
        margin: 0;
        font-size: 0.85rem;
        color: #6b7280;
    }

    .realtime-notification .notification-close {
        background: none;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        padding: 0.25rem;
        margin-left: auto;
        flex-shrink: 0;
        transition: color 0.2s;
    }

    .realtime-notification .notification-close:hover {
        color: #ef4444;
    }
`;
document.head.appendChild(style);

export default realtimeNotifications;
