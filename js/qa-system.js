// Soru-Cevap Sistemi - İlan Detay Sayfası
import { supabase } from './supabase.js';

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
    // Soru sorma formu göster/gizle
    const askBtn = document.getElementById('qa-ask-btn');
    const askForm = document.getElementById('qa-ask-form');
    const cancelAskBtn = document.getElementById('qa-cancel-ask');

    if (askBtn) {
        askBtn.addEventListener('click', () => {
            if (!currentUser) {
                if (typeof showNotification === 'function') {
                    showNotification('Soru sormak için giriş yapmalısınız', 'warning');
                } else if (typeof showInlineToast === 'function') {
                    showInlineToast('Soru sormak için giriş yapmalısınız', 'warning');
                } else {
                    console.warn('Soru sormak için giriş yapmalısınız');
                }
                window.location.href = 'login.html';
                return;
            }
            askForm.style.display = 'block';
            askBtn.style.display = 'none';
            document.getElementById('qa-question-input').focus();
        });
    }

    if (cancelAskBtn) {
        cancelAskBtn.addEventListener('click', () => {
            askForm.style.display = 'none';
            askBtn.style.display = 'flex';
            document.getElementById('qa-question-input').value = '';
        });
    }

    // Soru gönder
    const submitQuestionBtn = document.getElementById('qa-submit-question');
    if (submitQuestionBtn) {
        submitQuestionBtn.addEventListener('click', handleSubmitQuestion);
    }

    // Karakter sayacı
    const questionInput = document.getElementById('qa-question-input');
    if (questionInput) {
        questionInput.addEventListener('input', (e) => {
            const charCount = document.getElementById('qa-char-count');
            if (charCount) {
                charCount.textContent = `${e.target.value.length}/1000`;
            }
        });
    }
}

/**
 * Soruları yükle ve görüntüle
 */
async function loadQuestions() {
    const container = document.getElementById('qa-questions-list');
    if (!container) return;

    try {
        container.innerHTML = '<div class="qa-loading"><i class="fas fa-spinner fa-spin"></i></div>';

        // Sorular ve cevap sayılarını direkt tablodan çek
        const { data: questions, error } = await supabase
            .from('listing_questions')
            .select('*')
            .eq('listing_id', currentListingId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!questions || questions.length === 0) {
            container.innerHTML = `
                <div class="qa-empty-state">
                    <i class="fas fa-comments"></i>
                    <h3>Henüz soru sorulmamış</h3>
                    <p>Bu ilan hakkında ilk soruyu siz sorun!</p>
                </div>
            `;
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
                full_name: profile?.full_name || 'Kullanıcı',
                avatar_url: profile?.avatar_url,
                answer_count: count || 0
            };
        }));

        container.innerHTML = questionsWithData.map(q => renderQuestion(q)).join('');

        // Her soru için cevapları yükle
        for (const question of questionsWithData) {
            await loadAnswers(question.id);
        }

    } catch (error) {
        console.error('Sorular yüklenirken hata:', error);
        container.innerHTML = `
            <div class="qa-empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Sorular yüklenemedi</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

/**
 * Soru HTML'i oluştur
 */
function renderQuestion(question) {
    const isOwner = currentUser && currentUser.id === question.user_id;
    const userName = question.full_name || 'Kullanıcı';
    const userInitial = userName.charAt(0).toUpperCase();
    const timeAgo = formatTimeAgo(question.created_at);

    return `
        <div class="qa-question-card" data-question-id="${question.id}">
            <div class="qa-question-header">
                <div class="qa-user-avatar">
                    ${question.avatar_url
            ? `<img src="${question.avatar_url}" alt="${userName}">`
            : userInitial
        }
                </div>
                <div class="qa-question-meta">
                    <div class="qa-user-name">${escapeHtml(userName)}</div>
                    <div class="qa-question-time">
                        <i class="far fa-clock"></i>
                        ${timeAgo}
                        ${question.is_edited ? '<span class="qa-edited-badge">(düzenlendi)</span>' : ''}
                    </div>
                </div>
            </div>
            <div class="qa-question-text" id="question-text-${question.id}">${escapeHtml(question.question_text)}</div>
            <div class="qa-question-actions">
                <button class="qa-action-btn answer" onclick="window.qaShowAnswerForm('${question.id}')">
                    <i class="fas fa-reply"></i>
                    Cevapla
                </button>
                ${isOwner ? `
                    <button class="qa-action-btn edit" onclick="window.qaEditQuestion('${question.id}')">
                        <i class="fas fa-edit"></i>
                        Düzenle
                    </button>
                    <button class="qa-action-btn delete" onclick="window.qaDeleteQuestion('${question.id}')">
                        <i class="fas fa-trash"></i>
                        Sil
                    </button>
                ` : ''}
                <span class="qa-answer-count">
                    <i class="fas fa-comment"></i>
                    <span id="answer-count-${question.id}">${question.answer_count || 0}</span> cevap
                </span>
            </div>
            <div class="qa-answers-section" id="answers-section-${question.id}" style="display: none;">
                <div class="qa-answers-list" id="answers-list-${question.id}"></div>
                <div class="qa-answer-form" id="answer-form-${question.id}" style="display: none;">
                    <textarea placeholder="Cevabınızı yazın..." maxlength="1000" id="answer-input-${question.id}"></textarea>
                    <div class="form-actions">
                        <button class="btn-submit" onclick="window.qaSubmitAnswer('${question.id}')">
                            <i class="fas fa-paper-plane"></i>
                            Cevapla
                        </button>
                        <button class="btn-cancel" onclick="window.qaHideAnswerForm('${question.id}')">İptal</button>
                        <span class="char-count" id="answer-char-${question.id}">0/1000</span>
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
                    full_name: profile?.full_name || 'Kullanıcı',
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
    const userName = answer.full_name || 'Kullanıcı';
    const userInitial = userName.charAt(0).toUpperCase();
    const timeAgo = formatTimeAgo(answer.created_at);

    return `
        <div class="qa-answer-card ${isListingOwner ? 'owner-answer' : ''}" data-answer-id="${answer.id}">
            <div class="qa-answer-header">
                <div class="qa-answer-avatar">
                    ${answer.avatar_url
            ? `<img src="${answer.avatar_url}" alt="${userName}">`
            : userInitial
        }
                </div>
                <div class="qa-answer-meta">
                    <div class="qa-answer-user-name">
                        ${escapeHtml(userName)}
                        ${isListingOwner ? '<span class="qa-owner-badge">İlan Sahibi</span>' : ''}
                    </div>
                    <div class="qa-answer-time">
                        ${timeAgo}
                        ${answer.is_edited ? '<span class="qa-edited-badge">(düzenlendi)</span>' : ''}
                    </div>
                </div>
            </div>
            <div class="qa-answer-text" id="answer-text-${answer.id}">${escapeHtml(answer.answer_text)}</div>
            ${isOwner ? `
                <div class="qa-answer-actions">
                    <button class="qa-action-btn edit" onclick="window.qaEditAnswer('${answer.id}', '${questionId}')">
                        <i class="fas fa-edit"></i>
                        Düzenle
                    </button>
                    <button class="qa-action-btn delete" onclick="window.qaDeleteAnswer('${answer.id}', '${questionId}')">
                        <i class="fas fa-trash"></i>
                        Sil
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Soru gönder
 */
async function handleSubmitQuestion() {
    if (!currentUser) {
        if (typeof showNotification === 'function') {
            showNotification('Giriş yapmalısınız', 'warning');
        } else {
            alert('Giriş yapmalısınız');
        }
        return;
    }

    const input = document.getElementById('qa-question-input');
    const questionText = input.value.trim();

    if (questionText.length < 5) {
        if (typeof showNotification === 'function') {
            showNotification('Soru en az 5 karakter olmalıdır', 'warning');
        } else {
            alert('Soru en az 5 karakter olmalıdır');
        }
        return;
    }

    if (questionText.length > 1000) {
        if (typeof showNotification === 'function') {
            showNotification('Soru en fazla 1000 karakter olabilir', 'warning');
        } else {
            alert('Soru en fazla 1000 karakter olabilir');
        }
        return;
    }

    try {
        const submitBtn = document.getElementById('qa-submit-question');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gönderiliyor...';

        const { data, error } = await supabase
            .from('listing_questions')
            .insert([{
                listing_id: currentListingId,
                seller_id: currentListingOwnerId,
                user_id: currentUser.id,
                question_text: questionText
            }])
            .select()
            .single();

        if (error) throw error;

        // Formu temizle ve gizle
        input.value = '';
        document.getElementById('qa-ask-form').style.display = 'none';
        document.getElementById('qa-ask-btn').style.display = 'flex';

        // Soruları yeniden yükle
        await loadQuestions();

        if (typeof showNotification === 'function') {
            showNotification('Sorunuz gönderildi', 'success');
        }

    } catch (error) {
        console.error('Soru gönderilirken hata:', error);
        if (typeof showNotification === 'function') {
            showNotification('Soru gönderilemedi: ' + error.message, 'error');
        } else {
            alert('Soru gönderilemedi: ' + error.message);
        }
    } finally {
        const submitBtn = document.getElementById('qa-submit-question');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gönder';
    }
}

/**
 * Cevap formunu göster
 */
window.qaShowAnswerForm = (questionId) => {
    if (!currentUser) {
        if (typeof showNotification === 'function') {
            showNotification('Cevap yazmak için giriş yapmalısınız', 'warning');
        } else {
            alert('Cevap yazmak için giriş yapmalısınız');
        }
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
        if (typeof showNotification === 'function') {
            showNotification('Giriş yapmalısınız', 'warning');
        } else {
            alert('Giriş yapmalısınız');
        }
        return;
    }

    const input = document.getElementById(`answer-input-${questionId}`);
    const answerText = input.value.trim();

    if (answerText.length < 1) {
        if (typeof showNotification === 'function') {
            showNotification('Cevap boş olamaz', 'warning');
        } else {
            alert('Cevap boş olamaz');
        }
        return;
    }

    if (answerText.length > 1000) {
        if (typeof showNotification === 'function') {
            showNotification('Cevap en fazla 1000 karakter olabilir', 'warning');
        } else {
            alert('Cevap en fazla 1000 karakter olabilir');
        }
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

        if (typeof showNotification === 'function') {
            showNotification('Cevabınız gönderildi', 'success');
        }

    } catch (error) {
        console.error('Cevap gönderilirken hata:', error);
        if (typeof showNotification === 'function') {
            showNotification('Cevap gönderilemedi: ' + error.message, 'error');
        } else {
            alert('Cevap gönderilemedi: ' + error.message);
        }
    }
};

/**
 * Soruyu düzenle
 */
window.qaEditQuestion = async (questionId) => {
    const textEl = document.getElementById(`question-text-${questionId}`);
    const currentText = textEl.textContent;

    let newText;
    if (typeof showPromptDialog === 'function') {
        newText = await showPromptDialog('Sorunuzu düzenleyin:', currentText);
    } else {
        newText = prompt('Sorunuzu düzenleyin:', currentText);
    }

    if (newText === null || newText.trim() === currentText) return;

    if (newText.trim().length < 5 || newText.trim().length > 1000) {
        if (typeof showNotification === 'function') {
            showNotification('Soru 5-1000 karakter arasında olmalıdır', 'warning');
        } else {
            alert('Soru 5-1000 karakter arasında olmalıdır');
        }
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

        if (typeof showNotification === 'function') {
            showNotification('Soru güncellendi', 'success');
        }

    } catch (error) {
        console.error('Soru güncellenirken hata:', error);
        if (typeof showNotification === 'function') {
            showNotification('Soru güncellenemedi: ' + error.message, 'error');
        } else {
            alert('Soru güncellenemedi: ' + error.message);
        }
    }
};

/**
 * Soruyu sil
 */
window.qaDeleteQuestion = async (questionId) => {
    let confirmed = false;
    if (typeof showConfirmDialog === 'function') {
        confirmed = await showConfirmDialog('Bu soruyu ve tüm cevaplarını silmek istediğinize emin misiniz?', 'Sil', 'İptal');
    } else {
        confirmed = confirm('Bu soruyu ve tüm cevaplarını silmek istediğinize emin misiniz?');
    }

    if (!confirmed) return;

    try {
        const { error } = await supabase
            .from('listing_questions')
            .delete()
            .eq('id', questionId);

        if (error) throw error;

        await loadQuestions();

        if (typeof showNotification === 'function') {
            showNotification('Soru silindi', 'success');
        }

    } catch (error) {
        console.error('Soru silinirken hata:', error);
        if (typeof showNotification === 'function') {
            showNotification('Soru silinemedi: ' + error.message, 'error');
        } else {
            alert('Soru silinemedi: ' + error.message);
        }
    }
};

/**
 * Cevabı düzenle
 */
window.qaEditAnswer = async (answerId, questionId) => {
    const textEl = document.getElementById(`answer-text-${answerId}`);
    const currentText = textEl.textContent;

    let newText;
    if (typeof showPromptDialog === 'function') {
        newText = await showPromptDialog('Cevabınızı düzenleyin:', currentText);
    } else {
        newText = prompt('Cevabınızı düzenleyin:', currentText);
    }

    if (newText === null || newText.trim() === currentText) return;

    if (newText.trim().length < 1 || newText.trim().length > 1000) {
        if (typeof showNotification === 'function') {
            showNotification('Cevap 1-1000 karakter arasında olmalıdır', 'warning');
        } else {
            alert('Cevap 1-1000 karakter arasında olmalıdır');
        }
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

        if (typeof showNotification === 'function') {
            showNotification('Cevap güncellendi', 'success');
        }

    } catch (error) {
        console.error('Cevap güncellenirken hata:', error);
        if (typeof showNotification === 'function') {
            showNotification('Cevap güncellenemedi: ' + error.message, 'error');
        } else {
            alert('Cevap güncellenemedi: ' + error.message);
        }
    }
};

/**
 * Cevabı sil
 */
window.qaDeleteAnswer = async (answerId, questionId) => {
    let confirmed = false;
    if (typeof showConfirmDialog === 'function') {
        confirmed = await showConfirmDialog('Bu cevabı silmek istediğinize emin misiniz?', 'Sil', 'İptal');
    } else {
        confirmed = confirm('Bu cevabı silmek istediğinize emin misiniz?');
    }

    if (!confirmed) return;

    try {
        const { error } = await supabase
            .from('listing_answers')
            .delete()
            .eq('id', answerId);

        if (error) throw error;

        await loadAnswers(questionId);

        // Cevap sayısını güncelle
        const countEl = document.getElementById(`answer-count-${questionId}`);
        if (countEl) {
            countEl.textContent = parseInt(countEl.textContent) - 1;
        }

        if (typeof showNotification === 'function') {
            showNotification('Cevap silindi', 'success');
        }

    } catch (error) {
        console.error('Cevap silinirken hata:', error);
        if (typeof showNotification === 'function') {
            showNotification('Cevap silinemedi: ' + error.message, 'error');
        } else {
            alert('Cevap silinemedi: ' + error.message);
        }
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

    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dakika önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays < 7) return `${diffDays} gün önce`;

    return date.toLocaleDateString('tr-TR');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export { loadQuestions };
