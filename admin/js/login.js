// ============================================
// ADMIN LOGIN FUNCTIONALITY
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Check if already logged in as admin
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single();

        if (profile?.is_admin) {
            window.location.href = 'index.html';
            return;
        }
    }

    setupFormListener();
});

// Setup form listener
function setupFormListener() {
    const form = document.getElementById('admin-login-form');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorMsg = document.getElementById('error-message');
        
        // Clear error message
        errorMsg.classList.remove('show');
        
        try {
            // Login with Supabase
            const { data, error: loginError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (loginError) {
                showError('Email veya şifre hatalı');
                return;
            }

            // Check if user is admin
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('is_admin')
                .eq('id', data.user.id)
                .single();

            if (profileError || !profile?.is_admin) {
                await supabase.auth.signOut();
                showError('Bu hesabın admin erişimi yok');
                return;
            }

            // Success - redirect to admin panel
            window.location.href = 'index.html';

        } catch (error) {
            console.error('Login error:', error);
            showError('Giriş sırasında bir hata oluştu');
        }
    });
}

// Show error message
function showError(message) {
    const errorMsg = document.getElementById('error-message');
    errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    errorMsg.classList.add('show');
}

// Toggle password visibility
function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.querySelector('.toggle-password');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        passwordInput.type = 'password';
        toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
    }
}
