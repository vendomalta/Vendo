// Soru-Cevap Sistemi - İlan Detay Sayfası
import { supabase } from './supabase.js';
import { listingLimiter } from './rate-limiter.js';

let currentListingId = null;
let currentListingOwnerId = null;
let currentUser = null;

/**
 * Soru-Cevap bölümünü başlat
 * @param {string} listingId - İlan ID'si
 * @param {string} listingOwnerId - İlan sahibi ID'si
 */
export async function initQASection(listingId, listingOwnerId) {
    currentListingId = listingId;
    currentListingOwnerId = listingOwnerId;

    // Kullanıcı bilgisini al
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;

    // Soruları yükle
    await loadQuestions();

    // Event listener'ları ekle
    setupEventListeners();

    // Realtime güncellemeleri dinle
    subscribeToUpdates();
}

/**
 * Event listener'ları kur
 */
function setupEventListeners() {
    // =============================================
    // DESKTOP: Ask form toggle (uses -desktop IDs)
    // =============================================
    const askBtnD = document.getElementById('qa-ask-btn-desktop');
    const askFormD = document.getElementById('qa-ask-form-desktop');
    const cancelBtnD = document.getElementById('qa-cancel-ask-desktop');
    const submitBtnD = document.getElementById('qa-submit-question-desktop');
    const inputD = document.getElementById('qa-question-input-desktop');
    const charCountD = document.getElementById('qa-char-count-desktop');

    if (askBtnD) {
        askBtnD.addEventListener('click', () => {
            if (!currentUser) {
                showToast('You must sign in to ask a question', 'warn');
                window.location.href = 'login.html';
                return;
            }
            if (askFormD) askFormD.style.display = 'block';
            askBtnD.style.display = 'none';
            if (inputD) inputD.focus();
        });
    }

    if (cancelBtnD) {
        cancelBtnD.addEventListener('click', () => {
            if (askFormD) askFormD.style.display = 'none';
            if (askBtnD) askBtnD.style.display = 'flex';
            if (inputD) inputD.value = '';
        });
    }

    if (submitBtnD) {
        submitBtnD.addEventListener('click', () => handleSubmitQuestion('desktop'));
    }

    if (inputD && charCountD) {
        inputD.addEventListener('input', () => {
            charCountD.textContent = `${inputD.value.length}/1000`;
        });
    }

    // =============================================
    // MOBILE: Direct textarea submit (uses original IDs)
    // =============================================
    const submitBtnM = document.getElementById('qa-submit-question');
    if (submitBtnM) {
        submitBtnM.addEventListener('click', () => handleSubmitQuestion('mobile'));
    }
}

/**
 * Soruları yükle ve görüntüle
 */
async function loadQuestions() {
    // Support both mobile (#qa-questions-list) and desktop (#qa-list-desktop) containers
    const mobileContainer = document.getElementById('qa-questions-list');
    const desktopContainer = document.getElementById('qa-list-desktop');
    const container = mobileContainer || desktopContainer; // primary target for loading state
    if (!container && !desktopContainer) return;

    const setHTML = (html) => {
        if (mobileContainer) mobileContainer.innerHTML = html;
        if (desktopContainer) desktopContainer.innerHTML = html;
    };

    try {
        if (container) container.innerHTML = '<div class="qa-loading"><i class="fas fa-spinner fa-spin"></i></div>';

        // Sorular ve cevap sayılarını direkt tablodan çek
        const { data: questions, error } = await supabase
            .from('listing_questions')
            .select('*')
            .eq('listing_id', currentListingId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!questions || questions.length === 0) {
            setHTML(`
                <div class="qa-empty-state">
                    <i class="fas fa-comments"></i>
                    <h3>No questions yet</h3>
                    <p>Be the first to ask a question about this listing!</p>
                </div>
            `);
            return;
        }

        // Her soru için kullanıcı bilgisi ve cevap sayısını ayrı çek
        const questionsWithData = await Promise.all(questions.map(async (q) => {
            // Kullanıcı bilgisi
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', q.user_id)
                .single();

            // Cevap sayısı
            const { count } = await supabase
                .from('listing_answers')
                .select('*', { count: 'exact', head: true })
                .eq('question_id', q.id);

            return {
                ...q,
                full_name: profile?.full_name || 'User',
                avatar_url: profile?.avatar_url,
                answer_count: count || 0
            };
        }));

        setHTML(questionsWithData.map(q => renderQuestion(q)).join(''));

        // Her soru için cevapları yükle
        for (const question of questionsWithData) {
            await loadAnswers(question.id);
        }

    } catch (error) {
        console.error('Error loading questions:', error);
        setHTML(`
            <div class="qa-empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Could not load questions</h3>
                <p>${error.message}</p>
            </div>
        `);
    }
}

/**
 * Soru HTML'i oluştur
 */
function renderQuestion(question) {
    const isOwner = currentUser && currentUser.id === question.user_id;
    const isListingOwner = currentUser && currentUser.id === currentListingOwnerId;
    const userName = question.full_name || 'User';
    const userInitial = userName.charAt(0).toUpperCase();
    const timeAgo = formatTimeAgo(question.created_at);

    return `
        <div class="qa-card-native" data-question-id="${question.id}">
            <div class="qa-item-header">
                <div class="qa-avatar-native">
                    ${question.avatar_url
            ? `<img src="${question.avatar_url}" alt="${userName}">`
            : `<div class="avatar-placeholder">${userInitial}</div>`
        }
                </div>
                <div class="qa-meta-native">
                    <div class="user-name-native">${escapeHtml(userName)}</div>
                    <div class="item-time-native">
                        ${timeAgo}
                        ${question.is_edited ? '<span class="qa-edited-badge">(edited)</span>' : ''}
                    </div>
                </div>
            </div>
            <div class="qa-text-native" id="question-text-${question.id}">${escapeHtml(question.question_text)}</div>
            
            <div class="qa-toolbar-native">
                ${isListingOwner ? `
                    <button class="qa-action-native reply" onclick="window.qaShowAnswerForm('${question.id}')">
                        <i class="fas fa-reply"></i>
                        Reply
                    </button>
                ` : ''}
                ${isOwner ? `
                    <button class="qa-action-native" onclick="window.qaEditQuestion('${question.id}')">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    <button class="qa-action-native delete" onclick="window.qaDeleteQuestion('${question.id}')">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                ` : ''}
                <span class="qa-answer-count" style="margin-left: auto; font-size: 11px; color: #94a3b8;">
                    ${question.answer_count || 0} answers
                </span>
            </div>

            <div class="qa-answers-section" id="answers-section-${question.id}" style="display: none;">
                <div class="qa-answers-list" id="answers-list-${question.id}"></div>
                
                <!-- Reply Form -->
                <div class="inline-edit-native" id="answer-form-${question.id}" style="display: none;">
                    <textarea class="inline-input-native" placeholder="Type your answer..." maxlength="1000" id="answer-input-${question.id}"></textarea>
                    <div class="inline-actions-native">
                        <button class="inline-btn-native cancel" onclick="window.qaHideAnswerForm('${question.id}')">Cancel</button>
                        <button class="inline-btn-native save" onclick="window.qaSubmitAnswer('${question.id}')">Send</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Cevapları yükle
 */
async function loadAnswers(questionId) {
    try {
        // Cevapları direkt tablodan çek
        const { data: answers, error } = await supabase
            .from('listing_answers')
            .select('*')
            .eq('question_id', questionId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (answers && answers.length > 0) {
            // Her cevap için kullanıcı bilgisini ayrı çek
            const answersWithProfiles = await Promise.all(answers.map(async (a) => {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url')
                    .eq('id', a.user_id)
                    .single();

                return {
                    ...a,
                    full_name: profile?.full_name || 'User',
                    avatar_url: profile?.avatar_url
                };
            }));

            const answersList = document.getElementById(`answers-list-${questionId}`);
            const answersSection = document.getElementById(`answers-section-${questionId}`);

            if (answersList) {
                answersList.innerHTML = answersWithProfiles.map(a => renderAnswer(a, questionId)).join('');
                answersSection.style.display = 'block';
            }
        }

    } catch (error) {
        console.error('Cevaplar yüklenirken hata:', error);
    }
}

/**
 * Cevap HTML'i oluştur
 */
function renderAnswer(answer, questionId) {
    const isOwner = currentUser && currentUser.id === answer.user_id;
    const isListingOwner = answer.user_id === currentListingOwnerId;
    const userName = answer.full_name || 'User';
    const userInitial = userName.charAt(0).toUpperCase();
    const timeAgo = formatTimeAgo(answer.created_at);

    return `
        <div class="answer-row-native" data-answer-id="${answer.id}">
            <div class="answer-indicator-native"></div>
            <div class="answer-content-native">
                <div class="qa-item-header">
                    <div class="qa-avatar-native" style="width: 28px; height: 28px;">
                        ${answer.avatar_url
            ? `<img src="${answer.avatar_url}" alt="${userName}">`
            : `<div class="avatar-placeholder" style="font-size: 10px;">${userInitial}</div>`
        }
                    </div>
                    <div class="qa-meta-native">
                        <div class="user-name-native" style="font-size: 13px;">
                            ${escapeHtml(userName)}
                            ${isListingOwner ? '<span style="color: #10b981; font-size: 10px; margin-left: 4px;">(Seller)</span>' : ''}
                        </div>
                        <div class="item-time-native">${timeAgo}</div>
                    </div>
                </div>
                <div class="qa-text-native" id="answer-text-${answer.id}" style="font-size: 13px; margin-bottom: 8px;">
                    ${escapeHtml(answer.answer_text)}
                </div>
                ${isOwner ? `
                    <div class="qa-toolbar-native" style="padding-top: 5px; border: none;">
                        <button class="qa-action-native" onclick="window.qaEditAnswer('${answer.id}', '${questionId}')">
                            <i class="fas fa-edit"></i>
                            Edit
                        </button>
                        <button class="qa-action-native delete" onclick="window.qaDeleteAnswer('${answer.id}', '${questionId}')">
                            <i class="fas fa-trash"></i>
                            Delete
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Submit a question from either desktop or mobile view
 */
async function handleSubmitQuestion(source = 'mobile') {
    if (!currentUser) {
        showToast('You must sign in', 'warn');
        window.location.href = 'login.html';
        return;
    }

    // Read from the correct input based on which form triggered this
    const inputId = source === 'desktop' ? 'qa-question-input-desktop' : 'qa-question-input';
    const submitBtnId = source === 'desktop' ? 'qa-submit-question-desktop' : 'qa-submit-question';
    const resetFormId = source === 'desktop' ? 'qa-ask-form-desktop' : null;
    const resetBtnId = source === 'desktop' ? 'qa-ask-btn-desktop' : null;

    const input = document.getElementById(inputId);
    if (!input) return;
    const questionText = input.value.trim();

    // Rate Limit check
    if (listingLimiter.isLimited('user_' + currentUser.id)) {
        const minutes = listingLimiter.getLockTimeRemaining('user_' + currentUser.id);
        showToast(`Please wait ${minutes} minutes before asking again.`, 'warn');
        return;
    }

    if (questionText.length < 10) {
        showToast('Question must be at least 10 characters', 'warn');
        return;
    }

    if (questionText.length > 1000) {
        showToast('Question must be at most 1000 characters', 'warn');
        return;
    }

    const submitBtn = document.getElementById(submitBtnId);
    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        }

        listingLimiter.recordAttempt('user_' + currentUser.id);

        const { error } = await supabase
            .from('listing_questions')
            .insert([{
                listing_id: currentListingId,
                seller_id: currentListingOwnerId,
                user_id: currentUser.id,
                question_text: questionText
            }]);

        if (error) throw error;

        // Notification
        try {
            await supabase.from('notifications').insert([{
                user_id: currentListingOwnerId,
                type: 'general',
                title: 'New Question on your listing',
                message: `${currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Someone'} asked: ${questionText}`,
                related_listing_id: currentListingId
            }]);
        } catch (notificationError) {
            console.error('Failed to send question notification:', notificationError);
        }

        // Reset form
        input.value = '';
        if (resetFormId) {
            const form = document.getElementById(resetFormId);
            if (form) form.style.display = 'none';
        }
        if (resetBtnId) {
            const btn = document.getElementById(resetBtnId);
            if (btn) btn.style.display = 'flex';
        }

        await loadQuestions();
        showToast('Your question has been sent', 'success');

    } catch (error) {
        console.error('Error submitting question:', error);
        showToast('Could not send question: ' + error.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = source === 'desktop'
                ? '<i class="fas fa-paper-plane"></i> Submit'
                : '<i class="fas fa-paper-plane"></i>';
        }
    }
}

/**
 * Show answer form
 */
window.qaShowAnswerForm = (questionId) => {
    if (!currentUser) {
        showToast('You must sign in to write an answer', 'warn');
        window.location.href = 'login.html';
        return;
    }

    const form = document.getElementById(`answer-form-${questionId}`);
    const section = document.getElementById(`answers-section-${questionId}`);

    if (form && section) {
        section.style.display = 'block';
        form.style.display = 'block';
        document.getElementById(`answer-input-${questionId}`).focus();
    }
};

/**
 * Cevap formunu gizle
 */
window.qaHideAnswerForm = (questionId) => {
    const form = document.getElementById(`answer-form-${questionId}`);
    if (form) {
        form.style.display = 'none';
        document.getElementById(`answer-input-${questionId}`).value = '';
    }
};

/**
 * Cevap gönder
 */
window.qaSubmitAnswer = async (questionId) => {
    if (!currentUser) {
        showToast('You must sign in', 'warn');
        return;
    }

    const input = document.getElementById(`answer-input-${questionId}`);
    const answerText = input.value.trim();

    if (answerText.length < 1) {
        showToast('Answer cannot be empty', 'warn');
        return;
    }

    if (listingLimiter.isLimited('user_' + currentUser.id)) {
        const minutes = listingLimiter.getLockTimeRemaining('user_' + currentUser.id);
        showToast(`Please wait ${minutes} minutes.`, 'warn');
        return;
    }

    if (answerText.length > 1000) {
        showToast('Answer must be at most 1000 characters', 'warn');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('listing_answers')
            .insert([{
                question_id: questionId,
                user_id: currentUser.id,
                answer_text: answerText
            }])
            .select()
            .single();

        if (error) throw error;

        // --- NOTIFICATION ---
        try {
            // Find question owner to notify
            const { data: qData } = await supabase
                .from('listing_questions')
                .select('user_id')
                .eq('id', questionId)
                .single();

            if (qData && qData.user_id !== currentUser.id) {
                await supabase.from('notifications').insert([{
                    user_id: qData.user_id,
                    type: 'general',
                    title: 'Question Answered',
                    message: `${currentUser.id === currentListingOwnerId ? 'The seller' : 'Someone'} replied to your question: ${answerText.substring(0, 50)}${answerText.length > 50 ? '...' : ''}`,
                    related_listing_id: currentListingId
                    // related_conversation_id? no, Q&A is public but notification is personal
                }]);
            }
        } catch (notificationError) {
            console.error('Failed to send answer notification:', notificationError);
        }
        // --------------------

        // Formu temizle ve gizle
        input.value = '';
        window.qaHideAnswerForm(questionId);

        // Cevapları yeniden yükle
        await loadAnswers(questionId);

        // Cevap sayısını güncelle
        const countEl = document.getElementById(`answer-count-${questionId}`);
        if (countEl) {
            countEl.textContent = parseInt(countEl.textContent) + 1;
        }

        // Cevap sayısını güncelle...
        showToast('Your answer has been sent', 'success');

    } catch (error) {
        console.error('Cevap gönderilirken hata:', error);
        showToast('Could not send answer: ' + error.message, 'error');
    }
};

/**
 * Soruyu düzenle
 */
window.qaEditQuestion = async (questionId) => {
    const textEl = document.getElementById(`question-text-${questionId}`);
    const currentText = textEl.textContent;

    const newText = await VendoPrompt('Edit your question:', currentText);

    if (newText === null || newText.trim() === currentText) return;

    if (newText.trim().length < 5 || newText.trim().length > 1000) {
        showToast('Question must be between 5-1000 characters', 'warn');
        return;
    }

    try {
        const { error } = await supabase
            .from('listing_questions')
            .update({
                question_text: newText.trim(),
                is_edited: true
            })
            .eq('id', questionId);

        if (error) throw error;

        await loadQuestions();
        showToast('Question updated', 'success');

    } catch (error) {
        console.error('Soru güncellenirken hata:', error);
        showToast('Could not update question: ' + error.message, 'error');
    }
};

/**
 * Soruyu sil
 */
window.qaDeleteQuestion = async (questionId) => {
    const confirmed = await VendoConfirm('Are you sure you want to delete this question and all its answers?', 'Delete Question');
    if (!confirmed) return;

    try {
        const { error } = await supabase
            .from('listing_questions')
            .delete()
            .eq('id', questionId);

        if (error) throw error;

        await loadQuestions();
        showToast('Question deleted', 'success');

    } catch (error) {
        console.error('Soru silinirken hata:', error);
        showToast('Could not delete question: ' + error.message, 'error');
    }
};

/**
 * Cevabı düzenle
 */
window.qaEditAnswer = async (answerId, questionId) => {
    const textEl = document.getElementById(`answer-text-${answerId}`);
    const currentText = textEl.textContent;

    const newText = await VendoPrompt('Edit your answer:', currentText);

    if (newText === null || newText.trim() === currentText) return;

    if (newText.trim().length < 1 || newText.trim().length > 1000) {
        showToast('Answer must be between 1-1000 characters', 'warn');
        return;
    }

    try {
        const { error } = await supabase
            .from('listing_answers')
            .update({
                answer_text: newText.trim(),
                is_edited: true
            })
            .eq('id', answerId);

        if (error) throw error;

        await loadAnswers(questionId);
        showToast('Answer updated', 'success');

    } catch (error) {
        console.error('Cevap güncellenirken hata:', error);
        showToast('Could not update answer: ' + error.message, 'error');
    }
};

/**
 * Cevabı sil
 */
window.qaDeleteAnswer = async (answerId, questionId) => {
    const confirmed = await VendoConfirm('Are you sure you want to delete this answer?', 'Delete Answer');
    if (!confirmed) return;

    try {
        const { error } = await supabase
            .from('listing_answers')
            .delete()
            .eq('id', answerId);

        if (error) throw error;

        await loadAnswers(questionId);
        showToast('Answer deleted', 'success');

    } catch (error) {
        console.error('Cevap silinirken hata:', error);
        showToast('Could not delete answer: ' + error.message, 'error');
    }
};

/**
 * Realtime güncellemeleri dinle
 */
function subscribeToUpdates() {
    // Yeni sorular
    supabase
        .channel(`listing-questions-${currentListingId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'listing_questions',
            filter: `listing_id=eq.${currentListingId}`
        }, () => {
            loadQuestions();
        })
        .subscribe();

    // Yeni cevaplar
    supabase
        .channel(`listing-answers-${currentListingId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'listing_answers'
        }, () => {
            loadQuestions();
        })
        .subscribe();
}

/**
 * Yardımcı fonksiyonlar
 */
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-GB');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export { loadQuestions };
