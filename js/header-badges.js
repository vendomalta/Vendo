import { supabase } from './supabase.js';

// Badge helper: set text or hide when count is zero
function setBadgeValue(element, count) {
    if (!element) return;

    if (!count || count < 1) {
        element.style.display = 'none';
        return;
    }

    element.textContent = count > 99 ? '99+' : count;
    element.style.display = 'flex';
}

async function getUnreadMessageCount(userId) {
    const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', userId)
        .eq('is_read', false);

    if (error) throw error;
    return count || 0;
}


async function getListingNotificationCount(userId) {
    const { data: listings, error } = await supabase
        .from('listings')
        .select('id')
        .eq('user_id', userId);

    if (error) throw error;

    const listingIds = listings?.map(l => l.id) || [];
    if (!listingIds.length) return 0;

    const { count, error: favError } = await supabase
        .from('favorites')
        .select('id', { count: 'exact', head: true })
        .in('listing_id', listingIds)
        .neq('user_id', userId);

    if (favError) throw favError;
    return count || 0;
}

async function refreshBadgesForUser(userId) {
    if (!userId) {
        hideAllBadges();
        return;
    }

    const [unreadMessages, listingAlerts] = await Promise.all([
        getUnreadMessageCount(userId),
        getListingNotificationCount(userId)
    ]);

    const messageBadge = document.querySelector('.header-actions a[href="mesajlar.html"] .notification-badge');
    const notificationBadge = document.querySelector('#notificationBtn .notification-badge');

    setBadgeValue(messageBadge, unreadMessages);
    setBadgeValue(notificationBadge, listingAlerts);
}

function hideAllBadges() {
    const badges = document.querySelectorAll('.header-actions .notification-badge');
    badges.forEach(badge => {
        badge.style.display = 'none';
    });
}

export async function syncHeaderBadges() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        await refreshBadgesForUser(user?.id);

        supabase.auth.onAuthStateChange((_event, session) => {
            refreshBadgesForUser(session?.user?.id);
        });

        // Mesajlar ikonu tıklandığında rozeti sıfırla
        const messagesLink = document.querySelector('.header-actions a[href="mesajlar.html"]');
        const messageBadge = messagesLink?.querySelector('.notification-badge');
        if (messagesLink && messageBadge && !messagesLink.dataset.listenerAttached) {
            messagesLink.addEventListener('click', () => {
                setBadgeValue(messageBadge, 0);
            });
            messagesLink.dataset.listenerAttached = 'true';
        }
    } catch (error) {
        console.error('Bildirim rozetleri güncellenemedi:', error);
        hideAllBadges();
    }
}
