// İlan Detay Sayfası Loader
import {
  getListing,
  getProfile,
  addToFavorites,
  removeFromFavorites,
  isFavorite,
} from "./api.js";
import { supabase } from "./supabase.js";

// SEO meta yardımcıları
function setOrCreateMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    if (attrs.name) el.setAttribute("name", attrs.name);
    if (attrs.property) el.setAttribute("property", attrs.property);
    document.head.appendChild(el);
  }
  if (attrs.content !== undefined) el.setAttribute("content", attrs.content);
}

function updateSeoMeta(listing) {
  if (!listing) return;
  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  const image = photos[0] || "https://vendomalta.com/assets/images/verde-logo-og.png";
  
  const listingNumber = listing.listing_number || listing.id;
  const canonicalUrl = `https://vendomalta.com/listing/${listingNumber}`;
  
  const formattedPrice = new Intl.NumberFormat("tr-TR").format(listing.price);
  const currency = listing.currency === "TL" ? "₺" : listing.currency;
  const priceText = `${formattedPrice} ${currency}`;
  const title = listing.title || "İlan";
  const location = listing.location_city ? ` • ${listing.location_city}` : "";
  const descRaw =
    listing.description || `${title}${location} — Price: ${priceText}`;
  const description = String(descRaw).slice(0, 160);

  // Title
  document.title = `${title} | ${priceText} • VENDO`;

  // Standard description
  setOrCreateMeta('meta[name="description"]', {
    name: "description",
    content: description,
  });

  // Open Graph
  setOrCreateMeta('meta[property="og:type"]', {
    property: "og:type",
    content: "article",
  });
  setOrCreateMeta('meta[property="og:title"]', {
    property: "og:title",
    content: `${title} | ${priceText}`,
  });
  setOrCreateMeta('meta[property="og:description"]', {
    property: "og:description",
    content: description,
  });
  setOrCreateMeta('meta[property="og:image"]', {
    property: "og:image",
    content: image,
  });
  setOrCreateMeta('meta[property="og:url"]', {
    property: "og:url",
    content: canonicalUrl,
  });

  // Twitter Card
  setOrCreateMeta('meta[name="twitter:card"]', {
    name: "twitter:card",
    content: "summary_large_image",
  });
  setOrCreateMeta('meta[name="twitter:title"]', {
    name: "twitter:title",
    content: `${title} | ${priceText}`,
  });
  setOrCreateMeta('meta[name="twitter:description"]', {
    name: "twitter:description",
    content: description,
  });
  setOrCreateMeta('meta[name="twitter:image"]', {
    name: "twitter:image",
    content: image,
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadListingDetail();
  await loadAdBanner();
});

let listingChannel = null;

function getNormalizedListingId(urlParams) {
  const rawId = (
    urlParams.get("id") ||
    urlParams.get("listing_id") ||
    urlParams.get("listingId") ||
    ""
  ).trim();
  if (
    !rawId ||
    rawId.toLowerCase() === "undefined" ||
    rawId.toLowerCase() === "null"
  ) {
    return null;
  }
  return rawId;
}

async function loadListingDetail() {
  // URL'den ilan ID'sini al
  const urlParams = new URLSearchParams(window.location.search);
  const listingId = getNormalizedListingId(urlParams);
  const mode = urlParams.get("mode");

  if (!listingId) {
    console.error("Invalid or missing listing ID value:", {
      rawId: urlParams.get("id"),
      listingIdParam: urlParams.get("listing_id") || urlParams.get("listingId"),
    });
    showError(
      "Invalid listing link. Please try again from a valid listing card.",
    );
    return;
  }

  try {
    const listing = await getListing(listingId);
    console.log("✅ Listing loaded:", listing);

    // Edit modunu kontrol et
    if (mode === "edit") {
      // Kullanıcı kendi ilanını mı düzenliyor kontrol et
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || user.id !== listing.user_id) {
        showError("You do not have permission to edit this listing");
        return;
      }
      renderEditForm(listing);
    } else {
      await renderListing(listing);
      updateSeoMeta(listing);
      initializeGallery(listing);
      subscribeListingRealtime(listing.id);

      // Soru-Cevap bölümünü başlat
      const { initQASection } = await import("./qa-system.js");
      await initQASection(listing.id, listing.user_id);

      // Raporlama sistemini başlat
      const { initReportSystem } = await import("./report-system.js");
      await initReportSystem(listing.id, listing.user_id);
    }
  } catch (error) {
    console.error("❌ Error loading listing detail:", error);
    
    let userMessage = "An error occurred while loading the listing";
    if (error.code === "PGRST116") {
      userMessage = "Listing not found or has been removed.";
    } else if (error.message) {
      userMessage = `Error: ${error.message}`;
    }
    
    showError(userMessage);
  }
}

async function renderListing(listing) {
  const isMobile = window.innerWidth <= 768;

  // 1. Breadcrumb (Desktop Only)
  if (!isMobile) renderBreadcrumb(listing);

  // 2. Format Price
  const formattedPrice = new Intl.NumberFormat("tr-TR", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(listing.price);
  const currency = "€";
  const priceText = `${formattedPrice} ${currency}`;

  // Update Prices
  const priceDesktop = document.getElementById("detail-price-desktop");
  const priceMobile = document.getElementById("detail-price-mobile");
  if (priceDesktop) priceDesktop.textContent = priceText;
  if (priceMobile) priceMobile.textContent = priceText;

  // 3. Title & Premium Badge
  const titleDesktop = document.getElementById("detail-title-desktop");
  const titleMobile = document.getElementById("detail-title-mobile");
  if (titleDesktop) titleDesktop.textContent = listing.title;
  if (titleMobile) titleMobile.textContent = listing.title;

  const premiumDesktop = document.querySelector(".header-actions-extra"); // Breadcrumb area
  const premiumMobile = document.getElementById("premium-badge-mobile");
  if (listing.is_premium || listing.premium) {
      if (premiumMobile) premiumMobile.innerHTML = '<span class="premium-badge">PREMIUM</span>';
      // In desktop, logic might differ but we can add badge to title
      if (titleDesktop) titleDesktop.innerHTML += ' <span class="premium-badge">PREMIUM</span>';
  }

  // 4. Meta Row (Mobile Only)
  const locMobile = document.getElementById("detail-location-mobile");
  const postMobile = document.getElementById("detail-posted-mobile");
  if (locMobile) locMobile.textContent = listing.location_city || "Not specified";
  if (postMobile) postMobile.textContent = formatDateRelative(listing.created_at);

  // 5. Seller Profile
  try {
    const sellerProfile = await getProfile(listing.user_id);
    const sellerNameD = document.getElementById("seller-name-desktop");
    const sellerAvatarD = document.getElementById("seller-avatar-desktop");
    const sellerMemberD = document.getElementById("seller-member-since-desktop");
    
    const sellerNameM = document.getElementById("seller-name-mobile");
    const sellerAvatarM = document.getElementById("seller-avatar-mobile");
    const sellerMemberM = document.getElementById("seller-member-mobile");

    const fullName = sellerProfile.full_name || sellerProfile.username || "Seller";
    const memberSince = sellerProfile.created_at ? `Member since ${new Date(sellerProfile.created_at).getFullYear()}` : "New Member";

    if (sellerNameD) sellerNameD.textContent = fullName;
    if (sellerAvatarD && sellerProfile.avatar_url) sellerAvatarD.src = sellerProfile.avatar_url;
    if (sellerMemberD) sellerMemberD.textContent = memberSince;

    if (sellerNameM) sellerNameM.textContent = fullName;
    if (sellerAvatarM && sellerProfile.avatar_url) sellerAvatarM.src = sellerProfile.avatar_url;
    if (sellerMemberM) sellerMemberM.textContent = memberSince;

    // Seller action wiring
    const sellerTriggerM = document.getElementById("seller-card-mobile-trigger");
    if (sellerTriggerM) sellerTriggerM.onclick = () => window.location.href = `seller-profile.html?id=${listing.user_id}`;
    
    if (sellerNameD) sellerNameD.onclick = () => window.location.href = `seller-profile.html?id=${listing.user_id}`;
  } catch (err) { console.error("Seller profile err:", err); }

  // 6. Specs Table (Desktop) & Specs List (Mobile)
  const specsTableD = document.getElementById("specs-table-desktop");
  const specsListM = document.getElementById("specs-list-mobile");
  const specsData = buildSpecsTableData(listing); // Array of [key, val]

  if (specsTableD) {
      specsTableD.innerHTML = specsData.map(row => `
        <div class="spec-row">
            <span class="spec-label">${row[0]}</span>
            <span class="spec-value">${row[1]}</span>
        </div>
      `).join('');
  }

  if (specsListM) {
      specsListM.innerHTML = specsData.map(row => `
        <div class="spec-row-native">
            <span class="spec-key">${row[0]}</span>
            <span class="spec-val">${row[1]}</span>
        </div>
      `).join('');
  }

  // 7. Description
  const descD = document.getElementById("detail-description-desktop");
  const descM = document.getElementById("detail-description-mobile");
  const safeDesc = (listing.description || "No description.").replace(/\n/g, '<br>');
  if (descD) descD.innerHTML = safeDesc;
  if (descM) descM.innerHTML = safeDesc;

  // 8. Technical Details
  const techD = document.getElementById("tech-details-desktop");
  const techM = document.getElementById("tech-details-mobile");
  renderBothTechnicalDetails(listing, techD, techM);

  // 9. Gallery & Carousel
  if (listing.photos && listing.photos.length > 0) {
    const mainD = document.getElementById("main-image-desktop");
    const carouselM = document.getElementById("mobile-carousel");
    
    // Desktop Gallery
    if (mainD) mainD.src = listing.photos[0];
    const totalD = document.getElementById("total-images-desktop");
    if (totalD) totalD.textContent = listing.photos.length;

    // Mobile Native Carousel
    if (carouselM) {
      carouselM.innerHTML = listing.photos.map(p => `
        <div class="native-carousel-item" onclick="openLightbox(0)">
          <img src="${p}" alt="Listing Photo" loading="lazy">
        </div>
      `).join('');

      // Add scroll listener for index indicator
      carouselM.addEventListener('scroll', () => {
        const width = carouselM.offsetWidth;
        const index = Math.round(carouselM.scrollLeft / width);
        const countM = document.getElementById("photo-count-text-mobile");
        if (countM) countM.textContent = `${index + 1} / ${listing.photos.length}`;
      });
    }

    const countM = document.getElementById("photo-count-text-mobile");
    if (countM) countM.textContent = `1 / ${listing.photos.length}`;

    // Thumbnails Desktop
    const thumbGridD = document.getElementById("thumbnails-grid-desktop");
    if (thumbGridD) {
        thumbGridD.innerHTML = listing.photos.map((p, i) => `
            <div class="gallery-thumbnail ${i === 0 ? 'active' : ''}" data-index="${i}">
                <img src="${p}" alt="Photo">
            </div>
        `).join('');
    }
  }

  // 10. Actions Init
  initializeAllActions(listing);

  // 11. Initializations
  if (isMobile) initializeNativeTabs();

  // 12. Map
  import("./malta-map-svg.js").then(m => {
      if (!isMobile) m.initMaltaSVGMap(listing.location_city, 'seller-map-container-desktop');
      m.initMaltaSVGMap(listing.location_city, 'malta-map-svg-mobile');
  });
}

/**
 * Build data for specs table
 */
function buildSpecsTableData(listing) {
    const data = [];
    data.push(["Listing No", listing.listing_number || listing.id.substring(0,8)]);
    data.push(["Category", listing.category_text || "General"]);
    if (listing.item_condition) data.push(["Condition", listing.item_condition]);
    
    const extra = listing.extra_fields || {};
    Object.keys(extra).forEach(k => {
        if (k === 'technical_details') return;
        const label = k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ');
        data.push([label, extra[k]]);
    });
    return data;
}

function renderBothTechnicalDetails(listing, containerD, containerM) {
    let tech = listing.extra_fields?.technical_details;
    if (typeof tech === 'string') {
        try {
            tech = JSON.parse(tech);
        } catch (e) {
            tech = [];
        }
    }

    let html = '';

    if (Array.isArray(tech) && tech.length > 0) {
        html = `<ul class="tech-details-list">
            ${tech.map(feature => `
                <li>
                    <i class="fas fa-check-circle"></i>
                    <span>${feature}</span>
                </li>
            `).join('')}
        </ul>`;
    } else if (tech && typeof tech === 'object') {
        const items = [];
        Object.entries(tech).forEach(([group, features]) => {
            if (!Array.isArray(features) || features.length === 0) return;
            features.forEach((f) => {
                items.push(f);
            });
        });
        
        if (items.length > 0) {
            html = `<ul class="tech-details-list">
                ${items.map(feature => `
                    <li>
                        <i class="fas fa-check-circle"></i>
                        <span>${feature}</span>
                    </li>
                `).join('')}
            </ul>`;
        }
    }

    const finalHtml = html || '<p style="text-align: center; color: #999; padding: 1rem;">No technical details available.</p>';
    if (containerD) containerD.innerHTML = finalHtml;
    if (containerM) containerM.innerHTML = finalHtml;
}

async function initializeAllActions(listing) {
    const { data: { user } } = await supabase.auth.getUser();
    const isOwner = user && user.id === listing.user_id;

    // Desktop Elements
    const favD = document.getElementById("favorite-btn-desktop");
    const msgD = document.getElementById("message-btn-desktop");
    const phnD = document.getElementById("phone-btn-desktop");

    // Mobile Elements
    const backBtn = document.getElementById("mobile-back-btn");
    const favM = document.getElementById("mobile-favorite-btn");
    const shareM = document.getElementById("mobile-share-btn");
    const msgM = document.getElementById("message-btn-footer-mobile");
    const editM = document.getElementById("edit-btn-footer-mobile");

    // Initialize State (Favorite status)
    if (user) {
        try {
            const { isFavorite } = await import("./api.js");
            const isInFav = await isFavorite(listing.id);
            updateFavUI(isInFav);
        } catch (e) { console.error("Initial favorite check failed", e); }
    }

    // Toggle Mobile Footer Buttons (Owner vs Guest)
    if (isOwner) {
        if (msgM) msgM.style.display = "none";
        if (editM) {
            editM.style.display = "flex";
            editM.onclick = () => window.location.href = `ilan-ekle.html?edit=${listing.id}`;
        }
    } else {
        if (msgM) msgM.style.display = "flex";
        if (editM) editM.style.display = "none";
    }

    // --- Action: Favorite ---
    const updateFavUI = (isActive) => {
        [favD, favM].forEach(btn => {
            if (!btn) return;
            const icon = btn.querySelector('i');
            if (isActive) {
                btn.classList.add('active');
                if (icon) icon.className = 'fas fa-heart';
                if (btn.id.includes('mobile')) btn.style.color = '#ef4444';
            } else {
                btn.classList.remove('active');
                if (icon) icon.className = 'far fa-heart';
                if (btn.id.includes('mobile')) btn.style.color = '#fff';
            }
        });
    };

    const handleToggleFav = async () => {
        if (!user) {
            if (typeof showNotification === 'function') showNotification('Please log in to add favorites', 'warning');
            else alert('Please log in to add favorites');
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
            return;
        }

        const btn = favM || favD;
        const willBeActive = !btn.classList.contains('active');
        
        try {
            updateFavUI(willBeActive); // Optimistic UI update
            if (willBeActive) {
                await addToFavorites(listing.id);
                if (typeof showNotification === 'function') showNotification('Added to favorites', 'success');
            } else {
                await removeFromFavorites(listing.id);
                if (typeof showNotification === 'function') showNotification('Removed from favorites', 'info');
            }
        } catch (error) {
            console.error('Favorite error:', error);
            updateFavUI(!willBeActive); // Rollback on error
            if (typeof showNotification === 'function') showNotification('Failed to update favorites', 'error');
        }
    };

    if (favD) favD.onclick = handleToggleFav;
    if (favM) favM.onclick = handleToggleFav;

    // --- Action: Message ---
    const handleMessage = () => {
        if (!user) {
            if (typeof showNotification === 'function') showNotification('Please log in to send a message', 'warning');
            window.location.href = 'login.html';
            return;
        }
        if (isOwner) {
            if (typeof showNotification === 'function') showNotification('You cannot message your own listing', 'warning');
            return;
        }
        window.location.href = `mesajlar.html?listing_id=${listing.id}&seller_id=${listing.user_id}`;
    };

    if (msgD) msgD.onclick = handleMessage;
    if (msgM) msgM.onclick = handleMessage;

    // --- Action: Phone ---
    const handlePhone = async (btn) => {
        if (!user) {
            if (typeof showNotification === 'function') showNotification('Please log in to view phone number', 'warning');
            window.location.href = 'login.html';
            return;
        }
        try {
            const { data } = await supabase.from("profiles").select("phone").eq("id", listing.user_id).single();
            if (data?.phone) btn.innerHTML = `<i class="fas fa-phone"></i> ${data.phone}`;
            else {
                if (typeof showNotification === 'function') showNotification('Phone number not shared', 'info');
                else alert("Phone hidden");
            }
        } catch (e) {
            console.error('Phone error:', e);
            if (typeof showNotification === 'function') showNotification('Failed to load phone number', 'error');
        }
    };

    if (phnD) phnD.onclick = () => handlePhone(phnD);

    // --- Action: Share ---
    const handleShare = async () => {
        const shareData = {
            title: listing.title,
            text: `Check out this listing: ${listing.title}`,
            url: window.location.href
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(window.location.href);
                if (typeof showNotification === 'function') showNotification('Link copied to clipboard!', 'success');
                else alert('Link copied to clipboard!');
            }
        } catch (err) {
            console.error('Share error:', err);
        }
    };

    if (shareM) shareM.onclick = handleShare;

    // --- Navigation ---
    if (backBtn) backBtn.onclick = () => window.history.back();
}

function initializeNativeTabs() {
  const tabs = document.querySelectorAll('.tab-item');
  const panes = document.querySelectorAll('.native-tab-pane');
  const wrapper = document.querySelector('.native-tabs-scroll');
  
  if (!tabs.length || !wrapper) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = tab.getAttribute('data-tab');
      
      // Update Tabs
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update Panes
      panes.forEach(p => p.classList.remove('active'));
      const targetPane = document.getElementById(`tab-${targetId}`);
      if (targetPane) targetPane.classList.add('active');

      // Scroll into view if needed
      tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  });
}


function formatDateRelative(dateStr) {
  const diff = new Date() - new Date(dateStr);
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs} hours ago`;
  return `${Math.floor(hrs/24)} days ago`;
}

/**
 * HTML escape (XSS koruması)
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Tarih formatla
 */
function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Özellikler tablosu oluştur
 */
function buildSpecsTable(listing) {
  const specs = [];
  const extra = listing.extra_fields || {};

  // Kategoriye göre gösterilecek özellikler
  const category = String(listing.category_text || listing.category_id || "").toLowerCase();

  console.log("🔍 Detay - Kategori (orijinal):", listing.category_id);
  console.log("🔍 Detay - Kategori (lowercase):", category);
  console.log("🔍 Detay - Extra Fields:", extra);

  if (
    category.includes("vasıta") ||
    category.includes("araba") ||
    category.includes("otomobil") ||
    category.includes("araç") ||
    category.includes("audi") ||
    category.includes("bmw") ||
    category.includes("mercedes") ||
    category.includes("volkswagen") ||
    category.includes("opel") ||
    category.includes("ford") ||
    category.includes("renault") ||
    category.includes("peugeot") ||
    category.includes("toyota") ||
    category.includes("honda") ||
    category.includes("nissan") ||
    category.includes("hyundai") ||
    category.includes("kia") ||
    category.includes("tesla") ||
    category.includes("porsche") ||
    category.includes("jaguar") ||
    category.includes("volvo") ||
    category.includes("suzuki") ||
    category.includes("mitsubishi") ||
    category.includes("mazda") ||
    category.includes("subaru") ||
    category.includes("skoda") ||
    category.includes("seat") ||
    category.includes("mini") ||
    category.includes("jeep") ||
    category.includes("chevrolet") ||
    category.includes("fiat") ||
    category.includes("alfa") ||
    category.includes("lancia") ||
    category.includes("lamborghini") ||
    category.includes("ferrari") ||
    category.includes("maserati")
  ) {
    // İlan Bilgileri - Otomobil kategorisine özel alanlar
    specs.push(["From", extra.kimden || "-"]);
    specs.push(["Model", extra.model || "-"]);
    specs.push(["Year", extra.yil || "-"]);
    specs.push([
      "KM",
      extra.kilometre
        ? (parseInt(extra.kilometre) || 0).toLocaleString("en-US")
        : "-",
    ]);
    specs.push(["Engine (cc)", extra.motor_hacmi || "-"]);
    specs.push(["Fuel Type", extra.yakit || "-"]);
    specs.push(["Transmission", extra.vites || "-"]);
    specs.push(["Drivetrain", extra.cekis || "-"]);
    specs.push(["Doors", extra.kapi || "-"]);
    specs.push(["Color", extra.renk || "-"]);
    specs.push(["AC", extra.klima || "-"]);
    specs.push(["Condition", extra.durum || "-"]);
    specs.push(["Warranty", extra.garanti || "-"]);
    specs.push(["Import", extra.import || "-"]);
    specs.push(["Exchange", extra.takas || "-"]);
  } else if (
    category.includes("real estate") ||
    category.includes("residential") ||
    category.includes("home") ||
    category.includes("property") ||
    category.includes("villa")
  ) {
    // Basic Info
    specs.push(["Property Type", extra.property_type || extra.emlak_tipi || "-"]);
    specs.push([
      "Listing Type",
      extra.listing_type || extra.ilan_tipi || "For Sale",
    ]);
    specs.push([
      "Area (Gross)",
      extra.area || extra.metrekare
        ? `${extra.area || extra.metrekare} m²`
        : "-",
    ]);
    specs.push([
      "Area (Net)",
      extra.net_area || extra.net_metrekare
        ? `${extra.net_area || extra.net_metrekare} m²`
        : "-",
    ]);

    // Room and Space Details
    specs.push(["Rooms", extra.rooms || extra.oda_sayisi || "-"]);
    specs.push([
      "Living Rooms",
      extra.living_rooms || extra.salon_sayisi || "-",
    ]);
    specs.push(["Bathrooms", extra.baths || extra.banyo_sayisi || "-"]);
    specs.push(["WC Count", extra.wc_count || extra.wc_sayisi || "-"]);
    specs.push(["Balcony", extra.balcony || extra.balkon || "-"]);

    // Building Info
    specs.push(["Floor", extra.floor || extra.kat || "-"]);
    specs.push(["Total Floors", extra.total_floors || extra.toplam_kat || "-"]);
    specs.push([
      "Building Age",
      extra.age || extra.yasi || extra.building_age
        ? `${extra.age || extra.yasi || extra.building_age} years`
        : "-",
    ]);
    specs.push([
      "Construction Type",
      extra.construction_type || extra.yapi_tipi || "-",
    ]);
    specs.push([
      "Building Status",
      extra.building_status || extra.yapi_durumu || "-",
    ]);

    // Comfort and Equipment
    specs.push(["Heating", extra.heating || extra.isitma || "-"]);
    specs.push(["Fuel Type", extra.fuel_type || extra.yakit_tipi || "-"]);
    specs.push([
      "Usage Status",
      extra.usage_status || extra.kullanim_durumu || "-",
    ]);
    specs.push([
      "Furniture",
      extra.furnished === true
        ? "Furnished"
        : extra.furnished === false
          ? "Unfurnished"
          : extra.mobilya || "-",
    ]);
    specs.push(["Appliances", extra.appliances || extra.esya || "-"]);

    // Facade and View
    specs.push(["Facade", extra.facade || extra.cephe || "-"]);
    specs.push(["View", extra.view || extra.manzara || "-"]);

    // Features
    if (extra.elevator)
      specs.push(["Elevator", extra.elevator === true ? "Yes" : "No"]);
    if (extra.parking)
      specs.push(["Parking", extra.parking === true ? "Yes" : extra.parking]);
    if (extra.security)
      specs.push(["Security", extra.security === true ? "Yes" : "No"]);
    if (extra.generator)
      specs.push(["Generator", extra.generator === true ? "Yes" : "No"]);
    if (extra.pool) specs.push(["Pool", extra.pool === true ? "Yes" : "No"]);
    if (extra.garden)
      specs.push(["Garden", extra.garden === true ? "Yes" : "No"]);
    if (extra.terrace)
      specs.push(["Terrace", extra.terrace === true ? "Yes" : "No"]);
    if (extra.basement)
      specs.push(["Basement", extra.basement === true ? "Yes" : "No"]);

    // Dues and Costs
    if (extra.dues) specs.push(["Dues", `€${extra.dues}`]);
    if (extra.deed_status) specs.push(["Deed Status", extra.deed_status]);
  } else if (
    category.includes("elektronik") ||
    category.includes("technology") ||
    category.includes("phone") ||
    category.includes("computer") ||
    category.includes("tablet")
  ) {
    // Electronics
    specs.push(["Brand", extra.brand || extra.marka || "-"]);
    specs.push(["Model", extra.model || "-"]);
    specs.push(["Color", extra.color || extra.renk || "-"]);
    specs.push(["Condition", extra.condition || extra.durum || "Second Hand"]);
    specs.push([
      "Warranty",
      extra.warranty === true
        ? "Yes"
        : extra.warranty === false
          ? "No"
          : extra.warranty || "-",
    ]);

    if (extra.memory || extra.hafiza)
      specs.push(["Memory", extra.memory || extra.hafiza]);
    if (extra.storage || extra.depolama)
      specs.push(["Storage", extra.storage || extra.depolama]);
    if (extra.screen_size || extra.ekran_boyutu)
      specs.push(["Screen Size", extra.screen_size || extra.ekran_boyutu]);
    if (extra.ram) specs.push(["RAM", extra.ram]);
    if (extra.processor || extra.islemci)
      specs.push(["Processor", extra.processor || extra.islemci]);
    if (extra.graphics_card || extra.ekran_karti)
      specs.push(["Graphics Card", extra.graphics_card || extra.ekran_karti]);
  } else if (
    category.includes("mobilya") ||
    category.includes("furniture") ||
    category.includes("home item") ||
    category.includes("appliances") ||
    category.includes("home & decor")
  ) {
    // Furniture and Appliances
    specs.push(["Product Type", extra.product_type || extra.urun_tipi || "-"]);
    specs.push(["Brand", extra.brand || extra.marka || "-"]);
    specs.push(["Condition", extra.condition || extra.durum || "Second Hand"]);
    specs.push(["Color", extra.color || extra.renk || "-"]);

    if (extra.material || extra.malzeme)
      specs.push(["Material", extra.material || extra.malzeme]);
    if (extra.dimensions || extra.olculer)
      specs.push(["Dimensions", extra.dimensions || extra.olculer]);
    if (extra.age || extra.yasi)
      specs.push(["Age", `${extra.age || extra.yasi} years`]);
    if (extra.energy_class || extra.enerji_sinifi)
      specs.push(["Energy Class", extra.energy_class || extra.enerji_sinifi]);
  } else if (
    category.includes("giyim") ||
    category.includes("clothing") ||
    category.includes("fashion") ||
    category.includes("aksesuar") ||
    category.includes("accessory") ||
    category.includes("ayakkabı") ||
    category.includes("shoes")
  ) {
    // Clothing and Accessory
    specs.push(["Product Type", extra.product_type || extra.urun_tipi || "-"]);
    specs.push(["Brand", extra.brand || extra.marka || "-"]);
    specs.push(["Size", extra.size || extra.beden || "-"]);
    specs.push(["Color", extra.color || extra.renk || "-"]);
    specs.push(["Condition", extra.condition || extra.durum || "Second Hand"]);

    if (extra.material || extra.malzeme)
      specs.push(["Material", extra.material || extra.malzeme]);
    if (extra.gender || extra.cinsiyet)
      specs.push(["Gender", extra.gender || extra.cinsiyet]);
    if (extra.season || extra.sezon)
      specs.push(["Season", extra.season || extra.sezon]);
  } else {
    // Diğer kategoriler için genel alanlar
    if (extra.brand || extra.marka)
      specs.push(["Brand", extra.brand || extra.marka]);
    if (extra.model) specs.push(["Model", extra.model]);
    if (extra.condition || extra.durum)
      specs.push(["Condition", extra.condition || extra.durum]);
    if (extra.color || extra.renk)
      specs.push(["Color", extra.color || extra.renk]);
    if (extra.size || extra.beden)
      specs.push(["Size", extra.size || extra.beden]);
    if (extra.material || extra.malzeme)
      specs.push(["Material", extra.material || extra.malzeme]);
    if (extra.year || extra.yıl) specs.push(["Year", extra.year || extra.yıl]);
  }

  // Her zaman gösterilecekler - Sadece bir kez
  specs.unshift(["Category", listing.category_id || "-"]);
  specs.unshift(["Date Posted", formatDate(listing.created_at)]);
  // Eğer DB'de atomik `listing_number` varsa onu göster, yoksa mevcut UUID özetini göster
  const publicListingNo =
    listing && (listing.listing_number || listing.listing_number === 0)
      ? String(listing.listing_number)
      : listing.id?.substring(0, 8)?.toUpperCase() || "-";
  specs.unshift(["Ad Ref", publicListingNo]);
  specs.push(["Location", listing.location_city || "-"]);

  // Ekstra alanların tamamını göster: daha önce özel olarak eklenmemiş anahtarları ekle
  const handledKeys = new Set([
    "kimden",
    "from_who",
    "brand",
    "marka",
    "model",
    "yil",
    "yıl",
    "year",
    "kilometre",
    "km",
    "motor_hacmi",
    "engine_size",
    "yakit",
    "fuel",
    "vites",
    "transmission",
    "cekis",
    "drive_type",
    "kapi",
    "kapi_sayisi",
    "renk",
    "color",
    "durum",
    "condition",
    "garanti",
    "warranty",
    "import",
    "plaka_uyruk",
    "takas",
    "exchange",
    "technical_details",
  ]);

  const labelMap = {
    konum: "Location",
    kimden: "From",
    model: "Model",
    yil: "Year",
    kilometre: "KM",
    motor_hacmi: "Engine (cc)",
    yakit: "Fuel Type",
    vites: "Transmission",
    cekis: "Drivetrain",
    kapi: "Doors",
    renk: "Color",
    klima: "AC",
    durum: "Condition",
    garanti: "Warranty",
    import: "Import",
    takas: "Exchange",
  };

  Object.entries(extra).forEach(([key, val]) => {
    if (val === undefined || val === null || String(val).trim() === "") return;
    if (handledKeys.has(key)) return;

    // Humanize key if no mapping
    const label =
      labelMap[key] ||
      key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    specs.push([label, val]);
  });

  return specs
    .map(([label, value], idx) => {
      // Mobil için ikonlar
      let icon = "";
      if (label === "Year") icon = '<i class="fas fa-calendar"></i>';
      else if (label === "KM" || label === "kilometre")
        icon = '<i class="fas fa-road"></i>';
      else if (label === "Fuel Type" || label === "fuel")
        icon = '<i class="fas fa-gas-pump"></i>';
      else if (label === "Transmission") icon = '<i class="fas fa-cog"></i>';
      else if (label === "Model") icon = '<i class="fas fa-car"></i>';
      else if (label === "Engine (cc)") icon = '<i class="fas fa-engine"></i>';
      else if (label === "Doors") icon = '<i class="fas fa-door-open"></i>';
      else if (label === "Drivetrain") icon = '<i class="fas fa-grip"></i>';

      return `
            <div class="spec-row">
                ${icon ? '<div class="spec-icon">' + icon + "</div>" : ""}
                <div class="spec-label">${escapeHtml(label)}</div>
                <div class="spec-value">${escapeHtml(String(value))}</div>
            </div>
        `;
    })
    .join("");
}

/**
 * Galeri navigasyon
 */
function initializeGallery(listing) {
  const mainImage = document.getElementById("main-image-desktop") || document.getElementById("main-image");

  // Tek fotoğraf varsa da lightbox ekle
  if (!listing.photos || listing.photos.length <= 1) {
    if (mainImage && listing.photos && listing.photos.length > 0) {
      mainImage.style.cursor = "pointer";
      mainImage.title = "Click to enlarge";
      mainImage.addEventListener("click", () => {
        openLightbox(listing.photos, 0);
      });
    }
    const totalEl = document.getElementById("total-images-desktop") || document.getElementById("total-images");
    if (totalEl) totalEl.textContent = listing.photos ? listing.photos.length : 1;
    return;
  }

  let currentIndex = 0;
  const prevBtn = document.querySelector(".gallery-nav.prev") || document.getElementById("prev-image");
  const nextBtn = document.querySelector(".gallery-nav.next") || document.getElementById("next-image");
  const currentImageEl = document.getElementById("current-image-desktop") || document.getElementById("current-image");
  const totalImageEl = document.getElementById("total-images-desktop") || document.getElementById("total-images");

  if (totalImageEl) totalImageEl.textContent = listing.photos.length;

  const updateImage = (index, direction = 0) => {
    const nextIndex = (index + listing.photos.length) % listing.photos.length;

    // Yön belirleme (1: İleri/Sola Kaydırma, -1: Geri/Sağa Kaydırma)
    if (direction === 0) {
      if (nextIndex > currentIndex) direction = 1;
      else if (nextIndex < currentIndex) direction = -1;
    }

    if (direction !== 0 && window.innerWidth <= 768) { // Mobilde animasyon
      const outClass = direction === 1 ? 'slide-out-left' : 'slide-out-right';
      const inClass = direction === 1 ? 'slide-in-right' : 'slide-in-left';

      mainImage.classList.add(outClass);

      setTimeout(() => {
        mainImage.src = listing.photos[nextIndex];
        currentImageEl.textContent = nextIndex + 1;
        currentIndex = nextIndex;

        // Anında karşı tarafa al
        mainImage.style.transition = 'none';
        mainImage.classList.remove(outClass);
        mainImage.classList.add(inClass);

        document.querySelectorAll(".gallery-thumbnail").forEach((thumb, idx) => {
          thumb.classList.toggle("active", idx === currentIndex);
        });

        // Frame bekleyip içeri doğru kaydır
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            mainImage.style.transition = '';
            mainImage.classList.remove(inClass);
          });
        });
      }, 250); // CSS animasyon süresine uygun (0.3s -> 250ms civarı güvenli)
    } else {
      // Masaüstü veya yönsüz anında geçiş
      currentIndex = nextIndex;
      mainImage.src = listing.photos[currentIndex];
      currentImageEl.textContent = currentIndex + 1;
      document.querySelectorAll(".gallery-thumbnail").forEach((thumb, idx) => {
        thumb.classList.toggle("active", idx === currentIndex);
      });
    }
  };

  // Thumbnail tıklaması
  document.querySelectorAll(".gallery-thumbnail").forEach((thumb, idx) => {
    thumb.addEventListener("click", () => updateImage(idx, 0));
  });

  // Navigation butonları
  if (prevBtn) {
    prevBtn.addEventListener("click", () => updateImage(currentIndex - 1));
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => updateImage(currentIndex + 1));
  }

  // Ana fotoğrafa tıklayınca lightbox aç
  if (mainImage) {
    mainImage.style.cursor = "pointer";
    mainImage.title = "Click to enlarge";
    mainImage.addEventListener("click", () => {
      openLightbox(listing.photos, currentIndex);
    });

    // Mobile Swipe (Touch) Desteği
    let touchStartX = 0;
    let touchEndX = 0;

    mainImage.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].screenX;
    }, {passive: true});

    mainImage.addEventListener('touchend', e => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }, {passive: true});

    function handleSwipe() {
      const distance = touchEndX - touchStartX;
      const threshold = 50; // minimum kaydırma mesafesi
      
      if (Math.abs(distance) > threshold) {
        if (distance < 0) {
          // Sola kaydırma (Sonraki fotoğraf)
          updateImage(currentIndex + 1, 1);
        } else {
          // Sağa kaydırma (Önceki fotoğraf)
          updateImage(currentIndex - 1, -1);
        }
      }
    }
  }

  // Thumbnail'lere de lightbox ekle
  document.querySelectorAll(".gallery-thumbnail").forEach((thumb, idx) => {
    thumb.style.cursor = "pointer";
    thumb.title = "Click to enlarge";
    // Tek tıklama ile hem güncelle hem lightbox aç
    thumb.addEventListener("click", () => {
      updateImage(idx);
    });
    // Çift tıklama ile sadece lightbox aç
    thumb.addEventListener("dblclick", () => {
      openLightbox(listing.photos, idx);
    });
  });

  // Klavye navigasyonu
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") updateImage(currentIndex - 1);
    if (e.key === "ArrowRight") updateImage(currentIndex + 1);
  });
}

// Lightbox Modal Fonksiyonları
function openLightbox(photos, startIndex = 0) {
  const lightbox = document.getElementById("lightbox-modal");
  const lightboxImg = document.getElementById("lightbox-image");
  const lightboxCurrent = document.getElementById("lightbox-current");
  const lightboxTotal = document.getElementById("lightbox-total");
  const prevBtn = document.getElementById("lightbox-prev");
  const nextBtn = document.getElementById("lightbox-next");
  const closeBtn = document.getElementById("lightbox-close");

  if (!lightbox || !lightboxImg) {
    console.error("Lightbox element not found");
    return;
  }

  if (!photos || photos.length === 0) {
    console.error("No photo found");
    return;
  }

  let currentIdx = startIndex;
  let scale = 1;
  let translateX = 0,
    translateY = 0;
  let isDragging = false;
  let startX, startY;

  const updateLightbox = (index) => {
    currentIdx = (index + photos.length) % photos.length;
    lightboxImg.src = photos[currentIdx];
    if (lightboxCurrent) lightboxCurrent.textContent = currentIdx + 1;

    // Reset zoom any time we switch photos
    scale = 1;
    translateX = 0;
    translateY = 0;
    applyTransform();
    updateUIConsistency();

    if (photos.length === 1) {
      if (prevBtn) prevBtn.style.display = "none";
      if (nextBtn) nextBtn.style.display = "none";
    } else {
      if (prevBtn) prevBtn.style.display = "flex";
      if (nextBtn) nextBtn.style.display = "flex";
    }
  };

  const applyTransform = (smooth = true) => {
    if (!lightboxImg) return;
    lightboxImg.style.transition = smooth
      ? "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
      : "none";
    lightboxImg.style.transform = `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`;
    lightboxImg.style.cursor =
      scale > 1.1 ? (isDragging ? "grabbing" : "grab") : "zoom-in";
  };

  const updateUIConsistency = () => {
    const isZoomed = scale > 1.1;
    lightboxImg.classList.toggle("zoom-mode", isZoomed);

    const uiOpacity = isZoomed ? "0" : "1";
    const uiPointerEvents = isZoomed ? "none" : "auto";

    if (prevBtn) {
      prevBtn.style.opacity = uiOpacity;
      prevBtn.style.pointerEvents = uiPointerEvents;
    }
    if (nextBtn) {
      nextBtn.style.opacity = uiOpacity;
      nextBtn.style.pointerEvents = uiPointerEvents;
    }

    if (closeBtn) {
      closeBtn.style.opacity = isZoomed ? "0.3" : "1";
      closeBtn.style.pointerEvents = "auto";
    }
  };

  updateLightbox(currentIdx);
  if (lightboxTotal) lightboxTotal.textContent = photos.length;
  lightbox.classList.add("active");
  document.body.style.overflow = "hidden";

  // Mouse Wheel Zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.25 : 0.25;
    const newScale = Math.min(Math.max(1, scale + delta), 4);

    if (newScale !== scale) {
      scale = newScale;
      if (scale === 1) {
        translateX = 0;
        translateY = 0;
      }
      applyTransform(true);
      updateUIConsistency();
    }
  };

  // Toggle scroll zoom (Click)
  const handleImageClick = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Eğer zaten zoom yapılmışsa (wheel veya click ile), geri küçült
    if (scale > 1.1) {
      scale = 1;
      translateX = 0;
      translateY = 0;
    } else {
      // Hiç zoom yoksa standart 2.5x zoom yap
      scale = 2.5;
      translateX = 0;
      translateY = 0;
    }
    applyTransform(true);
    updateUIConsistency();
  };

  // Dragging Logic
  const handleMouseDown = (e) => {
    if (scale <= 1.1) return;
    if (e.button !== 0) return; // Only left click

    e.preventDefault(); // Stop native image drag

    let moved = false;
    const clickStartX = e.clientX;
    const clickStartY = e.clientY;

    startX = e.clientX - translateX;
    startY = e.clientY - translateY;

    const onMouseMove = (moveEv) => {
      const dist = Math.sqrt(
        Math.pow(moveEv.clientX - clickStartX, 2) +
          Math.pow(moveEv.clientY - clickStartY, 2),
      );
      if (dist > 5) {
        isDragging = true;
        moved = true;
        translateX = moveEv.clientX - startX;
        translateY = moveEv.clientY - startY;
        applyTransform(false);
      }
    };

    const onMouseUp = () => {
      isDragging = false;
      applyTransform(true);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      // If we moved, prevent the next 'click' from toggling zoom
      if (moved) {
        const preventClick = (clickEv) => {
          clickEv.stopImmediatePropagation();
          lightboxImg.removeEventListener("click", preventClick, true);
        };
        lightboxImg.addEventListener("click", preventClick, true);
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const closeLightbox = () => {
    lightbox.classList.remove("active");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", handleKeyPress);
    lightboxImg.removeEventListener("click", handleImageClick);
    lightboxImg.removeEventListener("mousedown", handleMouseDown);
    lightbox.removeEventListener("wheel", handleWheel);
  };

  if (closeBtn) closeBtn.onclick = closeLightbox;
  lightbox.onclick = (e) => {
    if (e.target === lightbox) closeLightbox();
  };

  if (prevBtn)
    prevBtn.onclick = (e) => {
      e.stopPropagation();
      updateLightbox(currentIdx - 1);
    };
  if (nextBtn)
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      updateLightbox(currentIdx + 1);
    };

  lightboxImg.addEventListener("click", handleImageClick);
  lightboxImg.addEventListener("mousedown", handleMouseDown);
  lightbox.addEventListener("wheel", handleWheel, { passive: false });

  // Klavye kontrolleri
  const handleKeyPress = (e) => {
    if (e.key === "ArrowLeft" && photos.length > 1 && scale <= 1.1)
      updateLightbox(currentIdx - 1);
    if (e.key === "ArrowRight" && photos.length > 1 && scale <= 1.1)
      updateLightbox(currentIdx + 1);
    if (e.key === "Escape") closeLightbox();
  };

  document.addEventListener("keydown", handleKeyPress);
}

/**
 * Edit formu render et
 */
function renderEditForm(listing) {
  const container = document.querySelector(".ad-detail-container");
  if (!container) return;

  container.innerHTML = `
        <div class="edit-form-container">
            <div class="edit-header">
                <h1>
                    <i class="fas fa-edit"></i>
                    <span>Edit Listing</span>
                </h1>
                <button class="btn-back" onclick="window.history.back()">
                    <i class="fas fa-arrow-left"></i>
                    <span>Back</span>
                </button>
            </div>
            
            <form id="edit-listing-form" class="edit-form">
                <!-- Sol Kolon: Form Alanları -->
                <div class="form-left-column">
                    <!-- Bilgilendirme Kartı -->
                    <div class="info-banner">
                        <i class="fas fa-lightbulb"></i>
                        <div class="info-content">
                            <strong>Tip:</strong>
                            <span>Use a descriptive title and detailed description when updating your listing. The first photo will be used as the main image.</span>
                        </div>
                    </div>
                    
                    <!-- Temel Bilgiler -->
                    <div class="form-section">
                        <h2>
                            <span class="section-number">1</span>
                            <i class="fas fa-info-circle"></i>
                            <span>Basic Information</span>
                        </h2>
                        <div class="form-grid">
                            <div class="form-group full-width">
                                <label for="edit-title">
                                    Listing Title <span class="required">*</span>
                                </label>
                                <input type="text" id="edit-title" name="title" 
                                    value="${escapeHtml(listing.title)}" 
                                    required maxlength="100" 
                                    placeholder="Ex: 3+1 Apartment for Sale">
                            </div>
                            
                            <div class="form-group">
                                <label for="edit-category">
                                    Category <span class="required">*</span>
                                </label>
                                <div class="category-visual">
                                    ${(listing.category_id || "")
                                      .split(">")
                                      .map(
                                        (c) =>
                                          `<span class="cat-chip">${c.trim()}</span>`,
                                      )
                                      .join(
                                        '<i class="fas fa-chevron-right" style="font-size: 0.7rem; color: var(--gray-300)"></i>',
                                      )}
                                </div>
                                <input type="hidden" id="edit-category" name="category" value="${escapeHtml(listing.category_id || "")}">
                            </div>
                            
                            <div class="form-group">
                                <label for="edit-location">
                                    <i class="fas fa-map-marker-alt"></i>
                                    Location <span class="required">*</span>
                                </label>
                                <input type="text" id="edit-location" name="location" 
                                    value="${escapeHtml(listing.location_city || "")}" 
                                    required placeholder="Ex: Valletta, Malta">
                            </div>
                            
                            <div class="form-group">
                                <label for="edit-status">
                                    <i class="fas fa-toggle-on"></i>
                                    Status
                                </label>
                                <select id="edit-status" name="status">
                                    <option value="active" ${listing.status === "active" ? "selected" : ""}>
                                        ✅ Active
                                    </option>
                                    <option value="inactive" ${listing.status === "inactive" ? "selected" : ""}>
                                        ⏸️ Inactive
                                    </option>
                                    <option value="sold" ${listing.status === "sold" ? "selected" : ""}>
                                        ✔️ Sold
                                    </option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="edit-price">
                                    <i class="fas fa-tag"></i>
                                    Price (€) <span class="required">*</span>
                                </label>
                                <input type="number" id="edit-price" name="price" 
                                    value="${listing.price}" 
                                    required min="0" step="0.01" 
                                    placeholder="0.00">
                            </div>
                            
                            <!-- Para Birimi (Sabit EUR) -->
                            <input type="hidden" name="currency" value="EUR">
                            
                            <div class="form-group full-width">
                                <label for="edit-description">
                                    <i class="fas fa-align-left"></i>
                                    Description <span class="required">*</span>
                                </label>
                                <div class="rich-text-toolbar" id="rteToolbar">
                                    <button type="button" data-cmd="bold" title="Bold (Ctrl+B)"><i class="fas fa-bold"></i></button>
                                    <button type="button" data-cmd="italic" title="Italic (Ctrl+I)"><i class="fas fa-italic"></i></button>
                                    <button type="button" data-cmd="underline" title="Underline"><i class="fas fa-underline"></i></button>
                                    <button type="button" data-cmd="insertUnorderedList" title="Bullet List"><i class="fas fa-list-ul"></i></button>
                                    <button type="button" data-cmd="insertOrderedList" title="Numbered List"><i class="fas fa-list-ol"></i></button>
                                    <button type="button" data-cmd="justifyLeft" title="Align Left"><i class="fas fa-align-left"></i></button>
                                    <button type="button" data-cmd="justifyCenter" title="Align Center"><i class="fas fa-align-center"></i></button>
                                    <button type="button" data-cmd="justifyRight" title="Align Right"><i class="fas fa-align-right"></i></button>
                                    <button type="button" data-cmd="createLink" title="Add Link"><i class="fas fa-link"></i></button>
                                    <button type="button" data-cmd="removeFormat" title="Clear Formatting"><i class="fas fa-eraser"></i></button>
                                </div>
                                
                                <div id="edit-description-editor" class="form-textarea rich-text-editor" contenteditable="true" 
                                    style="border-top-left-radius: 0; border-top-right-radius: 0; min-height: 200px; overflow-y: auto;"
                                    placeholder="Provide detailed information about your listing...">${listing.description || ""}</div>
                                
                                <input type="hidden" id="edit-description" name="description" value="${escapeHtml(listing.description || "")}">

                                <div class="desc-footer">
                                    <span class="validation-msg"></span>
                                    <span class="char-counter">
                                        <span id="desc-count">0</span> / 2000 characters
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Sticky Footer Actions -->
                <div class="sticky-form-actions">
                    <div class="actions-container">
                        <div class="status-indicator">
                            <i class="fas fa-circle-notch fa-spin"></i>
                            <span>Unsaved Changes</span>
                        </div>
                        <div class="buttons">
                            <button type="button" class="btn-cancel" onclick="window.history.back()">
                                <span>Cancel</span>
                            </button>
                            <button type="submit" form="edit-listing-form" class="btn-save">
                                <i class="fas fa-check"></i>
                                <span>Save</span>
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Sağ Kolon: Fotoğraf Yönetimi -->
                <div class="form-right-column">
                    <div class="form-section">
                        <h2>
                            <span class="section-number">2</span>
                            <i class="fas fa-images"></i>
                            <span>Photos</span>
                        </h2>
                        <div class="photos-manager" id="photos-manager">
                            <div class="photos-grid" id="photos-grid">
                                ${(listing.photos || [])
                                  .map(
                                    (photo, idx) => `
                                    <div class="photo-item" data-index="${idx}">
                                        <img src="${photo}" alt="Photo ${idx + 1}">
                                        <button type="button" class="remove-photo" data-index="${idx}">
                                            <i class="fas fa-times"></i>
                                        </button>
                                        ${idx === 0 ? '<span class="photo-badge">Main Photo</span>' : ""}
                                    </div>
                                `,
                                  )
                                  .join("")}
                            </div>
                            <div class="add-photo-section" onclick="document.getElementById('new-photos').click()">
                                <input type="file" id="new-photos" accept="image/*" multiple style="display: none;">
                                <button type="button" class="btn-add-photo">
                                    <i class="fas fa-plus-circle"></i>
                                    <span>Add Photo</span>
                                </button>
                                <p class="help-text">
                                    You can add up to <strong>10 photos</strong>.<br>
                                    The first photo will be the main photo.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    `;

  // Fallback: Manually hide mobile action footer
  const mobileFooter = document.querySelector(".mobile-action-footer");
  if (mobileFooter) mobileFooter.style.display = "none";

  initializeEditForm(listing);
}

/**
 * Edit form initialize
 */
function initializeEditForm(listing) {
  const form = document.getElementById("edit-listing-form");
  const photosGrid = document.getElementById("photos-grid");
  const newPhotosInput = document.getElementById("new-photos");
  const descEditor = document.getElementById("edit-description-editor");
  const descInput = document.getElementById("edit-description");
  const descCount = document.getElementById("desc-count");
  const toolbar = document.getElementById("rteToolbar");

  // Live Validation Helper
  const updateValidation = (input) => {
    const group = input.closest(".form-group");
    if (!group) return;

    let val = input.value;
    if (input.isContentEditable) {
      val = input.textContent;
    }

    if (input.hasAttribute("required") && (!val || !val.trim())) {
      group.classList.add("is-invalid");
      group.classList.remove("is-valid");
      return false;
    } else if (val && val.trim()) {
      group.classList.add("is-valid");
      group.classList.remove("is-invalid");
      return true;
    } else {
      group.classList.remove("is-valid", "is-invalid");
      return true;
    }
  };

  // Editor Logic
  if (descEditor && descInput && toolbar) {
    const updateDesc = () => {
      descInput.value = descEditor.innerHTML;
      if (descCount) descCount.textContent = descEditor.textContent.length;
      updateValidation(descEditor);

      // Değişiklik durumunu göster
      const indicator = document.querySelector(".status-indicator");
      if (indicator) {
        indicator.querySelector("span").textContent =
          "Unsaved Changes";
        indicator.classList.add("has-changes");
      }
    };

    descEditor.addEventListener("input", updateDesc);

    toolbar.addEventListener("click", (e) => {
      e.preventDefault();
      const btn = e.target.closest("button[data-cmd]");
      if (!btn) return;

      const cmd = btn.dataset.cmd;
      if (cmd === "createLink") {
        const url = prompt("Enter URL:", "https://");
        if (url) document.execCommand("createLink", false, url);
      } else if (cmd === "removeFormat") {
        document.execCommand("removeFormat", false, null);
      } else {
        document.execCommand(cmd, false, null);
      }
      descEditor.focus();
      updateDesc();
    });

    // Initial validation
    // Add required attribute to editor for validation logic to work
    descEditor.setAttribute("required", "true");
    updateValidation(descEditor);
  }

  // Formdaki diğer inputlara listener ekle
  form
    .querySelectorAll('input:not([type="hidden"]), textarea, select')
    .forEach((input) => {
      input.addEventListener("input", () => {
        updateValidation(input);
        // Değişiklik durumunu göster
        const indicator = document.querySelector(".status-indicator");
        if (indicator) {
          indicator.querySelector("span").textContent =
            "Unsaved Changes";
          indicator.classList.add("has-changes");
        }
      });
      // İlk yüklemede çalıştır
      updateValidation(input);
    });

  let currentPhotos = [...(listing.photos || [])];
  let newPhotos = [];

  // Fotoğraf silme
  photosGrid.addEventListener("click", (e) => {
    const removeBtn = e.target.closest(".remove-photo");
    if (removeBtn) {
      const index = parseInt(removeBtn.dataset.index);
      currentPhotos.splice(index, 1);
      updatePhotosGrid();
    }
  });

  // Yeni fotoğraf ekleme
  newPhotosInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    const totalPhotos = currentPhotos.length + newPhotos.length + files.length;

    if (totalPhotos > 10) {
      alert("You can add up to 10 photos");
      return;
    }

    // Dosyaları base64'e çevir (preview için)
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (event) => {
        newPhotos.push({
          file: file,
          preview: event.target.result,
        });
        updatePhotosGrid();
      };
      reader.readAsDataURL(file);
    }

    e.target.value = ""; // Input'u temizle
  });

  // Fotoğraf grid'ini güncelle ve Drag & Drop event'lerini bağla
  function updatePhotosGrid() {
    photosGrid.innerHTML = [
      ...currentPhotos.map(
        (photo, idx) => `
                <div class="photo-item" draggable="true" data-index="${idx}" data-type="current">
                    <img src="${photo}" alt="Photo ${idx + 1}">
                    <div class="photo-overlay">
                        <i class="fas fa-arrows-alt"></i>
                    </div>
                    <button type="button" class="remove-photo" data-index="${idx}">
                        <i class="fas fa-times"></i>
                    </button>
                    ${idx === 0 ? '<span class="photo-badge">Main Photo</span>' : ""}
                </div>
            `,
      ),
      ...newPhotos.map(
        (photo, idx) => `
                <div class="photo-item new-photo" draggable="true" data-new-index="${idx}" data-type="new">
                    <img src="${photo.preview}" alt="New Photo ${idx + 1}">
                    <div class="photo-overlay">
                        <i class="fas fa-arrows-alt"></i>
                    </div>
                    <button type="button" class="remove-new-photo" data-new-index="${idx}">
                        <i class="fas fa-times"></i>
                    </button>
                    <span class="photo-badge new">New</span>
                </div>
            `,
      ),
    ].join("");

    setupDragAndDrop();
  }

  // Drag & Drop Logic
  function setupDragAndDrop() {
    const items = photosGrid.querySelectorAll(".photo-item");
    let draggedItem = null;

    items.forEach((item) => {
      item.addEventListener("dragstart", (e) => {
        draggedItem = item;
        item.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });

      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
        draggedItem = null;
        photosGrid
          .querySelectorAll(".photo-item")
          .forEach((i) => i.classList.remove("drag-over"));
      });

      item.addEventListener("dragover", (e) => {
        e.preventDefault();
        item.classList.add("drag-over");
      });

      item.addEventListener("dragleave", () => {
        item.classList.remove("drag-over");
      });

      item.addEventListener("drop", (e) => {
        e.preventDefault();
        if (draggedItem === item) return;

        const allItems = Array.from(photosGrid.querySelectorAll(".photo-item"));
        const fromIdx = allItems.indexOf(draggedItem);
        const toIdx = allItems.indexOf(item);

        // Reorder logic (Combine both current and new photos for dragging)
        const combined = [
          ...currentPhotos.map((p) => ({ type: "current", val: p })),
          ...newPhotos.map((p) => ({ type: "new", val: p })),
        ];

        const [moved] = combined.splice(fromIdx, 1);
        combined.splice(toIdx, 0, moved);

        // Split back
        currentPhotos = combined
          .filter((p) => p.type === "current")
          .map((p) => p.val);
        newPhotos = combined.filter((p) => p.type === "new").map((p) => p.val);

        updatePhotosGrid();
        document
          .querySelector(".status-indicator")
          .classList.add("has-changes");
      });
    });
  }

  // Yeni fotoğraf silme
  photosGrid.addEventListener("click", (e) => {
    const removeBtn = e.target.closest(".remove-new-photo");
    if (removeBtn) {
      const index = parseInt(removeBtn.dataset.newIndex);
      newPhotos.splice(index, 1);
      updatePhotosGrid();
    }
  });

  // Form submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector(".btn-save");
    const originalText = submitBtn.innerHTML;

    // Loading state
    submitBtn.disabled = true;
    submitBtn.classList.add("loading");
    submitBtn.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            <span>Saving...</span>
        `;

    try {
      // Yeni fotoğrafları yükle
      const uploadedPhotos = [];
      if (newPhotos.length > 0) {
        submitBtn.innerHTML = `
                    <i class="fas fa-cloud-upload-alt"></i>
                    <span>Uploading photos... (${uploadedPhotos.length}/${newPhotos.length})</span>
                `;

        for (const photo of newPhotos) {
          try {
            const fileName = `${listing.id}/${Date.now()}_${photo.file.name}`;
            const { data, error } = await supabase.storage
              .from("listing-photos")
              .upload(fileName, photo.file);

            if (error) throw error;

            const {
              data: { publicUrl },
            } = supabase.storage.from("listing-photos").getPublicUrl(fileName);

            uploadedPhotos.push(publicUrl);

            // Progress update
            submitBtn.innerHTML = `
                            <i class="fas fa-cloud-upload-alt"></i>
                            <span>Uploading photos... (${uploadedPhotos.length}/${newPhotos.length})</span>
                        `;
          } catch (uploadError) {
            console.error("Photo upload error:", uploadError);
          }
        }
      }

      // Tüm fotoğrafları birleştir
      const allPhotos = [...currentPhotos, ...uploadedPhotos];

      // Form verilerini topla
      const formData = new FormData(form);
      const updates = {
        title: formData.get("title"),
        category: formData.get("category"),
        location: formData.get("location"),
        price: parseFloat(formData.get("price")),
        currency: formData.get("currency"),
        description: formData.get("description"),
        status: formData.get("status"),
        photos: allPhotos,
        updated_at: new Date().toISOString(),
      };

      // Veritabanını güncelle
      submitBtn.innerHTML = `
                <i class="fas fa-database"></i>
                <span>Saving...</span>
            `;

      // API'den import et
      const { updateListing } = await import("./api.js");
      await updateListing(listing.id, updates);

      // Success overlay göster
      showSuccessMessage();

      // Normal görünüme dön
      setTimeout(() => {
        window.location.href = `ilan-detay.html?id=${listing.id}`;
      }, 2000);
    } catch (error) {
      console.error("Update error:", error);
      submitBtn.classList.remove("loading");

      // Error notification
      if (typeof showNotification === "function") {
        showNotification("An error occurred while updating the listing", "error");
      } else {
        alert("An error occurred while updating the listing: " + error.message);
      }

      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });
}

/**
 * Success mesajı göster
 */
function showSuccessMessage() {
  const overlay = document.createElement("div");
  overlay.className = "success-overlay";
  overlay.innerHTML = `
        <div class="success-message">
            <i class="fas fa-check-circle"></i>
            <h3>Success!</h3>
            <p>Your listing has been updated successfully</p>
        </div>
    `;
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.style.opacity = "0";
    setTimeout(() => overlay.remove(), 300);
  }, 1500);
}

// Breadcrumb Navigation
function renderBreadcrumb(listing) {
  const breadcrumb = document.getElementById("breadcrumb-nav");
  if (!breadcrumb) return;

  const extra = listing.extra_fields || {};
  const category = listing.category_text || String(listing.category_id || '') || "Other";
  const breadcrumbItems = [];

  // Ana Sayfa zaten HTML'de var
  breadcrumbItems.push(`
        <a href="/" class="breadcrumb-item">
            <i class="fas fa-home"></i>
            Home
        </a>
    `);

  // Kategori
  if (category) {
    breadcrumbItems.push(`
            <span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>
            <a href="/?category=${encodeURIComponent(category)}" class="breadcrumb-item">
                ${category}
            </a>
        `);
  }

  // Vasıta kategorisinde daha detaylı breadcrumb
  const categoryLower = category.toLowerCase();
  if (
    categoryLower.includes("vasıta") ||
    categoryLower.includes("araba") ||
    categoryLower.includes("otomobil")
  ) {
    // Marka
    if (extra.brand || extra.marka) {
      const brand = extra.brand || extra.marka;
      breadcrumbItems.push(`
                <span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>
                <a href="/?category=${encodeURIComponent(category)}&brand=${encodeURIComponent(brand)}" class="breadcrumb-item">
                    ${brand}
                </a>
            `);
    }

    // Model
    if (extra.model) {
      breadcrumbItems.push(`
                <span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>
                <a href="/?category=${encodeURIComponent(category)}&brand=${encodeURIComponent(extra.brand || extra.marka || "")}&model=${encodeURIComponent(extra.model)}" class="breadcrumb-item">
                    ${extra.model}
                </a>
            `);
    }

    // Motor veya Yıl bilgisi
    if (extra.engine_size || extra.year) {
      const detail = extra.engine_size
        ? `${extra.engine_size}`
        : extra.year || extra.yıl;
      breadcrumbItems.push(`
                <span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>
                <span class="breadcrumb-item">${detail}</span>
            `);
    }
  } else {
    // Diğer kategoriler için basit breadcrumb
    if (listing.title && listing.title.length > 50) {
      breadcrumbItems.push(`
                <span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>
                <span class="breadcrumb-item">${listing.title.substring(0, 50)}...</span>
            `);
    } else if (listing.title) {
      breadcrumbItems.push(`
                <span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>
                <span class="breadcrumb-item">${listing.title}</span>
            `);
    }
  }

  breadcrumb.innerHTML = breadcrumbItems.join("");
}

// Reklam Banner Yükleme
async function loadAdBanner() {
  try {
    console.log("🎯 Banner yükleme başladı...");

    // Admin panelinden aktif reklam banner'ını çek
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .eq("setting_key", "detail_page_banner")
      .single();

    console.log("📊 Supabase yanıtı:", { data, error });

    const bannerSection = document.getElementById("ad-banner-section");
    const bannerImage = document.getElementById("ad-banner-image");
    const bannerLink = document.getElementById("ad-banner-link");
    const closeBtn = document.getElementById("ad-banner-close");

    if (!bannerSection) {
      console.error("❌ Banner section bulunamadı!");
      return;
    }

    // Eğer admin panelinden banner varsa onu kullan
    if (!error && data && data.setting_value) {
      const bannerData =
        typeof data.setting_value === "string"
          ? JSON.parse(data.setting_value)
          : data.setting_value;

      console.log("🎨 Banner data:", bannerData);
      console.log("✅ Banner aktif mi?", data.is_active);

      // Banner aktif mi kontrol et
      if (data.is_active && bannerData.image_url) {
        bannerImage.src = bannerData.image_url;
        bannerImage.alt = bannerData.alt_text || "Advertisement";

        if (bannerData.link_url) {
          bannerLink.href = bannerData.link_url;
        } else {
          bannerLink.style.cursor = "default";
          bannerLink.onclick = (e) => e.preventDefault();
        }

        console.log("✅ Banner yüklendi:", bannerData.image_url);
      } else {
        console.log("⚠️ Banner pasif veya görsel URL yok");
        // Banner pasif ise gösterme
        bannerSection.style.display = "none";
        return;
      }
    } else {
      console.log(
        "ℹ️ Admin panelinden banner bulunamadı, placeholder gösteriliyor",
      );
    }

    // LocalStorage kontrolünü geçici olarak kaldır - her zaman göster
    // Not: Kullanıcı deneyimi için daha sonra geri eklenebilir

    // Banner'ı göster
    bannerSection.style.display = "block";
    console.log("✅ Banner görünür hale getirildi");

    // Kapatma işlevi
    const handleCloseDetail = (e) => {
      e.preventDefault();
      e.stopPropagation();
      bannerSection.style.display = "none";
      console.log("❌ Banner kapatıldı");
    };

    closeBtn.addEventListener("click", handleCloseDetail);
    closeBtn.addEventListener("touchstart", handleCloseDetail, { passive: false });
  } catch (error) {
    console.error("❌ Reklam banner yükleme hatası:", error);
    // Hata olsa bile placeholder banner göster
    const bannerSection = document.getElementById("ad-banner-section");
    if (bannerSection) {
      bannerSection.style.display = "block";
      console.log("⚠️ Hata oldu ama placeholder gösteriliyor");
    }
  }
}

// Satıcı Değerlendirmesini Yükle
async function loadSellerRating(sellerId) {
  try {
    const { data: stats, error } = await supabase
      .from("seller_stats")
      .select("*")
      .eq("seller_id", sellerId)
      .single();

    if (error || !stats) {
      console.log("Seller stats not found");
      return;
    }

    // Ortalama rating'i göster
    const avgRating = parseFloat(stats.average_rating) || 0;
    document.getElementById("seller-avg-rating").textContent =
      avgRating > 0 ? avgRating.toFixed(1) : "-";

    // Yıldızları doldur
    const fullStars = Math.round(avgRating);
    const stars = document.querySelectorAll(".star-rating i");
    stars.forEach((star, index) => {
      if (index < fullStars) {
        star.classList.remove("empty");
      } else {
        star.classList.add("empty");
      }
    });

    // İstatistikleri göster
    document.getElementById("safe-purchases").textContent =
      stats.safe_purchase_count || "0";
    document.getElementById("total-ratings").textContent =
      stats.total_ratings || "0";

    // Yorumları göster butonu
    document.getElementById("see-reviews-btn").addEventListener("click", () => {
      showSellerReviews(sellerId);
    });
  } catch (error) {
    console.error("Error loading seller rating:", error);
  }
}

// Satıcı Yorumlarını Göster
async function showSellerReviews(sellerId) {
  try {
    const { data: reviews, error } = await supabase
      .from("seller_ratings")
      .select("*, profiles(*)")
      .eq("seller_id", sellerId)
      .eq("is_approved", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Modal aç
    let reviewsHtml = '<div class="reviews-modal">';
    reviewsHtml += '<h3 style="margin-bottom: 1rem;">Seller Reviews</h3>';

    if (!reviews || reviews.length === 0) {
      reviewsHtml += '<p style="color: #64748b;">No reviews yet</p>';
    } else {
      reviewsHtml += '<div style="max-height: 400px; overflow-y: auto;">';
      reviews.forEach((review) => {
        const stars = "⭐".repeat(review.rating);
        reviewsHtml += `
                    <div style="padding: 1rem; border-bottom: 1px solid #e5e7eb;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <strong>${review.profiles?.full_name || "Anonymous"}</strong>
                            <span>${stars}</span>
                        </div>
                        <p style="color: #64748b; font-size: 0.9rem;">${review.comment || "(No text provided)"}</p>
                        <small style="color: #94a3b8;">${new Date(review.created_at).toLocaleDateString("en-GB")}</small>
                    </div>
                `;
      });
      reviewsHtml += "</div>";
    }

    reviewsHtml += "</div>";

    // Simple alert yerine modal göster
    if (typeof Modal !== "undefined" && Modal.open) {
      Modal.open("Seller Reviews", reviewsHtml, [
        { label: "Close", action: "Modal.close()", class: "btn-secondary" },
      ]);
    } else {
      alert("Found " + (reviews?.length || 0) + " reviews");
    }
  } catch (error) {
    console.error("Error loading reviews:", error);
    alert("An error occurred while loading reviews");
  }
}

function subscribeListingRealtime(listingId) {
  if (!listingId) return;

  if (listingChannel) {
    supabase.removeChannel(listingChannel);
  }

  listingChannel = supabase
    .channel(`listing-detail-${listingId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "listings",
        filter: `id=eq.${listingId}`,
      },
      async (payload) => {
        const updated = payload.new;
        await renderListing(updated);
        initializeGallery(updated);
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log(`▶️ Realtime listening: listing ${listingId}`);
      }
    });

  window.addEventListener(
    "beforeunload",
    () => {
      if (listingChannel) {
        supabase.removeChannel(listingChannel);
        listingChannel = null;
      }
    },
    { once: true },
  );
}

// Satıcı adına tıklama işlevi
function initSellerProfileLink() {
  const sellerNameElements = [
    document.getElementById("seller-name"),
    document.getElementById("mobile-seller-name-preview")
  ];

  sellerNameElements.forEach(el => {
    if (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        const sellerId = this.dataset.sellerId;
        if (sellerId) {
          window.location.href = `/seller-profile.html?id=${sellerId}`;
        }
      });
    }
  });
}

// Minimal client-side sanitizer to remove dangerous elements/attributes before rendering.
// NOTE: This is a lightweight safeguard; server-side sanitization (e.g., DOMPurify on the server)
// is strongly recommended for production.
function sanitizeHtml(dirty) {
  if (!dirty || typeof dirty !== "string") return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(dirty, "text/html");

    // Remove dangerous elements entirely
    const forbiddenTags = [
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "link",
      "meta",
    ];
    forbiddenTags.forEach((tag) => {
      const nodes = doc.getElementsByTagName(tag);
      // Convert HTMLCollection to array to avoid live collection issues
      Array.from(nodes).forEach((n) => n.remove());
    });

    // Clean attributes: remove any attribute that starts with "on" (event handlers)
    // and strip javascript: from href/src attributes.
    const all = doc.getElementsByTagName("*");
    Array.from(all).forEach((el) => {
      // Sanitize attributes: remove event handlers, unsafe href/src, and restrict inline styles
      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const val = attr.value || "";
        if (name.startsWith("on")) {
          el.removeAttribute(attr.name);
          return;
        }
        if (name === "href" || name === "src") {
          const v = val.trim().toLowerCase();
          if (v.startsWith("javascript:") || v.startsWith("data:")) {
            el.removeAttribute(attr.name);
            return;
          }
        }
        if (name === "style") {
          // Only allow a very small set of safe CSS properties (e.g., text-align)
          const allowedStyles = ["text-align"];
          const kept = [];
          const parts = val.split(";");
          parts.forEach((p) => {
            const [prop, ...rest] = p.split(":");
            if (!prop) return;
            const propName = prop.trim().toLowerCase();
            if (allowedStyles.includes(propName)) {
              const propVal = rest.join(":").trim();
              // Basic normalization for text-align values
              if (propName === "text-align") {
                const v = propVal.replace(/\s+/g, "");
                if (["left", "right", "center", "justify"].includes(v)) {
                  kept.push(`${propName}: ${v}`);
                }
              } else {
                kept.push(`${propName}: ${propVal}`);
              }
            }
          });
          if (kept.length > 0) {
            el.setAttribute("style", kept.join("; "));
          } else {
            el.removeAttribute("style");
          }
        }
      });
    });

    return doc.body.innerHTML || "";
  } catch (e) {
    console.warn("sanitizeHtml error", e);
    return "";
  }
}

// Collapsible kartlar için işlev
function initCollapsibles() {
  // Collapse behavior removed; Technical Details and description sections remain expanded.
}

// Satıcı kartına "View Profile" linki ekle
function addViewProfileLink() {
  const sellerCard = document.querySelector(".seller-card");
  if (!sellerCard) return;

  const sellerName = sellerCard.querySelector("#seller-name");
  if (sellerName && sellerName.dataset.sellerId) {
    const existingLink = sellerCard.querySelector(".view-profile-link");
    if (!existingLink) {
      const link = document.createElement("a");
      link.href = `/seller-profile.html?id=${sellerName.dataset.sellerId}`;
      link.className = "view-profile-link";
      link.textContent = "View Profile";
      link.style.cssText =
        "font-size: 0.8rem; color: var(--primary); text-decoration: none; font-weight: 600; cursor: pointer; align-self: flex-end;";

      const infoText = sellerCard.querySelector(".seller-info-text");
      if (infoText) {
        infoText.appendChild(link);
      }
    }
  }
}

// Init'i çağırırken collapsibles ekle
const originalInit = window.initCollapsibles || function () {};
document.addEventListener("DOMContentLoaded", () => {
  initCollapsibles();
  addViewProfileLink();
});

// Dynamically loaded content için de çalışsın
const originalRenderListing = window.renderListing;
if (originalRenderListing) {
  window.renderListing = async function (listing) {
    await originalRenderListing.call(this, listing);
    setTimeout(() => {
      initCollapsibles();
      addViewProfileLink();
    }, 100);
  };
}

/**
 * Teknik Detayları Render Et
 */
function renderTechnicalDetails(listing) {
  // Veri kontrolü için log
  console.log(
    "🔍 renderTechnicalDetails çağrıldı. Extra:",
    listing.extra_fields,
  );

  const card = document.querySelector(".tech-details-card");
  const content = document.querySelector(".tech-details-content");

  if (!card || !content) {
    console.warn("⚠️ Technical details elementleri bulunamadı");
    return;
  }

  // Varsayılan olarak gizle
  card.style.display = "none";

  try {
    const extra = listing.extra_fields || {};
    const techs = extra.technical_details;

    if (!techs || (Array.isArray(techs) && techs.length === 0)) {
      console.log("ℹ️ Teknik detay verisi yok.");
      return;
    }

    // String ise parse et
    let detailsArray = [];
    if (typeof techs === "string") {
      try {
        detailsArray = JSON.parse(techs);
      } catch (e) {
        console.error("JSON parse hatası:", e);
        return;
      }
    } else if (Array.isArray(techs)) {
      detailsArray = techs;
    }

    if (detailsArray.length === 0) return;

    console.log("✅ Teknik detaylar render ediliyor:", detailsArray);

    // Kartı ve içeriği göster
    card.style.display = "block";
    content.style.display = "block"; // Varsayılan olarak açık olsun

    // İçeriği oluştur
    content.innerHTML = `
            <ul class="tech-details-list">
                ${detailsArray
                  .map(
                    (item) => `
                    <li>
                        <i class="fas fa-check-circle"></i>
                        <span>${escapeHtml(item)}</span>
                    </li>
                `,
                  )
                  .join("")}
            </ul>
        `;
  } catch (error) {
    console.error("Teknik detaylar yüklenirken hata:", error);
    card.style.display = "none";
  }
}
