import { supabase } from './supabase.js';

let currentTab = 'received';
let receivedReviews = [];
let givenReviews = [];
let currentUser = null;

async function init() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            window.location.href = 'login.html?redirect=reviews.html';
            return;
        }
        currentUser = user;
        await fetchReviews();
    } catch (error) {
        console.error('Init error:', error);
    }
}

async function fetchReviews() {
    const listContainer = document.getElementById('reviewsList');
    listContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

    try {
        // Fetch matching the or filter from mobile
        const { data: allRatings, error: ratingsError } = await supabase
            .from('seller_ratings')
            .select('*')
            .or(`seller_id.eq.${currentUser.id},buyer_id.eq.${currentUser.id}`)
            .order('created_at', { ascending: false });

        if (ratingsError) throw ratingsError;

        if (!allRatings || allRatings.length === 0) {
            renderEmpty();
            updateStats([], []);
            return;
        }

        // Fetch profiles
        const userIds = [...new Set(allRatings.flatMap(r => [r.seller_id, r.buyer_id]))];
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        receivedReviews = allRatings
            .filter(r => r.seller_id === currentUser.id)
            .map(r => ({ ...r, profile: profileMap.get(r.buyer_id) }));
            
        givenReviews = allRatings
            .filter(r => r.buyer_id === currentUser.id)
            .map(r => ({ ...r, profile: profileMap.get(r.seller_id) }));

        updateStats(receivedReviews, givenReviews);
        renderReviews();

    } catch (error) {
        console.error('Fetch error:', error);
        listContainer.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle text-danger"></i><p>Error loading reviews: ${error.message}</p></div>`;
    }
}

function updateStats(received, given) {
    const totalReceived = document.getElementById('totalReceived');
    const avgRating = document.getElementById('avgRating');
    const tabReceived = document.getElementById('tabReceived');
    const tabGiven = document.getElementById('tabGiven');

    if (totalReceived) totalReceived.textContent = received.length;
    
    if (avgRating) {
        if (received.length > 0) {
            const sum = received.reduce((acc, curr) => acc + (curr.rating || 5), 0);
            avgRating.textContent = (sum / received.length).toFixed(1);
        } else {
            avgRating.textContent = '-';
        }
    }

    if (tabReceived) tabReceived.textContent = `Received (${received.length})`;
    if (tabGiven) tabGiven.textContent = `Given (${given.length})`;
}

function renderReviews() {
    const listContainer = document.getElementById('reviewsList');
    const reviews = currentTab === 'received' ? receivedReviews : givenReviews;

    if (reviews.length === 0) {
        renderEmpty();
        return;
    }

    listContainer.innerHTML = reviews.map(review => {
        const profile = review.profile;
        const name = profile?.full_name || (currentTab === 'received' ? 'Buyer' : 'Seller');
        const initials = name.charAt(0).toUpperCase();
        const date = new Date(review.created_at).toLocaleDateString('en-MT', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            starsHtml += `<i class="${i <= (review.rating || 5) ? 'fas' : 'far'} fa-star"></i>`;
        }

        return `
            <div class="review-card">
                <div class="review-header">
                    <div class="reviewer-info">
                        <p class="reviewer-name">${currentTab === 'received' ? 'From: ' : 'To: '}${name}</p>
                        <span class="review-date">${date}</span>
                    </div>
                    <div class="stars">
                        ${starsHtml}
                    </div>
                </div>
                <p class="review-comment">${review.comment || 'No comment.'}</p>
            </div>
        `;
    }).join('');
}

function renderEmpty() {
    const listContainer = document.getElementById('reviewsList');
    const msg = currentTab === 'received' 
        ? "You have no reviews yet." 
        : "You haven't given any reviews yet.";
    
    listContainer.innerHTML = `
        <div class="empty-state">
            <i class="far fa-star"></i>
            <p>${msg}</p>
        </div>
    `;
}

window.switchTab = function(tab) {
    currentTab = tab;
    document.getElementById('tabReceived').classList.toggle('active', tab === 'received');
    document.getElementById('tabGiven').classList.toggle('active', tab === 'given');
    renderReviews();
};

document.addEventListener('DOMContentLoaded', init);
