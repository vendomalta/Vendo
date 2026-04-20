/**
 * Report System - Handling listing reports
 */
import { supabase } from './supabase.js';

let currentListingId = null;
let currentSellerId = null;
let currentUser = null;

/**
 * Initializes the report system
 * @param {string} listingId 
 * @param {string} sellerId 
 */
export async function initReportSystem(listingId, sellerId) {
    currentListingId = listingId;
    currentSellerId = sellerId;
    
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;

    setupReportEventListeners();
}

function setupReportEventListeners() {
    const reportModal = document.getElementById('report-modal');
    const openReportBtns = document.querySelectorAll('.btn-report-open'); // We will add this class to buttons
    const closeBtn = document.getElementById('report-close-btn');
    const cancelBtn = document.getElementById('report-cancel-btn');
    const submitBtn = document.getElementById('report-submit-btn');

    openReportBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!currentUser) {
                if (typeof showNotification === 'function') {
                    showNotification('You must log in to report a listing', 'warning');
                } else {
                    alert('You must log in to report a listing');
                }
                window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
                return;
            }
            reportModal.classList.add('active');
        });
    });

    const closeModal = () => {
        reportModal.classList.remove('active');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (submitBtn) {
        submitBtn.addEventListener('click', handleReportSubmit);
    }

    // Close on overlay click
    reportModal.addEventListener('click', (e) => {
        if (e.target === reportModal) closeModal();
    });
}

async function handleReportSubmit() {
    const reason = document.getElementById('report-reason').value;
    const description = document.getElementById('report-description').value.trim();
    const submitBtn = document.getElementById('report-submit-btn');

    if (!reason) {
        if (typeof showNotification === 'function') showNotification('Please select a reason', 'warning');
        return;
    }

    if (description.length < 10) {
        if (typeof showNotification === 'function') showNotification('Please provide more description (min 10 chars)', 'warning');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

        const { error } = await supabase.from('reports').insert({
            reporter_id: currentUser.id,
            reported_id: currentSellerId,
            listing_id: currentListingId,
            report_type: 'listing',
            reason: reason,
            description: description,
            email: currentUser.email,
            status: 'pending'
        });

        if (error) throw error;

        if (typeof showNotification === 'function') {
            showNotification('Report submitted successfully. Thank you for helping keep our community safe.', 'success');
        } else {
            alert('Report submitted successfully.');
        }

        document.getElementById('report-modal').classList.remove('active');
        document.getElementById('report-description').value = '';
        document.getElementById('report-reason').value = '';

    } catch (error) {
        console.error('Report submission error:', error);
        if (typeof showNotification === 'function') {
            showNotification('Could not submit report: ' + error.message, 'error');
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit Report';
    }
}
