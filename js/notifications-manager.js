import { supabase } from './supabase.js';

export async function loadNotificationPreferences() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not logged in');

        // Fetch from profiles table (source of truth for mobile parity)
        const { data, error } = await supabase
            .from('profiles')
            .select('consent_marketing, preferences')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        const prefs = data?.preferences || {};
        
        return {
            messages: prefs.messages ?? true,
            priceChanges: prefs.priceChanges ?? true,
            marketing: data?.consent_marketing ?? true
        };
    } catch (err) {
        console.error('Error loading notification preferences:', err);
        // Fallback to defaults
        return {
            messages: true,
            priceChanges: true,
            marketing: true
        };
    }
}

export async function updateNotificationPreference(key, value) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not logged in');

        if (key === 'marketing') {
            // Marketing is a direct column 'consent_marketing'
            const { error } = await supabase
                .from('profiles')
                .update({ consent_marketing: value })
                .eq('id', user.id);
            if (error) throw error;
        } else {
            // Other preferences use the RPC for atomicity
            const { error } = await supabase.rpc('update_user_preference', {
                key_name: key,
                key_value: value
            });
            if (error) throw error;
        }

        return { success: true };
    } catch (err) {
        console.error(`Error updating preference ${key}:`, err);
        return { success: false, error: err.message };
    }
}
