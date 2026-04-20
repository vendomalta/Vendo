import { supabase } from './supabase.js';

const DEFAULT_AVATAR_URL = 'assets/images/default-avatar.svg';

document.addEventListener('DOMContentLoaded', async () => {
    const listContainer = document.getElementById('blockedUsersList');
    const totalBlockedEl = document.getElementById('totalBlocked');

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    async function fetchBlockedUsers() {
        try {
            // 1. Get block records
            const { data: blocks, error: blockError } = await supabase
                .from('blocked_users')
                .select('id, blocked_id, created_at')
                .eq('blocker_id', user.id)
                .order('created_at', { ascending: false });

            if (blockError) throw blockError;

            totalBlockedEl.textContent = blocks.length;

            if (blocks.length === 0) {
                renderEmptyState();
                return;
            }

            // 2. Fetch profiles
            const blockedIds = blocks.map(b => b.blocked_id);
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, email')
                .in('id', blockedIds);

            if (profileError) throw profileError;

            const profileMap = new Map((profiles || []).map(p => [p.id, p]));
            
            renderList(blocks, profileMap);

        } catch (err) {
            console.error('Error fetching blocked users:', err);
            listContainer.innerHTML = `<div class="empty-state"><p style="color:red">Error loading blocked users: ${err.message}</p></div>`;
        }
    }

    function renderList(blocks, profileMap) {
        listContainer.innerHTML = '';
        
        blocks.forEach(block => {
            const profile = profileMap.get(block.blocked_id);
            const name = profile?.full_name || profile?.email || 'Unknown User';
            const avatar = profile?.avatar_url || DEFAULT_AVATAR_URL;
            const date = new Date(block.created_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric'
            });

            const item = document.createElement('div');
            item.className = 'blocked-user-item';
            item.innerHTML = `
                <div class="user-avatar-container">
                    <img src="${avatar}" class="user-avatar-img" alt="${name}">
                </div>
                <div class="user-details">
                    <div class="user-name">${name}</div>
                    <div class="block-date">
                        <i class="far fa-calendar-alt"></i>
                        Blocked on ${date}
                    </div>
                </div>
                <button class="unblock-btn" data-id="${block.id}" data-name="${name}">
                    Unblock
                </button>
            `;
            listContainer.appendChild(item);
        });

        // Add event listeners for unblock buttons
        document.querySelectorAll('.unblock-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const blockId = btn.getAttribute('data-id');
                const userName = btn.getAttribute('data-name');
                
                const confirmed = await showConfirmDialog(`Are you sure you want to unblock ${userName}?`, 'Unblock', 'Cancel');
                if (confirmed) {
                    await unblockUser(blockId, btn);
                }
            });
        });
    }

    async function unblockUser(blockId, btn) {
        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            const { error } = await supabase
                .from('blocked_users')
                .delete()
                .eq('id', blockId);

            if (error) throw error;

            // Show success notification
            showToast('User has been unblocked successfully.', 'success', 'Unblocked');

            // Refresh list
            await fetchBlockedUsers();

        } catch (err) {
            showToast('Error unblocking user: ' + err.message, 'error', 'Error');
            btn.disabled = false;
            btn.innerHTML = 'Unblock';
        }
    }

    function renderEmptyState() {
        listContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-shield-alt"></i>
                </div>
                <div class="empty-title">Your Block List is Empty</div>
                <div class="empty-text">Users you block will appear here. They won't be able to message you or see your listings.</div>
            </div>
        `;
    }

    // Initial fetch
    fetchBlockedUsers();
});
