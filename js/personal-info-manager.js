import { supabase } from './supabase.js';

export async function loadPersonalInfo() {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            window.location.href = 'login.html';
            return;
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError) console.warn('Profile not found:', profileError);

        // Fill Form
        const metadata = user.user_metadata || {};
        const metaFirstName = metadata.first_name || metadata.given_name || metadata.full_name?.split(' ')[0] || '';
        const metaLastName = metadata.last_name || metadata.family_name || metadata.full_name?.split(' ').slice(1).join(' ') || '';

        const dbFirstName = profile?.first_name || profile?.full_name?.split(' ')[0] || '';
        const dbLastName = profile?.last_name || profile?.full_name?.split(' ').slice(1).join(' ') || '';

        // Phone Fallback Logic
        let displayPrefix = profile?.phone_prefix || metadata.phone_prefix || '';
        let displayPhone = profile?.phone_number || metadata.phone_number || '';

        // If prefix/number are empty, try to extract from 'phone' string (+356 12345678)
        if (!displayPrefix || !displayPhone) {
            const fullPhone = profile?.phone || metadata.phone || '';
            if (fullPhone.includes(' ')) {
                const parts = fullPhone.split(' ');
                if (!displayPrefix) displayPrefix = parts[0];
                if (!displayPhone) displayPhone = parts.slice(1).join('');
            } else if (fullPhone.startsWith('+') && !displayPrefix) {
                // Heuristic: assume first 4 chars might be prefix if it starts with + (e.g. +356...)
                displayPrefix = fullPhone.substring(0, 4);
                displayPhone = fullPhone.substring(4);
            }
        }

        document.getElementById('displayEmail').value = user.email || '';
        document.getElementById('firstName').value = dbFirstName || metaFirstName;
        document.getElementById('lastName').value = dbLastName || metaLastName;
        document.getElementById('phoneArea').value = displayPrefix || '+356';
        document.getElementById('phoneNumber').value = displayPhone || '';
        document.getElementById('cityText').textContent = profile?.city || 'Select city';
        document.getElementById('bio').value = profile?.bio || '';

        // Format and set birth date
        if (profile?.birth_date) {
            const [y, m, d] = profile.birth_date.split('-');
            document.getElementById('birthDate').value = `${d}/${m}/${y}`;
        }

        // Verification Status
        updateVerificationStatus('email', !!profile?.email_verified || !!user.email_confirmed_at);
        updateVerificationStatus('phone', !!profile?.phone_verified);
        updateVerificationStatus('identity', !!profile?.identity_verified);

    } catch (error) {
        console.error('Error loading personal info:', error);
    }
}

function updateVerificationStatus(type, isVerified) {
    const item = document.getElementById(`${type}VerifyItem`);
    if (!item) return;

    const icon = item.querySelector('.verify-icon');
    const text = item.querySelector('.verify-text');
    const action = item.querySelector('.verify-action');

    if (isVerified) {
        item.classList.remove('pending');
        icon.className = 'fas fa-check-circle verify-icon verified';
        text.textContent = `${type.charAt(0).toUpperCase() + type.slice(1)} Verified`;
        if (action) action.innerHTML = '<i class="fas fa-shield-check verified-shield"></i>';
    } else {
        item.classList.add('pending');
        icon.className = `fas fa-${type === 'email' ? 'envelope' : type === 'phone' ? 'mobile-alt' : 'id-card'} verify-icon`;
        text.textContent = `${type.charAt(0).toUpperCase() + type.slice(1)} Not Verified`;
    }
}

export async function updateProfile(formData) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'User not found' };

        const birthDateDisplay = formData.birthDate;
        let dbBirthDate = null;
        if (birthDateDisplay && birthDateDisplay.length === 10) {
            const [d, m, y] = birthDateDisplay.split('/');
            dbBirthDate = `${y}-${m}-${d}`;
        }

        const updates = {
            id: user.id,
            first_name: formData.firstName,
            last_name: formData.lastName,
            full_name: `${formData.firstName} ${formData.lastName}`.trim(),
            phone_prefix: formData.phoneArea,
            phone_number: formData.phoneNumber,
            phone: `${formData.phoneArea} ${formData.phoneNumber}`.trim(),
            birth_date: dbBirthDate,
            city: (formData.city === 'Select city' || formData.city === 'Select City') ? null : formData.city,
            bio: formData.bio,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('profiles').upsert(updates);
        if (error) throw error;

        await supabase.auth.refreshSession();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Verification Logic
export async function sendVerificationCode() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return { success: false, error: 'Email not found' };

    const { error } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: {
            shouldCreateUser: false
        }
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function verifyOTP(code) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return { success: false, error: 'Email not found' };

    const { error } = await supabase.auth.verifyOtp({
        email: user.email,
        token: code,
        type: 'email'
    });

    if (error) return { success: false, error: error.message };

    // Update profile verification status
    await supabase.from('profiles').update({ email_verified: true }).eq('id', user.id);
    return { success: true };
}
