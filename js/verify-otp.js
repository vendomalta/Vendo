import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    const otpInputs = document.querySelectorAll('.otp-input');
    const otpForm = document.getElementById('otpForm');
    const verifyBtn = document.getElementById('verifyBtn');
    const resendLink = document.getElementById('resendLink');
    const timerEl = document.getElementById('timer');
    const emailDisplay = document.getElementById('emailDisplay').querySelector('span');
    const errorMessage = document.getElementById('errorMessage');

    let timer = 120;
    let timerInterval;
    let isResending = false;

    // Focus first input
    otpInputs[0].focus();

    // Get current user session
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (!user || userError) {
        console.error('No authenticated user found');
        window.location.href = 'login.html';
        return;
    }

    emailDisplay.textContent = user.email;

    // Auto-send OTP on mount if not already sent (Supabase handles rate limiting)
    const initOTP = async () => {
        const { error } = await supabase.auth.signInWithOtp({
            email: user.email,
            options: { shouldCreateUser: false }
        });
        if (error) console.error('Error sending initial OTP:', error.message);
        startTimer();
    };

    const startTimer = () => {
        clearInterval(timerInterval);
        timer = 120;
        resendLink.classList.add('disabled');
        resendLink.innerHTML = `Resend in <span class="timer" id="timer">02:00</span>`;
        
        timerInterval = setInterval(() => {
            timer--;
            const mins = Math.floor(timer / 60);
            const secs = timer % 60;
            const timerStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            const timerSpan = document.getElementById('timer');
            if (timerSpan) timerSpan.textContent = timerStr;

            if (timer <= 0) {
                clearInterval(timerInterval);
                resendLink.classList.remove('disabled');
                resendLink.textContent = 'Resend Code';
            }
        }, 1000);
    };

    // OTP Input Logic
    otpInputs.forEach((input, index) => {
        // Handle input (for all platforms including mobile)
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            if (val) {
                input.classList.add('filled');
                if (index < otpInputs.length - 1) {
                    otpInputs[index + 1].focus();
                }
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace') {
                if (input.value === '' && index > 0) {
                    otpInputs[index - 1].focus();
                    otpInputs[index - 1].value = '';
                    otpInputs[index - 1].classList.remove('filled');
                } else {
                    input.value = '';
                    input.classList.remove('filled');
                }
            } else if (e.key === 'ArrowLeft' && index > 0) {
                otpInputs[index - 1].focus();
            } else if (e.key === 'ArrowRight' && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });

        // Handle paste
        input.addEventListener('paste', (e) => {
            const data = e.clipboardData.getData('text').trim();
            if (data.length === 6 && /^\d+$/.test(data)) {
                data.split('').forEach((char, i) => {
                    if (otpInputs[i]) {
                        otpInputs[i].value = char;
                        otpInputs[i].classList.add('filled');
                    }
                });
                otpInputs[5].focus();
            }
            e.preventDefault();
        });

        // Auto-select on focus
        input.addEventListener('focus', () => {
            input.select();
        });
    });

    // Verify OTP
    otpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = Array.from(otpInputs).map(i => i.value).join('');
        
        if (token.length !== 6) return;

        try {
            verifyBtn.disabled = true;
            verifyBtn.innerHTML = '<div class="loading-spinner"></div><span>Verifying...</span>';
            errorMessage.style.display = 'none';

            const { error } = await supabase.auth.verifyOtp({
                email: user.email,
                token: token,
                type: 'email'
            });

            if (error) throw error;

            // Success: Update Profile (SQL triggers should handle most, but explicit update for safety)
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ email_verified: true })
                .eq('id', user.id);

            if (profileError) console.warn('Profile direct update warning:', profileError.message);

            // Redirect based on URL params
            const params = new URLSearchParams(window.location.search);
            const redirect = params.get('redirect') || '/';
            const catId = params.get('catId');
            
            let finalUrl = redirect;
            if (catId) {
                finalUrl += (finalUrl.includes('?') ? '&' : '?') + `catId=${catId}`;
            }

            window.location.href = finalUrl;

        } catch (err) {
            console.error('Verification error:', err.message);
            errorMessage.style.display = 'block';
            otpInputs.forEach(i => {
                i.value = '';
                i.classList.remove('filled');
            });
            otpInputs[0].focus();
        } finally {
            verifyBtn.disabled = false;
            verifyBtn.innerHTML = '<span>Verify Account</span><i class="fas fa-arrow-right"></i>';
        }
    });

    // Resend Logic
    resendLink.addEventListener('click', async () => {
        if (timer > 0 || isResending) return;

        try {
            isResending = true;
            resendLink.textContent = 'Sending...';
            
            const { error } = await supabase.auth.signInWithOtp({
                email: user.email,
                options: { shouldCreateUser: false }
            });

            if (error) throw error;
            
            startTimer();
        } catch (err) {
            alert('Error resending code: ' + err.message);
            resendLink.textContent = 'Resend Code';
        } finally {
            isResending = false;
        }
    });

    // Start on load
    initOTP();
});
