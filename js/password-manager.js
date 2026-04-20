import { supabase } from './supabase.js';

/**
 * Validates a password against security requirements
 * @param {string} password 
 * @returns {object} Validation results
 */
export function validatePassword(password) {
    return {
        hasMinLength: password.length >= 8,
        hasUpper: /[A-Z]/.test(password),
        hasLower: /[a-z]/.test(password),
        hasNumber: /\d/.test(password),
        hasSpecial: /[^A-Za-z0-9]/.test(password)
    };
}

/**
 * Calculates password strength metrics
 * @param {object} validations Output from validatePassword
 */
export function getPasswordStrength(validations) {
    const countMet = Object.values(validations).filter(Boolean).length;
    const progress = (countMet / 5) * 100;
    
    let color = '#ef4444'; // Danger
    let text = 'Very Weak';
    
    if (progress === 0) {
        text = 'Very Weak';
    } else if (progress <= 40) {
        text = 'Weak';
        color = '#ef4444';
    } else if (progress <= 80) {
        text = 'Medium';
        color = '#fbbf24'; // Amber
    } else {
        text = 'Strong';
        color = '#10b981'; // Primary
    }
    
    return { countMet, progress, color, text };
}

/**
 * Handles the password update flow
 */
export async function updatePassword(currentPassword, newPassword) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not found');

        // 1. Re-authenticate to verify current password
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: currentPassword
        });

        if (signInError) {
            throw new Error('Current password is incorrect');
        }

        // 2. Update the password
        const { error: updateError } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (updateError) throw updateError;

        return { success: true };
    } catch (err) {
        console.error('Password update error:', err);
        return { success: false, error: err.message };
    }
}
