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
  const image = photos[0] || "/assets/images/verde-logo-og.png";
  const url = window.location.href;
  const formattedPrice = new Intl.NumberFormat("tr-TR").format(listing.price);
  const currency = listing.currency === "TL" ? "₺" : listing.currency;
  const priceText = `${formattedPrice} ${currency}`;
  const title = listing.title || "İlan";
  const location = listing.location ? ` • ${listing.location}` : "";
  const descRaw =
    listing.description || `${title}${location} — Fiyat: ${priceText}`;
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
    content: url,
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
    console.error("Geçersiz veya eksik ilan ID değeri:", {
      rawId: urlParams.get("id"),
      listingIdParam: urlParams.get("listing_id") || urlParams.get("listingId"),
    });
    showError(
      "Geçersiz ilan bağlantısı. Lütfen geçerli bir ilan kartından tekrar deneyin.",
    );
    return;
  }

  try {
    const listing = await getListing(listingId);
    console.log("✅ İlan yüklendi:", listing);

    // Edit modunu kontrol et
    if (mode === "edit") {
      // Kullanıcı kendi ilanını mı düzenliyor kontrol et
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || user.id !== listing.user_id) {
        showError("Bu ilanı düzenleme yetkiniz yok");
        return;
      }
      renderEditForm(listing);
    } else {
      await renderListing(listing);
      updateSeoMeta(listing);
      await initializeFavoriteButton(listing.id);
      initializeActions(listing);
      initializeGallery(listing);
      subscribeListingRealtime(listing.id);

      // Soru-Cevap bölümünü başlat
      const { initQASection } = await import("./qa-system.js");
      await initQASection(listing.id, listing.user_id);
    }
  } catch (error) {
    console.error("İlan yüklenirken hata:", error);
    showError("İlan yüklenirken bir hata oluştu");
  }
}

async function renderListing(listing) {
  // Breadcrumb Navigation
  renderBreadcrumb(listing);

  // Fiyat
  const formattedPrice = new Intl.NumberFormat("tr-TR", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(listing.price);
  // Force Euro symbol
  const currency = "€";
  const priceText = `${currency}${formattedPrice}`;
  document.getElementById("detail-price").textContent = priceText;

  // Başlık + Premium Badge
  const titleEl = document.getElementById("detail-title");
  const titleContainer = titleEl.parentElement;
  titleEl.textContent = listing.title;

  // Premium badge ekle (eğer premium listing ise)
  if (listing.is_premium || listing.premium) {
    const badge = document.createElement("span");
    badge.className = "premium-badge";
    badge.textContent = "PREMIUM";
    titleContainer.insertBefore(badge, titleEl.nextSibling);
  }

  // MOBİL BAŞLIK KARTI
  const mobileTitleEl = document.getElementById("mobile-title");
  const mobilePriceEl = document.getElementById("mobile-price");
  const mobileLocationEl = document.getElementById("mobile-location");
  const mobilePostedEl = document.getElementById("mobile-posted");

  if (mobileTitleEl) {
    // Clear previous content
    mobileTitleEl.innerHTML = "";

    // Add title text
    mobileTitleEl.textContent = listing.title;

    // Add premium badge if applicable
    if (listing.is_premium || listing.premium) {
      const badgeSpan = document.createElement("span");
      badgeSpan.className = "premium-badge";
      badgeSpan.textContent = "PREMIUM";
      mobileTitleEl.after(badgeSpan);
    }

    mobilePriceEl.textContent = priceText;

    const locationSpan = mobileLocationEl.querySelector("span");
    if (locationSpan) {
      locationSpan.textContent = listing.location || "Belirtilmemiş";
    }

    // İlan tarihi
    if (mobilePostedEl) {
      const postedDate = new Date(listing.created_at);
      const now = new Date();
      const diffMinutes = Math.floor((now - postedDate) / (1000 * 60));
      let timeText = "";

      if (diffMinutes < 60) {
        timeText = `${diffMinutes} dakika önce`;
      } else if (diffMinutes < 1440) {
        const hours = Math.floor(diffMinutes / 60);
        timeText = `${hours} saat önce`;
      } else if (diffMinutes < 10080) {
        const days = Math.floor(diffMinutes / 1440);
        timeText = `${days} gün önce`;
      } else {
        timeText = postedDate.toLocaleDateString("tr-TR");
      }
      mobilePostedEl.textContent = `İlan ${timeText}`;
    }
  }

  // Meta Bilgileri - Daha detaylı gösterim (elemanlar opsiyonel olabilir)
  const locationEl = document.getElementById("detail-location");
  if (locationEl) {
    locationEl.textContent = listing.location || "Belirtilmemiş";
  } else {
    console.warn("detail-location öğesi bulunamadı, atlandı.");
  }

  const viewsEl = document.getElementById("detail-views");
  if (viewsEl) {
    const viewsCount = listing.views_count || 0;
    viewsEl.textContent = `${viewsCount} ${viewsCount === 1 ? "görüntülenme" : "görüntülenme"}`;
  } else {
    console.warn("detail-views öğesi bulunamadı, atlandı.");
  }

  // Açıklama - render edilmiş HTML göster (sanitize ile)
  const descriptionElement = document.getElementById("detail-description");
  const safeHtml =
    sanitizeHtml(listing.description) || "<p>Açıklama eklenmemiş</p>";
  if (descriptionElement) descriptionElement.innerHTML = safeHtml;

  // Galeri resimleri
  const mainImage = document.getElementById("main-image");
  if (listing.photos && listing.photos.length > 0) {
    mainImage.src = listing.photos[0];
    document.getElementById("current-image").textContent = "1";
    document.getElementById("total-images").textContent = listing.photos.length;

    // Thumbnail'ler
    const thumbnailsGrid = document.getElementById("thumbnails-grid");
    thumbnailsGrid.innerHTML = listing.photos
      .map(
        (photo, idx) => `
            <div class="gallery-thumbnail ${idx === 0 ? "active" : ""}" data-index="${idx}">
                <img src="${photo}" alt="Foto ${idx + 1}">
            </div>
        `,
      )
      .join("");
  } else {
    mainImage.src =
      "https://via.placeholder.com/800x600/10b981/ffffff?text=Fotoğraf+Yok";
    document.getElementById("current-image").textContent = "0";
    document.getElementById("total-images").textContent = "0";
  }

  // Özellikler Tablosu
  const specsTable = document.getElementById("specs-table");
  const specs = buildSpecsTable(listing);
  specsTable.innerHTML = specs;

  // Teknik Detayları Göster
  renderTechnicalDetails(listing);

  // ===== UNAUTHENTICATED USER PROTECTION (Satıcı Bilgilerini Koru) =====
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const sellerCard =
    document.getElementById("seller-card") ||
    document.querySelector(".seller-card");
  const isUnauthenticated = !user;

  if (isUnauthenticated && sellerCard) {
    console.log(
      "👤 Giriş yapmayan kullanıcı - Satıcı bilgileri blur yapılacak",
    );
    sellerCard.classList.add("blurred");

    // Login overlay oluştur
    const overlay = document.createElement("div");
    overlay.className = "seller-card-login-overlay";
    overlay.innerHTML = `
            <i class="fas fa-lock"></i>
            <p>Satıcı bilgilerini görmek için giriş yapmalısınız</p>
            <a href="login.html?redirect=${encodeURIComponent(window.location.href)}" class="btn-login">
                Giriş Yap
            </a>
        `;
    sellerCard.appendChild(overlay);
  }

  // Satıcı Bilgilerini Profil Tablosundan Çek
  try {
    const sellerProfile = await getProfile(listing.user_id);
    console.log("✅ Satıcı profili yüklendi:", sellerProfile);

    // Satıcı adı
    const sellerName = document.getElementById("seller-name");
    const fullSellerName =
      sellerProfile.full_name ||
      sellerProfile.username ||
      listing.user_email?.split("@")[0] ||
      "Satıcı";
    sellerName.textContent = fullSellerName;
    sellerName.dataset.sellerId = listing.user_id;

    // Satıcı avatarı
    const sellerAvatar = document.getElementById("seller-avatar");
    if (sellerProfile.avatar_url) {
      sellerAvatar.src = sellerProfile.avatar_url;
    } else {
      sellerAvatar.src = "assets/images/default-avatar.svg";
    }

    // Hata durumunda varsayılan görseli göster
    sellerAvatar.onerror = function () {
      this.src = "assets/images/default-avatar.svg";
    };

    // Satıcı istatistikleri
    const sellerStats = document.getElementById("seller-stats");
    const activeCountEl = document.getElementById("seller-active-count");
    const memberSinceEl = document.getElementById("seller-member-since");

    // Aktif ilan sayısını hesapla
    const { count: activeAdsCount } = await supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", listing.user_id)
      .eq("status", "active");

    // Üyelik tarihini formatla (örneğin "12 June 2026")
    let memberSince = "Tarih bilinmiyor";
    if (sellerProfile.created_at) {
      const createdDate = new Date(sellerProfile.created_at);
      memberSince = createdDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }

    if (sellerStats) {
      const responseRate = "95%"; // Bu değer gerçek mesajlaşma verilerinden hesaplanabilir
      sellerStats.textContent = `${activeAdsCount || 0} aktif ilan • ${memberSince} • ${responseRate} yanıt oranı`;
    }
    if (activeCountEl) activeCountEl.textContent = activeAdsCount || 0;
    if (memberSinceEl) memberSinceEl.textContent = memberSince;

    // Mobil minimal seller özetini güncelle
    const mobileSellerNameEl = document.getElementById("mobile-seller-name-preview");
    const mobileSellerDateEl = document.getElementById("mobile-seller-date-preview");
    if (mobileSellerNameEl) {
      mobileSellerNameEl.textContent = fullSellerName;
      mobileSellerNameEl.dataset.sellerId = listing.user_id;
    }
    if (mobileSellerDateEl) mobileSellerDateEl.textContent = memberSince;

    // Satıcı doğrulama durumu (eğer profile'da verified alanı varsa)
    if (sellerProfile.verified) {
      document.getElementById("seller-verified-badge").style.display = "flex";
    }
  } catch (error) {
    console.error("❌ Satıcı profili yüklenirken hata:", error);
    // Hata durumunda temel bilgileri göster
    const sellerName = document.getElementById("seller-name");
    sellerName.textContent = listing.user_email?.split("@")[0] || "Satıcı";
    const sellerStats = document.getElementById("seller-stats");
    const activeCountEl = document.getElementById("seller-active-count");
    const memberSinceEl = document.getElementById("seller-member-since");

    if (sellerStats)
      sellerStats.textContent = "0 aktif ilan • Yeni üye • 95% yanıt oranı";
    if (activeCountEl) activeCountEl.textContent = "0";
    if (memberSinceEl) memberSinceEl.textContent = "Yeni üye";

    // Mobil minimal seller özetini fallback için de güncelle
    const mobileSellerNameEl = document.getElementById("mobile-seller-name-preview");
    const mobileSellerDateEl = document.getElementById("mobile-seller-date-preview");
    if (mobileSellerNameEl) mobileSellerNameEl.textContent = sellerName.textContent;
    if (mobileSellerDateEl) mobileSellerDateEl.textContent = "Yeni üye";
  }

  // Satıcı Değerlendirmesini Yükle
  loadSellerRating(listing.user_id);

  // Değerlendirme Ekleme Butonunu Ayarla
  const addRatingBtn = document.getElementById("add-rating-btn");
  if (addRatingBtn && !addRatingBtn.dataset.bound) {
    // Kullanıcı giriş yapmışsa butonu göster
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && user.id !== listing.user_id) {
      addRatingBtn.style.display = "flex";
      addRatingBtn.addEventListener("click", () => {
        if (typeof showRatingForm !== "undefined") {
          showRatingForm(listing.id, listing.user_id);
        } else {
          console.error("showRatingForm function not found");
        }
      });
      addRatingBtn.dataset.bound = "true";
    }
  }

  // Sayfa başlığını güncelle
  document.title = `${listing.title} - VENDO`;

  // Satıcı adı tıklama işlevini başlat
  initSellerProfileLink();

  // Mobil Sekmeleri Başlat
  initializeMobileTabs();

  // Haritayı Başlat (Malta)
  import("./map-handler.js")
    .then((module) => {
      module.initSellerMap(listing.location);
    })
    .catch((err) => console.error("Harita yüklenemedi:", err));
}

function initializeMobileTabs() {
    const tabBtns = document.querySelectorAll('.ad-tab-btn');
    const tabContents = {
        'info': document.getElementById('tab-content-info'),
        'tech': document.getElementById('tab-content-tech'),
        'desc': document.getElementById('tab-content-desc'),
        'loc': document.getElementById('tab-content-loc'),
        'qa': document.getElementById('tab-content-qa')
    };

    if (!tabBtns.length || Object.values(tabContents).some(c => !c)) return;

    // Sadece mobil görünümdeyken tetiklenecek şekilde ayarla. Responsive tabiatı gereği
    const isMobile = window.innerWidth <= 768;
    
    // Varsayılan olarak sadece ilki gösterecek şekilde gizle
    if (isMobile) {
        tabContents['tech'].classList.add('mobile-hidden');
        tabContents['desc'].classList.add('mobile-hidden');
        tabContents['loc'].classList.add('mobile-hidden');
        tabContents['qa'].classList.add('mobile-hidden');
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');

            const target = e.currentTarget.dataset.target;
            Object.values(tabContents).forEach(content => {
                content.classList.add('mobile-hidden');
            });

            if (tabContents[target]) {
                tabContents[target].classList.remove('mobile-hidden');
            }
        });
    });
}

function showError(message) {
  // Sayfada farklı kapsayıcılar olabilir; uygun olanı seç
  const container =
    document.querySelector(".ad-container") ||
    document.querySelector(".ad-detail-page") ||
    document.querySelector(".ad-detail-container") ||
    document.querySelector("main") ||
    document.body;

  if (container) {
    container.innerHTML = `
            <div style="text-align: center; padding: 3rem;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger);"></i>
                <h2 style="margin-top: 1rem;">${message}</h2>
                <a href="index.html" class="btn-primary" style="margin-top: 1.5rem; display: inline-block; padding: 0.75rem 2rem; text-decoration: none;">
                    <i class="fas fa-home"></i> Ana Sayfaya Dön
                </a>
            </div>
        `;
  } else {
    alert(message);
  }
}

// Favori butonunu başlat ve mevcut durumu kontrol et
async function initializeFavoriteButton(listingId) {
  const favoriteBtn = document.getElementById("favorite-btn");
  if (!favoriteBtn) return;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return; // Giriş yapmamışsa varsayılan durumda kalır

    // Favori durumunu kontrol et
    const isInFavorites = await isFavorite(listingId);
    if (isInFavorites) {
      favoriteBtn.classList.add("active");
      const mobileFavBtn = document.getElementById("mobile-favorite-btn");
      if (mobileFavBtn) mobileFavBtn.classList.add("active");

      const icons = [
        favoriteBtn.querySelector("i"),
        mobileFavBtn?.querySelector("i"),
      ];

      icons.forEach((icon) => {
        if (icon) {
          icon.classList.remove("far");
          icon.classList.add("fas");
        }
      });
    }
  } catch (error) {
    console.error("Favori durumu kontrol hatası:", error);
  }
}

// Mesaj gönder ve telefon göster fonksiyonları
function initializeActions(listing) {
  const messageBtn = document.getElementById("message-btn");
  const phoneBtn = document.getElementById("phone-btn");
  const favoriteBtn = document.getElementById("favorite-btn");
  const mobileFavBtn = document.getElementById("mobile-favorite-btn");
  const mobileBackBtn = document.getElementById("mobile-back-btn");
  const mobileShareBtn = document.getElementById("mobile-share-btn");

  // Mobil Geri Butonu
  if (mobileBackBtn) {
    mobileBackBtn.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "index.html";
      }
    });
  }

  // Mobil Paylaş Butonu
  if (mobileShareBtn) {
    mobileShareBtn.addEventListener("click", async () => {
      try {
        if (navigator.share) {
          await navigator.share({
            title: listing.title,
            text: `${listing.title} - VENDO`,
            url: window.location.href,
          });
        } else {
          // Fallback: Copy to clipboard
          await navigator.clipboard.writeText(window.location.href);
          if (typeof showNotification === "function") {
            showNotification("Bağlantı kopyalandı", "success");
          } else {
            alert("Bağlantı kopyalandı");
          }
        }
      } catch (err) {
        console.error("Paylaşım hatası:", err);
      }
    });
  }

  // Favorileme (Ortak fonksiyon)
  const toggleFavorite = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      if (typeof showNotification === "function") {
        showNotification("Favorilere eklemek için giriş yapın", "warning");
      } else {
        alert("Favorilere eklemek için giriş yapın");
      }
      window.location.href = `login.html?redirect=${encodeURIComponent(window.location.href)}`;
      return;
    }

    try {
      const isFavorited = favoriteBtn.classList.contains("active");
      const icons = [
        favoriteBtn?.querySelector("i"),
        mobileFavBtn?.querySelector("i"),
      ];

      if (isFavorited) {
        await removeFromFavorites(listing.id);
        favoriteBtn.classList.remove("active");
        if (mobileFavBtn) mobileFavBtn.classList.remove("active");

        icons.forEach((icon) => {
          if (icon) {
            icon.classList.remove("fas");
            icon.classList.add("far");
          }
        });

        if (typeof showNotification === "function") {
          showNotification("Favorilerden çıkarıldı", "info");
        }
      } else {
        await addToFavorites(listing.id);
        favoriteBtn.classList.add("active");
        if (mobileFavBtn) mobileFavBtn.classList.add("active");

        icons.forEach((icon) => {
          if (icon) {
            icon.classList.remove("far");
            icon.classList.add("fas");
          }
        });

        if (typeof showNotification === "function") {
          showNotification("Favorilere eklendi", "success");
        }
      }
    } catch (error) {
      console.error("Favori işlemi hatası:", error);
      if (typeof showNotification === "function") {
        showNotification("Favori işlemi başarısız oldu", "error");
      }
    }
  };

  if (favoriteBtn) favoriteBtn.addEventListener("click", toggleFavorite);
  if (mobileFavBtn) mobileFavBtn.addEventListener("click", toggleFavorite);

  // Mesaj Gönder
  if (messageBtn) {
    messageBtn.addEventListener("click", async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (typeof showNotification === "function") {
          showNotification("Mesaj göndermek için giriş yapın", "warning");
        } else {
          alert("Mesaj göndermek için giriş yapın");
        }
        window.location.href = "login.html";
        return;
      }

      if (user.id === listing.user_id) {
        if (typeof showNotification === "function") {
          showNotification("Kendi ilanınıza mesaj gönderemezsiniz", "warning");
        } else {
          alert("Kendi ilanınıza mesaj gönderemezsiniz");
        }
        return;
      }

      window.location.href = `mesajlar.html?listing_id=${listing.id}&seller_id=${listing.user_id}`;
    });
  }

  // Telefon Numarası Göster
  if (phoneBtn) {
    phoneBtn.addEventListener("click", async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (typeof showNotification === "function") {
          showNotification(
            "Telefon numarasını görmek için giriş yapın",
            "warning",
          );
        } else {
          alert("Telefon numarasını görmek için giriş yapın");
        }
        window.location.href = "login.html";
        return;
      }

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", listing.user_id)
          .single();

        const phone = profile?.phone || "Telefon numarası eklenmemiş";
        phoneBtn.innerHTML = `<i class="fas fa-phone"></i><span>${phone}</span>`;
        phoneBtn.style.pointerEvents = "none";
        phoneBtn.style.opacity = "0.7";
      } catch (error) {
        console.error("Telefon alınamadı:", error);
        if (typeof showNotification === "function") {
          showNotification("Telefon numarası alınamadı", "error");
        } else {
          alert("Telefon numarası alınamadı");
        }
      }
    });
  }
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
  return date.toLocaleDateString("tr-TR", {
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
  const category = (listing.category || "").toLowerCase();

  console.log("🔍 Detay - Kategori (orijinal):", listing.category);
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
    specs.push(["Kimden", extra.kimden || "-"]);
    specs.push(["Model", extra.model || "-"]);
    specs.push(["Yıl", extra.yil || "-"]);
    specs.push([
      "KM",
      extra.kilometre
        ? (parseInt(extra.kilometre) || 0).toLocaleString("tr-TR")
        : "-",
    ]);
    specs.push(["Motor (cc)", extra.motor_hacmi || "-"]);
    specs.push(["Yakıt Tipi", extra.yakit || "-"]);
    specs.push(["Vites", extra.vites || "-"]);
    specs.push(["Çekiş", extra.cekis || "-"]);
    specs.push(["Kapı", extra.kapi || "-"]);
    specs.push(["Renk", extra.renk || "-"]);
    specs.push(["Klima", extra.klima || "-"]);
    specs.push(["Araç Durumu", extra.durum || "-"]);
    specs.push(["Garanti", extra.garanti || "-"]);
    specs.push(["Import", extra.import || "-"]);
    specs.push(["Takas", extra.takas || "-"]);
  } else if (
    category.includes("emlak") ||
    category.includes("konut") ||
    category.includes("ev") ||
    category.includes("daire") ||
    category.includes("villa")
  ) {
    // Temel Bilgiler
    specs.push(["Emlak Tipi", extra.property_type || extra.emlak_tipi || "-"]);
    specs.push([
      "İlan Tipi",
      extra.listing_type || extra.ilan_tipi || "Satılık",
    ]);
    specs.push([
      "Metrekare (Brüt)",
      extra.area || extra.metrekare
        ? `${extra.area || extra.metrekare} m²`
        : "-",
    ]);
    specs.push([
      "Metrekare (Net)",
      extra.net_area || extra.net_metrekare
        ? `${extra.net_area || extra.net_metrekare} m²`
        : "-",
    ]);

    // Oda ve Alan Detayları
    specs.push(["Oda Sayısı", extra.rooms || extra.oda_sayisi || "-"]);
    specs.push([
      "Salon Sayısı",
      extra.living_rooms || extra.salon_sayisi || "-",
    ]);
    specs.push(["Banyo Sayısı", extra.baths || extra.banyo_sayisi || "-"]);
    specs.push(["WC Sayısı", extra.wc_count || extra.wc_sayisi || "-"]);
    specs.push(["Balkon", extra.balcony || extra.balkon || "-"]);

    // Bina Bilgileri
    specs.push(["Kat", extra.floor || extra.kat || "-"]);
    specs.push(["Toplam Kat", extra.total_floors || extra.toplam_kat || "-"]);
    specs.push([
      "Bina Yaşı",
      extra.age || extra.yasi || extra.building_age
        ? `${extra.age || extra.yasi || extra.building_age} yıl`
        : "-",
    ]);
    specs.push([
      "Yapı Tipi",
      extra.construction_type || extra.yapi_tipi || "-",
    ]);
    specs.push([
      "Yapı Durumu",
      extra.building_status || extra.yapi_durumu || "-",
    ]);

    // Konfor ve Donanım
    specs.push(["Isıtma", extra.heating || extra.isitma || "-"]);
    specs.push(["Yakıt Tipi", extra.fuel_type || extra.yakit_tipi || "-"]);
    specs.push([
      "Kullanım Durumu",
      extra.usage_status || extra.kullanim_durumu || "-",
    ]);
    specs.push([
      "Mobilya",
      extra.furnished === true
        ? "Mobilyalı"
        : extra.furnished === false
          ? "Boş"
          : extra.mobilya || "-",
    ]);
    specs.push(["Eşya", extra.appliances || extra.esya || "-"]);

    // Cephe ve Manzara
    specs.push(["Cephe", extra.facade || extra.cephe || "-"]);
    specs.push(["Manzara", extra.view || extra.manzara || "-"]);

    // Özellikler
    if (extra.elevator)
      specs.push(["Asansör", extra.elevator === true ? "Var" : "Yok"]);
    if (extra.parking)
      specs.push(["Otopark", extra.parking === true ? "Var" : extra.parking]);
    if (extra.security)
      specs.push(["Güvenlik", extra.security === true ? "Var" : "Yok"]);
    if (extra.generator)
      specs.push(["Jeneratör", extra.generator === true ? "Var" : "Yok"]);
    if (extra.pool) specs.push(["Havuz", extra.pool === true ? "Var" : "Yok"]);
    if (extra.garden)
      specs.push(["Bahçe", extra.garden === true ? "Var" : "Yok"]);
    if (extra.terrace)
      specs.push(["Teras", extra.terrace === true ? "Var" : "Yok"]);
    if (extra.basement)
      specs.push(["Bodrum", extra.basement === true ? "Var" : "Yok"]);

    // Aidat ve Masraflar
    if (extra.dues) specs.push(["Aidat", `€${extra.dues}`]);
    if (extra.deed_status) specs.push(["Tapu Durumu", extra.deed_status]);
  } else if (
    category.includes("elektronik") ||
    category.includes("telefon") ||
    category.includes("bilgisayar") ||
    category.includes("tablet")
  ) {
    // Elektronik Ürünler
    specs.push(["Marka", extra.brand || extra.marka || "-"]);
    specs.push(["Model", extra.model || "-"]);
    specs.push(["Renk", extra.color || extra.renk || "-"]);
    specs.push(["Durumu", extra.condition || extra.durum || "İkinci El"]);
    specs.push([
      "Garanti",
      extra.warranty === true
        ? "Var"
        : extra.warranty === false
          ? "Yok"
          : extra.warranty || "-",
    ]);

    if (extra.memory || extra.hafiza)
      specs.push(["Hafıza", extra.memory || extra.hafiza]);
    if (extra.storage || extra.depolama)
      specs.push(["Depolama", extra.storage || extra.depolama]);
    if (extra.screen_size || extra.ekran_boyutu)
      specs.push(["Ekran Boyutu", extra.screen_size || extra.ekran_boyutu]);
    if (extra.ram) specs.push(["RAM", extra.ram]);
    if (extra.processor || extra.islemci)
      specs.push(["İşlemci", extra.processor || extra.islemci]);
    if (extra.graphics_card || extra.ekran_karti)
      specs.push(["Ekran Kartı", extra.graphics_card || extra.ekran_karti]);
  } else if (
    category.includes("mobilya") ||
    category.includes("ev eşyası") ||
    category.includes("beyaz eşya")
  ) {
    // Mobilya ve Ev Eşyası
    specs.push(["Ürün Tipi", extra.product_type || extra.urun_tipi || "-"]);
    specs.push(["Marka", extra.brand || extra.marka || "-"]);
    specs.push(["Durumu", extra.condition || extra.durum || "İkinci El"]);
    specs.push(["Renk", extra.color || extra.renk || "-"]);

    if (extra.material || extra.malzeme)
      specs.push(["Malzeme", extra.material || extra.malzeme]);
    if (extra.dimensions || extra.olculer)
      specs.push(["Ölçüler", extra.dimensions || extra.olculer]);
    if (extra.age || extra.yasi)
      specs.push(["Yaş", `${extra.age || extra.yasi} yıl`]);
    if (extra.energy_class || extra.enerji_sinifi)
      specs.push(["Enerji Sınıfı", extra.energy_class || extra.enerji_sinifi]);
  } else if (
    category.includes("giyim") ||
    category.includes("aksesuar") ||
    category.includes("ayakkabı")
  ) {
    // Giyim ve Aksesuar
    specs.push(["Ürün Tipi", extra.product_type || extra.urun_tipi || "-"]);
    specs.push(["Marka", extra.brand || extra.marka || "-"]);
    specs.push(["Beden", extra.size || extra.beden || "-"]);
    specs.push(["Renk", extra.color || extra.renk || "-"]);
    specs.push(["Durumu", extra.condition || extra.durum || "İkinci El"]);

    if (extra.material || extra.malzeme)
      specs.push(["Malzeme", extra.material || extra.malzeme]);
    if (extra.gender || extra.cinsiyet)
      specs.push(["Cinsiyet", extra.gender || extra.cinsiyet]);
    if (extra.season || extra.sezon)
      specs.push(["Sezon", extra.season || extra.sezon]);
  } else {
    // Diğer kategoriler için genel alanlar
    if (extra.brand || extra.marka)
      specs.push(["Marka", extra.brand || extra.marka]);
    if (extra.model) specs.push(["Model", extra.model]);
    if (extra.condition || extra.durum)
      specs.push(["Durumu", extra.condition || extra.durum]);
    if (extra.color || extra.renk)
      specs.push(["Renk", extra.color || extra.renk]);
    if (extra.size || extra.beden)
      specs.push(["Boyut/Beden", extra.size || extra.beden]);
    if (extra.material || extra.malzeme)
      specs.push(["Malzeme", extra.material || extra.malzeme]);
    if (extra.year || extra.yıl) specs.push(["Yıl", extra.year || extra.yıl]);
  }

  // Her zaman gösterilecekler - Sadece bir kez
  specs.unshift(["Kategori", listing.category || "-"]);
  specs.unshift(["İlan Tarihi", formatDate(listing.created_at)]);
  // Eğer DB'de atomik `listing_number` varsa onu göster, yoksa mevcut UUID özetini göster
  const publicListingNo =
    listing && (listing.listing_number || listing.listing_number === 0)
      ? String(listing.listing_number)
      : listing.id?.substring(0, 8)?.toUpperCase() || "-";
  specs.unshift(["İlan No", publicListingNo]);
  specs.push(["Konum", listing.location || "-"]);

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
    konum: "Konum",
    kimden: "Kimden",
    model: "Model",
    yil: "Yıl",
    kilometre: "KM",
    motor_hacmi: "Motor (cc)",
    yakit: "Yakıt Tipi",
    vites: "Vites",
    cekis: "Çekiş",
    kapi: "Kapı",
    renk: "Renk",
    klima: "Klima",
    durum: "Araç Durumu",
    garanti: "Garanti",
    import: "Import",
    takas: "Takas",
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
      if (label === "Yıl") icon = '<i class="fas fa-calendar"></i>';
      else if (label === "KM" || label === "kilometre")
        icon = '<i class="fas fa-road"></i>';
      else if (label === "Yakıt Tipi" || label === "Yakıt")
        icon = '<i class="fas fa-gas-pump"></i>';
      else if (label === "Vites") icon = '<i class="fas fa-cog"></i>';
      else if (label === "Model") icon = '<i class="fas fa-car"></i>';
      else if (label === "Motor (cc)") icon = '<i class="fas fa-engine"></i>';
      else if (label === "Kapı") icon = '<i class="fas fa-door-open"></i>';
      else if (label === "Çekiş") icon = '<i class="fas fa-grip"></i>';

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
  const mainImage = document.getElementById("main-image");

  // Tek fotoğraf varsa da lightbox ekle
  if (!listing.photos || listing.photos.length <= 1) {
    if (mainImage && listing.photos && listing.photos.length > 0) {
      mainImage.style.cursor = "pointer";
      mainImage.title = "Fotoğrafı büyütmek için tıklayın";
      mainImage.addEventListener("click", () => {
        openLightbox(listing.photos, 0);
      });
    }
    return;
  }

  let currentIndex = 0;
  const prevBtn = document.querySelector(".gallery-nav.prev");
  const nextBtn = document.querySelector(".gallery-nav.next");
  const currentImageEl = document.getElementById("current-image");

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
    mainImage.title = "Fotoğrafı büyütmek için tıklayın";
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
    thumb.title = "Fotoğrafı büyütmek için tıklayın";
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
    console.error("Lightbox elementi bulunamadı");
    return;
  }

  if (!photos || photos.length === 0) {
    console.error("Fotoğraf bulunamadı");
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
                    <span>İlanı Düzenle</span>
                </h1>
                <button class="btn-back" onclick="window.history.back()">
                    <i class="fas fa-arrow-left"></i>
                    <span>Geri</span>
                </button>
            </div>
            
            <form id="edit-listing-form" class="edit-form">
                <!-- Sol Kolon: Form Alanları -->
                <div class="form-left-column">
                    <!-- Bilgilendirme Kartı -->
                    <div class="info-banner">
                        <i class="fas fa-lightbulb"></i>
                        <div class="info-content">
                            <strong>İpucu:</strong>
                            <span>İlanınızı güncellerken açıklayıcı başlık ve detaylı açıklama kullanın. İlk fotoğraf ana görsel olarak kullanılacaktır.</span>
                        </div>
                    </div>
                    
                    <!-- Temel Bilgiler -->
                    <div class="form-section">
                        <h2>
                            <span class="section-number">1</span>
                            <i class="fas fa-info-circle"></i>
                            <span>Temel Bilgiler</span>
                        </h2>
                        <div class="form-grid">
                            <div class="form-group full-width">
                                <label for="edit-title">
                                    İlan Başlığı <span class="required">*</span>
                                </label>
                                <input type="text" id="edit-title" name="title" 
                                    value="${escapeHtml(listing.title)}" 
                                    required maxlength="100" 
                                    placeholder="Örn: Satılık 3+1 Daire">
                            </div>
                            
                            <div class="form-group">
                                <label for="edit-category">
                                    Kategori <span class="required">*</span>
                                </label>
                                <div class="category-visual">
                                    ${(listing.category || "")
                                      .split(">")
                                      .map(
                                        (c) =>
                                          `<span class="cat-chip">${c.trim()}</span>`,
                                      )
                                      .join(
                                        '<i class="fas fa-chevron-right" style="font-size: 0.7rem; color: var(--gray-300)"></i>',
                                      )}
                                </div>
                                <input type="hidden" id="edit-category" name="category" value="${escapeHtml(listing.category || "")}">
                            </div>
                            
                            <div class="form-group">
                                <label for="edit-location">
                                    <i class="fas fa-map-marker-alt"></i>
                                    Konum <span class="required">*</span>
                                </label>
                                <input type="text" id="edit-location" name="location" 
                                    value="${escapeHtml(listing.location || "")}" 
                                    required placeholder="Örn: Valletta, Malta">
                            </div>
                            
                            <div class="form-group">
                                <label for="edit-status">
                                    <i class="fas fa-toggle-on"></i>
                                    Durum
                                </label>
                                <select id="edit-status" name="status">
                                    <option value="active" ${listing.status === "active" ? "selected" : ""}>
                                        ✅ Aktif
                                    </option>
                                    <option value="inactive" ${listing.status === "inactive" ? "selected" : ""}>
                                        ⏸️ Pasif
                                    </option>
                                    <option value="sold" ${listing.status === "sold" ? "selected" : ""}>
                                        ✔️ Satıldı
                                    </option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="edit-price">
                                    <i class="fas fa-tag"></i>
                                    Fiyat (€) <span class="required">*</span>
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
                                    Açıklama <span class="required">*</span>
                                </label>
                                <div class="rich-text-toolbar" id="rteToolbar">
                                    <button type="button" data-cmd="bold" title="Kalın (Ctrl+B)"><i class="fas fa-bold"></i></button>
                                    <button type="button" data-cmd="italic" title="İtalik (Ctrl+I)"><i class="fas fa-italic"></i></button>
                                    <button type="button" data-cmd="underline" title="Altı çizili"><i class="fas fa-underline"></i></button>
                                    <button type="button" data-cmd="insertUnorderedList" title="Madde İşareti"><i class="fas fa-list-ul"></i></button>
                                    <button type="button" data-cmd="insertOrderedList" title="Numaralandırma"><i class="fas fa-list-ol"></i></button>
                                    <button type="button" data-cmd="justifyLeft" title="Sola Hizala"><i class="fas fa-align-left"></i></button>
                                    <button type="button" data-cmd="justifyCenter" title="Ortala"><i class="fas fa-align-center"></i></button>
                                    <button type="button" data-cmd="justifyRight" title="Sağa Hizala"><i class="fas fa-align-right"></i></button>
                                    <button type="button" data-cmd="createLink" title="Link ekle"><i class="fas fa-link"></i></button>
                                    <button type="button" data-cmd="removeFormat" title="Biçimi temizle"><i class="fas fa-eraser"></i></button>
                                </div>
                                
                                <div id="edit-description-editor" class="form-textarea rich-text-editor" contenteditable="true" 
                                    style="border-top-left-radius: 0; border-top-right-radius: 0; min-height: 200px; overflow-y: auto;"
                                    placeholder="İlanınız hakkında detaylı bilgi verin...">${listing.description || ""}</div>
                                
                                <input type="hidden" id="edit-description" name="description" value="${escapeHtml(listing.description || "")}">

                                <div class="desc-footer">
                                    <span class="validation-msg"></span>
                                    <span class="char-counter">
                                        <span id="desc-count">0</span> / 2000 karakter
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
                            <span>Değişiklikler Kaydedilmedi</span>
                        </div>
                        <div class="buttons">
                            <button type="button" class="btn-cancel" onclick="window.history.back()">
                                <span>İptal</span>
                            </button>
                            <button type="submit" form="edit-listing-form" class="btn-save">
                                <i class="fas fa-check"></i>
                                <span>Kaydet</span>
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
                            <span>Fotoğraflar</span>
                        </h2>
                        <div class="photos-manager" id="photos-manager">
                            <div class="photos-grid" id="photos-grid">
                                ${(listing.photos || [])
                                  .map(
                                    (photo, idx) => `
                                    <div class="photo-item" data-index="${idx}">
                                        <img src="${photo}" alt="Foto ${idx + 1}">
                                        <button type="button" class="remove-photo" data-index="${idx}">
                                            <i class="fas fa-times"></i>
                                        </button>
                                        ${idx === 0 ? '<span class="photo-badge">Ana Fotoğraf</span>' : ""}
                                    </div>
                                `,
                                  )
                                  .join("")}
                            </div>
                            <div class="add-photo-section" onclick="document.getElementById('new-photos').click()">
                                <input type="file" id="new-photos" accept="image/*" multiple style="display: none;">
                                <button type="button" class="btn-add-photo">
                                    <i class="fas fa-plus-circle"></i>
                                    <span>Fotoğraf Ekle</span>
                                </button>
                                <p class="help-text">
                                    En fazla <strong>10 fotoğraf</strong> ekleyebilirsiniz.<br>
                                    İlk fotoğraf ana fotoğraf olacaktır.
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
          "Değişiklikler Kaydedilmedi";
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
        const url = prompt("URL bağlantısını girin:", "https://");
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
            "Değişiklikler Kaydedilmedi";
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
      alert("En fazla 10 fotoğraf ekleyebilirsiniz");
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
                    <img src="${photo}" alt="Foto ${idx + 1}">
                    <div class="photo-overlay">
                        <i class="fas fa-arrows-alt"></i>
                    </div>
                    <button type="button" class="remove-photo" data-index="${idx}">
                        <i class="fas fa-times"></i>
                    </button>
                    ${idx === 0 ? '<span class="photo-badge">Ana Fotoğraf</span>' : ""}
                </div>
            `,
      ),
      ...newPhotos.map(
        (photo, idx) => `
                <div class="photo-item new-photo" draggable="true" data-new-index="${idx}" data-type="new">
                    <img src="${photo.preview}" alt="Yeni Foto ${idx + 1}">
                    <div class="photo-overlay">
                        <i class="fas fa-arrows-alt"></i>
                    </div>
                    <button type="button" class="remove-new-photo" data-new-index="${idx}">
                        <i class="fas fa-times"></i>
                    </button>
                    <span class="photo-badge new">Yeni</span>
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
            <span>Kaydediliyor...</span>
        `;

    try {
      // Yeni fotoğrafları yükle
      const uploadedPhotos = [];
      if (newPhotos.length > 0) {
        submitBtn.innerHTML = `
                    <i class="fas fa-cloud-upload-alt"></i>
                    <span>Fotoğraflar yükleniyor... (${uploadedPhotos.length}/${newPhotos.length})</span>
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
                            <span>Fotoğraflar yükleniyor... (${uploadedPhotos.length}/${newPhotos.length})</span>
                        `;
          } catch (uploadError) {
            console.error("Fotoğraf yükleme hatası:", uploadError);
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
                <span>Kaydediliyor...</span>
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
      console.error("Güncelleme hatası:", error);
      submitBtn.classList.remove("loading");

      // Error notification
      if (typeof showNotification === "function") {
        showNotification("İlan güncellenirken bir hata oluştu", "error");
      } else {
        alert("İlan güncellenirken bir hata oluştu: " + error.message);
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
            <h3>Başarılı!</h3>
            <p>İlanınız başarıyla güncellendi</p>
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
  const category = listing.category || "Diğer";
  const breadcrumbItems = [];

  // Ana Sayfa zaten HTML'de var
  breadcrumbItems.push(`
        <a href="index.html" class="breadcrumb-item">
            <i class="fas fa-home"></i>
            Ana Sayfa
        </a>
    `);

  // Kategori
  if (category) {
    breadcrumbItems.push(`
            <span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>
            <a href="index.html?category=${encodeURIComponent(category)}" class="breadcrumb-item">
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
                <a href="index.html?category=${encodeURIComponent(category)}&brand=${encodeURIComponent(brand)}" class="breadcrumb-item">
                    ${brand}
                </a>
            `);
    }

    // Model
    if (extra.model) {
      breadcrumbItems.push(`
                <span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>
                <a href="index.html?category=${encodeURIComponent(category)}&brand=${encodeURIComponent(extra.brand || extra.marka || "")}&model=${encodeURIComponent(extra.model)}" class="breadcrumb-item">
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
        bannerImage.alt = bannerData.alt_text || "Reklam";

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
      console.log("Satıcı istatistikleri bulunamadı");
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
    console.error("Satıcı değerlendirmesi yüklenirken hata:", error);
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
    reviewsHtml += '<h3 style="margin-bottom: 1rem;">Satıcı Yorumları</h3>';

    if (!reviews || reviews.length === 0) {
      reviewsHtml += '<p style="color: #64748b;">Henüz yorum yapılmamış</p>';
    } else {
      reviewsHtml += '<div style="max-height: 400px; overflow-y: auto;">';
      reviews.forEach((review) => {
        const stars = "⭐".repeat(review.rating);
        reviewsHtml += `
                    <div style="padding: 1rem; border-bottom: 1px solid #e5e7eb;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <strong>${review.profiles?.full_name || "Anonim"}</strong>
                            <span>${stars}</span>
                        </div>
                        <p style="color: #64748b; font-size: 0.9rem;">${review.comment || "(Yorum yazılmamış)"}</p>
                        <small style="color: #94a3b8;">${new Date(review.created_at).toLocaleDateString("tr-TR")}</small>
                    </div>
                `;
      });
      reviewsHtml += "</div>";
    }

    reviewsHtml += "</div>";

    // Simple alert yerine modal göster
    if (typeof Modal !== "undefined" && Modal.open) {
      Modal.open("Satıcı Yorumları", reviewsHtml, [
        { label: "Kapat", action: "Modal.close()", class: "btn-secondary" },
      ]);
    } else {
      alert("Toplam " + (reviews?.length || 0) + " yorum bulundu");
    }
  } catch (error) {
    console.error("Yorumlar yüklenirken hata:", error);
    alert("Yorumlar yüklenirken bir hata oluştu");
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
        console.log(`▶️ Realtime dinleniyor: listing ${listingId}`);
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
  document
    .querySelectorAll(".description-card .card-title")
    .forEach((title) => {
      title.addEventListener("click", function () {
        const card = this.closest(".description-card");
        const content = card.querySelector(
          ".tech-details-content, .description-text",
        );

        if (content && content.style.display === "none") {
          content.style.display = "block";
          this.classList.remove("collapsed");
        } else if (content) {
          content.style.display = "none";
          this.classList.add("collapsed");
        }
      });
    });
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
