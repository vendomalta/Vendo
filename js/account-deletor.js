import { supabase } from './supabase.js';

/**
 * Handles account deletion process with confirmation and soft-delete logic.
 */
export async function initiateAccountDeletion() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showNotification('You must be logged in to delete your account.', 'error');
            return;
        }

        const confirm = await showConfirmDialog(
            'Delete Account?',
            'Are you sure you want to permanently delete your account? This will remove all your listings and profile data. This action cannot be undone.',
            'Delete Forever',
            'Cancel'
        );

        if (!confirm) return;

        // Show loading state
        const deleteBtn = document.getElementById('deleteAccountBtn');
        const originalContent = deleteBtn.innerHTML;
        deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
        deleteBtn.disabled = true;

        // 1. Mark account as deleted in profiles (Soft Delete)
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ 
                deleted_at: new Date().toISOString(),
                is_active: false 
            })
            .eq('id', user.id);

        if (profileError) throw profileError;

        // 2. Optional: Mark listings as deleted or hidden
        const { error: listingError } = await supabase
            .from('listings')
            .update({ status: 'deleted' })
            .eq('user_id', user.id);

        if (listingError) {
            console.warn('Error marking listings as deleted:', listingError);
            // We continue anyway as the profile is the source of truth
        }

        // 3. Log out the user
        await supabase.auth.signOut();

        showNotification('Your account has been successfully deleted.', 'success');

        // Redirect to home after a short delay
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);

    } catch (error) {
        console.error('Account deletion error:', error);
        showNotification(error.message || 'An error occurred while deleting your account.', 'error');
        
        const deleteBtn = document.getElementById('deleteAccountBtn');
        if (deleteBtn) {
            deleteBtn.innerHTML = '<i class="fas fa-user-slash"></i> Delete Account';
            deleteBtn.disabled = false;
        }
    }
}

/**
 * Helper to show a stylized confirmation dialog using VENDO UI patterns.
 */
function showConfirmDialog(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
    return new Promise((resolve) => {
        // Create modal backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
            opacity: 0; transition: opacity 0.3s ease;
        `;

        // Create modal content
        const modal = document.createElement('div');
        modal.className = 'confirm-modal';
        modal.style.cssText = `
            background: white; padding: 24px; border-radius: 12px;
            width: 90%; max-width: 400px; transform: scale(0.9);
            transition: transform 0.3s ease;
        `;

        modal.innerHTML = `
            <h3 style="margin-top: 0; color: #1e293b;">${title}</h3>
            <p style="color: #64748b; line-height: 1.5; margin: 16px 0 24px;">${message}</p>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button class="btn-secondary" id="confirmCancel" style="padding: 8px 16px;">${cancelText}</button>
                <button class="btn-danger" id="confirmOk" style="padding: 8px 16px;">${confirmText}</button>
            </div>
        `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        // Force reflow
        backdrop.offsetHeight;
        backdrop.style.opacity = '1';
        modal.style.transform = 'scale(1)';

        const cleanup = (result) => {
            backdrop.style.opacity = '0';
            modal.style.transform = 'scale(0.9)';
            setTimeout(() => {
                document.body.removeChild(backdrop);
                resolve(result);
            }, 300);
        };

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) cleanup(false);
        });

        document.getElementById('confirmCancel').onclick = () => cleanup(false);
        document.getElementById('confirmOk').onclick = () => cleanup(true);
    });
}
