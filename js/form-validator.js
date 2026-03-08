/**
 * Form Doğrulama Yardımcıları
 * Canlı hata mesajları ve pattern doğrulaması
 */

export class FormValidator {
    constructor(formSelector) {
        this.form = document.querySelector(formSelector);
        this.errors = new Map();
        this.init();
    }

    init() {
        if (!this.form) return;

        // Tüm input/select/textarea'ya dinleyici ekle
        this.form.querySelectorAll('input, select, textarea').forEach(field => {
            field.addEventListener('blur', () => this.validateField(field));
            field.addEventListener('input', () => {
                // Input sırasında hata temizle
                const errorEl = this.getErrorElement(field);
                if (errorEl && field.value.trim()) {
                    errorEl.textContent = '';
                    errorEl.style.display = 'none';
                }
            });
        });
    }

    /**
     * Bir alanı doğrula
     */
    validateField(field) {
        const rules = this.getRulesForField(field);
        const errors = [];

        for (const rule of rules) {
            const error = rule(field.value);
            if (error) errors.push(error);
        }

        if (errors.length > 0) {
            this.setFieldError(field, errors[0]);
            return false;
        } else {
            this.clearFieldError(field);
            return true;
        }
    }

    /**
     * Alanın doğrulama kurallarını al
     */
    getRulesForField(field) {
        const rules = [];
        const name = field.name || field.id || '';
        const type = field.type || 'text';
        const required = field.hasAttribute('required');

        // Boş kontrol
        if (required) {
            rules.push(value => {
                if (!value || !value.trim()) {
                    return `${field.placeholder || name} zorunlu`;
                }
                return null;
            });
        }

        // Tür spesifik kurallar
        if (type === 'email') {
            rules.push(value => {
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    return 'Geçerli bir email girin';
                }
                return null;
            });
        }

        if (type === 'tel') {
            rules.push(value => {
                if (value && !/^[0-9+\-\s()]{10,}$/.test(value)) {
                    return 'Geçerli bir telefon numarası girin';
                }
                return null;
            });
        }

        if (type === 'number') {
            rules.push(value => {
                if (value && isNaN(value)) {
                    return 'Sayı girin';
                }
                return null;
            });
        }

        // Min/max kontrol
        if (field.hasAttribute('minlength')) {
            const min = parseInt(field.getAttribute('minlength'));
            rules.push(value => {
                if (value && value.length < min) {
                    return `En az ${min} karakter`;
                }
                return null;
            });
        }

        if (field.hasAttribute('maxlength')) {
            const max = parseInt(field.getAttribute('maxlength'));
            rules.push(value => {
                if (value && value.length > max) {
                    return `En fazla ${max} karakter`;
                }
                return null;
            });
        }

        // Custom pattern
        if (field.hasAttribute('pattern')) {
            const pattern = field.getAttribute('pattern');
            const title = field.getAttribute('title') || 'Geçerli format değil';
            rules.push(value => {
                if (value && !new RegExp(`^${pattern}$`).test(value)) {
                    return title;
                }
                return null;
            });
        }

        return rules;
    }

    /**
     * Tüm formu doğrula
     */
    validateAll() {
        if (!this.form) return true;
        const fields = Array.from(this.form.querySelectorAll('input, select, textarea'));
        let isValid = true;
        for (const field of fields) {
            if (!this.validateField(field)) {
                isValid = false;
            }
        }
        return isValid;
    }

    /**
     * Alan hatasını göster
     */
    setFieldError(field, message) {
        field.classList.add('has-error');
        const errorEl = this.getErrorElement(field);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
        this.errors.set(field.name || field.id, message);
    }

    /**
     * Alan hatasını temizle
     */
    clearFieldError(field) {
        field.classList.remove('has-error');
        const errorEl = this.getErrorElement(field);
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }
        this.errors.delete(field.name || field.id);
    }

    /**
     * Hata öğesini bul veya oluştur
     */
    getErrorElement(field) {
        let errorEl = field.nextElementSibling;
        if (!errorEl || !errorEl.classList.contains('field-error')) {
            errorEl = document.createElement('div');
            errorEl.className = 'field-error';
            field.parentNode.insertBefore(errorEl, field.nextSibling);
        }
        return errorEl;
    }

    /**
     * Tüm hataları al
     */
    getErrors() {
        return Object.fromEntries(this.errors);
    }

    /**
     * Hata var mı
     */
    hasErrors() {
        return this.errors.size > 0;
    }
}
