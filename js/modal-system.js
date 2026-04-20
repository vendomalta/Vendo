/**
 * VENDO Premium Modal System
 * Provides replacements for alert(), confirm(), and prompt()
 */

const createModalOverlay = () => {
    let overlay = document.getElementById('vendo-modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'vendo-modal-overlay';
        overlay.className = 'vendo-modal-overlay';
        document.body.appendChild(overlay);
    }
    return overlay;
};

const createModalElement = (title, message, options = {}) => {
    const { type = 'alert', defaultValue = '', confirmText = 'Tamam', cancelText = 'İptal' } = options;
    
    const modal = document.createElement('div');
    modal.className = 'vendo-modal-container scale-in';
    
    let inputHtml = '';
    if (type === 'prompt') {
        inputHtml = `<div class="vendo-modal-input-wrapper">
            <input type="text" id="vendo-modal-input" class="vendo-modal-input" value="${defaultValue}" autocomplete="off">
        </div>`;
    }

    const cancelBtnHtml = (type === 'confirm' || type === 'prompt') 
        ? `<button class="vendo-modal-btn cancel">${cancelText}</button>` 
        : '';

    modal.innerHTML = `
        <div class="vendo-modal-content">
            ${title ? `<h3 class="vendo-modal-title">${title}</h3>` : ''}
            <div class="vendo-modal-message">${message}</div>
            ${inputHtml}
            <div class="vendo-modal-actions">
                ${cancelBtnHtml}
                <button class="vendo-modal-btn confirm">${confirmText}</button>
            </div>
        </div>
    `;

    return modal;
};

export const VendoAlert = (message, title = 'Bilgi') => {
    return new Promise((resolve) => {
        const overlay = createModalOverlay();
        const modal = createModalElement(title, message, { type: 'alert' });
        
        const cleanup = () => {
            modal.classList.add('scale-out');
            overlay.classList.remove('active');
            setTimeout(() => {
                modal.remove();
                resolve();
            }, 200);
        };

        modal.querySelector('.confirm').onclick = cleanup;
        
        overlay.innerHTML = '';
        overlay.appendChild(modal);
        overlay.classList.add('active');
    });
};

export const VendoConfirm = (message, title = 'Onay Gerekli', options = {}) => {
    return new Promise((resolve) => {
        const overlay = createModalOverlay();
        const modal = createModalElement(title, message, { 
            type: 'confirm', 
            confirmText: options.confirmText || 'Onayla',
            cancelText: options.cancelText || 'İptal'
        });
        
        const cleanup = (result) => {
            modal.classList.add('scale-out');
            overlay.classList.remove('active');
            setTimeout(() => {
                modal.remove();
                resolve(result);
            }, 200);
        };

        modal.querySelector('.confirm').onclick = () => cleanup(true);
        modal.querySelector('.cancel').onclick = () => cleanup(false);
        
        overlay.innerHTML = '';
        overlay.appendChild(modal);
        overlay.classList.add('active');
    });
};

export const VendoPrompt = (message, defaultValue = '', title = 'Giriş Yapın') => {
    return new Promise((resolve) => {
        const overlay = createModalOverlay();
        const modal = createModalElement(title, message, { type: 'prompt', defaultValue });
        const input = modal.querySelector('#vendo-modal-input');
        
        const cleanup = (result) => {
            modal.classList.add('scale-out');
            overlay.classList.remove('active');
            setTimeout(() => {
                modal.remove();
                resolve(result);
            }, 200);
        };

        modal.querySelector('.confirm').onclick = () => cleanup(input.value);
        modal.querySelector('.cancel').onclick = () => cleanup(null);
        
        overlay.innerHTML = '';
        overlay.appendChild(modal);
        overlay.classList.add('active');
        
        setTimeout(() => input.focus(), 50);
        
        input.onkeydown = (e) => {
            if (e.key === 'Enter') modal.querySelector('.confirm').click();
            if (e.key === 'Escape') modal.querySelector('.cancel').click();
        };
    });
};

// Global Exposure for easier migration (Optional but helpful)
window.VendoAlert = VendoAlert;
window.VendoConfirm = VendoConfirm;
window.VendoPrompt = VendoPrompt;
