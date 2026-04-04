// ============================================
// MODERN ADMIN PANEL - UPGRADED & FEATURED
// ============================================

// Toast Notification System
const Toast = {
  show(message, type = "info", duration = 3000) {
    if (!document.getElementById("toast-container")) {
      const container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const icons = {
      success: "fas fa-check-circle",
      error: "fas fa-exclamation-circle",
      info: "fas fa-info-circle",
      warning: "fas fa-warning",
    };

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
            <i class="${icons[type]}"></i>
            <span>${message}</span>
        `;

    document.getElementById("toast-container").appendChild(toast);

    if (duration) {
      setTimeout(() => toast.remove(), duration);
    }

    return toast;
  },
};

// Modal System
const Modal = {
  open(title, content, buttons = [], isFullScreen = false) {
    if (!document.getElementById("modal-overlay")) {
      const overlay = document.createElement("div");
      overlay.id = "modal-overlay";
      overlay.className = "modal-overlay";
      overlay.innerHTML = '<div id="modal-dialog" class="modal-dialog"></div>';
      document.body.appendChild(overlay);
    }

    const dialog = document.getElementById("modal-dialog");
    // Reset classes and add fullscreen if requested
    dialog.className = "modal-dialog" + (isFullScreen ? " fullscreen" : "");
    dialog.innerHTML = `
            <div class="modal-header">
                <h2 style="margin: 0;">${title}</h2>
                <button class="modal-close" onclick="Modal.close()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
            ${
              buttons.length > 0
                ? `
                <div class="modal-footer">
                    ${buttons
                      .map(
                        (btn) => `
                        <button class="btn ${btn.class || "btn-primary"}" onclick="${btn.action}">
                            ${btn.label}
                        </button>
                    `,
                      )
                      .join("")}
                </div>
            `
                : ""
            }
        `;

    document.getElementById("modal-overlay").classList.add("active");
  },

  close() {
    const overlay = document.getElementById("modal-overlay");
    if (overlay) overlay.classList.remove("active");
  },

  switchTab(tabId) {
    // Update tab buttons
    document.querySelectorAll(".modal-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });
    // Update tab panes
    document.querySelectorAll(".tab-pane").forEach((pane) => {
      pane.classList.toggle("active", pane.id === tabId);
    });
  },
};

// Activity Logger
const ActivityLogger = {
  async log(action, target, details = "") {
    try {
      await window.supabase.from("admin_logs").insert({
        admin_id: adminPanel.user.id,
        action,
        target,
        details,
        ip_address: await this.getIP(),
        created_at: new Date(),
      });
    } catch (error) {
      console.error("Activity log error:", error);
    }
  },

  async getIP() {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      const data = await response.json();
      return data.ip;
    } catch {
      return "unknown";
    }
  },
};

// Main Admin Panel

const adminPanel = {
  user: null,
  charts: {},
  cache: {},
  categories: [],
  selectedLevel1Id: null,
  selectedLevel2Id: null,
  selectedLevel3Id: null,

  async init() {
    try {
      // Check authentication
      const {
        data: { user },
      } = await window.supabase.auth.getUser();
      if (!user) {
        window.location.href = "./login.html";
        return;
      }

      // Verify admin status
      const { data: profile } = await window.supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_admin) {
        window.location.href = "../login.html";
        return;
      }

      this.user = user;
      document.getElementById("admin-username").textContent =
        user.email || "Admin";

      // Initialize UI
      this.initUI();
      this.loadDashboard();
      this.setupTheme();
    } catch (error) {
      console.error("Init error:", error);
      window.location.href = "./login.html";
    }
  },

  initUI() {
    // Sidebar navigation
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        document
          .querySelectorAll(".nav-item")
          .forEach((i) => i.classList.remove("active"));
        document
          .querySelectorAll(".section-content")
          .forEach((s) => s.classList.remove("active"));

        item.classList.add("active");
        const section = item.dataset.section;
        document.getElementById(`${section}-section`)?.classList.add("active");

        if (section !== "dashboard") {
          this.loadSection(section);
        }
      });
    });

    // Logout
    document
      .getElementById("logout-btn")
      .addEventListener("click", async () => {
        await window.supabase.auth.signOut();
        window.location.href = "../login.html";
      });

    // Theme toggle
    document.getElementById("theme-toggle").addEventListener("click", () => {
      const theme = document.documentElement.getAttribute("data-theme");
      const newTheme = theme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("admin-theme", newTheme);
      document.querySelector("#theme-toggle i").className =
        newTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
    });

    // Restore saved theme
    const savedTheme = localStorage.getItem("admin-theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    document.querySelector("#theme-toggle i").className =
      savedTheme === "dark" ? "fas fa-sun" : "fas fa-moon";
  },

  async loadSection(section) {
    switch (section) {
      case "users":
        await this.loadUsers();
        break;
      case "listings":
        await this.loadListings();
        break;
      case "messages":
        await this.loadMessages();
        break;
      case "categories":
        await this.loadCategories();
        break;
      case "user-stats":
        await this.loadUserStatistics();
        break;
      case "analytics":
        await this.loadAnalytics();
        break;
      case "system-health":
        await this.loadSystemHealth();
        break;
      case "automation":
        await this.loadAutomation();
        break;
      case "activity":
        await this.loadActivityLog();
        break;
      case "reports":
        await this.loadReports();
        break;
    }
  },

  async loadDashboard() {
    try {
      // Fetch stats
      const { count: userCount } = await window.supabase
        .from("profiles")
        .select("*", { count: "exact" });

      const { count: listingCount } = await window.supabase
        .from("listings")
        .select("*", { count: "exact" })
        .eq("status", "active");

      const { count: messageCount } = await window.supabase
        .from("messages")
        .select("*", { count: "exact" });

      const { count: reportCount } = await window.supabase
        .from("reports")
        .select("*", { count: "exact" });

      // Pending listings count
      const { count: pendingCount } = await window.supabase
        .from("listings")
        .select("*", { count: "exact" })
        .eq("status", "pending");

      // Today's new users
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: newUsersToday } = await window.supabase
        .from("profiles")
        .select("*", { count: "exact" })
        .gte("created_at", today.toISOString());

      // Update UI
      document.getElementById("stat-users").textContent = userCount || 0;
      document.getElementById("stat-listings").textContent = listingCount || 0;
      document.getElementById("stat-messages").textContent = messageCount || 0;
      document.getElementById("stat-reports").textContent = reportCount || 0;
      document.getElementById("stat-pending-listings").textContent =
        pendingCount || 0;
      document.getElementById("stat-new-users-today").textContent =
        newUsersToday || 0;

      // Initialize drag and drop
      this.initDragAndDrop();

      // Load saved layout
      this.loadDashboardLayout();

      // Create charts
      await this.createUserGrowthChart();
      await this.createCategoryChart();
    } catch (error) {
      console.error("Dashboard load error:", error);
    }
  },

  async loadReports() {
    try {
      const tbody = document.getElementById("reports-table-body");
      const warning = document.getElementById("reports-source-warning");

      // 1. Try Supabase
      const { data: reports, error } = await window.supabase
        .from("reports")
        .select("*, reporter:reporter_id(email), reported:reported_id(email)")
        .order("created_at", { ascending: false });

      let finalReports = reports;

      if (error) {
        console.warn("Reports DB fetch error:", error);
        // 2. Fallback LocalStorage
        finalReports = JSON.parse(
          localStorage.getItem("reports_backup") || "[]",
        );
        if (warning) warning.style.display = "block";
      } else {
        if (warning) warning.style.display = "none";
      }

      // Filter
      const filter = document.getElementById("reports-filter")?.value;
      if (filter) {
        finalReports = finalReports.filter((r) => r.status === filter);
      }

      if (!finalReports || finalReports.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="8" style="text-align: center; padding: 20px;">Rapor bulunamadı</td></tr>';
        return;
      }

      tbody.innerHTML = finalReports
        .map((report) => {
          const reporter =
            report.reporter?.email ||
            report.email ||
            report.reporter_id ||
            "Anonim";
          const reported = report.reported?.email || report.reported_id || "Sistem";
          const typeLabel = report.report_type === 'message' ? '<i class="fas fa-comment"></i> Mesaj' : '<i class="fas fa-tag"></i> İlan';
          const typeClass = report.report_type === 'message' ? 'badge-info' : 'badge-primary';
          const listingNo = report.listing_id ? report.listing_id.substring(0, 8).toUpperCase() : '-';

          return `
                    <tr>
                        <td>${new Date(report.created_at).toLocaleDateString("tr-TR")} ${new Date(report.created_at).toLocaleTimeString("tr-TR")}</td>
                        <td><span class="badge ${typeClass}">${typeLabel}</span></td>
                        <td style="font-family: monospace; font-weight: bold; color: var(--primary);">${listingNo}</td>
                        <td>${reporter}</td>
                        <td>${reported}</td>
                        <td>${report.reason}</td>
                        <td><span class="badge ${report.status === "pending" ? "warning" : "success"}">${report.status}</span></td>
                        <td>
                            <button class="btn btn-small btn-primary" onclick="adminPanel.viewReportDetail('${report.id}')" title="Detaylar"><i class="fas fa-eye"></i></button>
                            <button class="btn btn-small btn-success" onclick="adminPanel.updateReportStatus('${report.id}', 'resolved')" title="Çözüldü"><i class="fas fa-check"></i></button>
                        </td>
                    </tr>
                `;
        })
        .join("");
    } catch (error) {
      console.error("Reports load error:", error);
    }
  },

  async viewReportDetail(reportId) {
    try {
      const { data: report, error } = await window.supabase
        .from("reports")
        .select("*, reporter:reporter_id(email, full_name), reported:reported_id(email, full_name)")
        .eq("id", reportId)
        .single();

      if (error) throw error;

      const listingNo = report.listing_id ? report.listing_id.substring(0, 8).toUpperCase() : 'N/A';

      const content = `
        <div class="report-detail">
            <p><strong>İlan No:</strong> <span style="font-family: monospace; font-weight: bold;">${listingNo}</span></p>
            <p><strong>Rapor Eden:</strong> ${report.reporter?.full_name || 'Anonim'} (${report.reporter?.email || report.email || 'N/A'})</p>
            <p><strong>Şikayet Edilen:</strong> ${report.reported?.full_name || 'Sistem'} (${report.reported?.email || 'N/A'})</p>
            <p><strong>Tür:</strong> ${report.report_type || 'Bilinmiyor'}</p>
            <p><strong>Sebep:</strong> ${report.reason}</p>
            <hr>
            <p><strong>Açıklama:</strong></p>
            <div class="well">${report.description || 'Açıklama yok'}</div>
            ${report.listing_id ? `<button class="btn btn-info" style="margin-top:10px" onclick="adminPanel.editListing('${report.listing_id}')">İlanı İncele</button>` : ''}
        </div>
      `;

      Modal.open("Rapor Detayı", content, [
        { label: "Kapat", class: "btn-secondary", action: "Modal.close()" },
        { label: "Çözüldü İşaretle", class: "btn-success", action: `adminPanel.updateReportStatus('${reportId}', 'resolved')` }
      ]);
    } catch (error) {
      Toast.show("Detaylar yüklenemedi: " + error.message, "error");
    }
  },

  async updateReportStatus(reportId, status) {
    try {
      const { error } = await window.supabase
        .from("reports")
        .update({ status, updated_at: new Date() })
        .eq("id", reportId);

      if (error) throw error;
      Toast.show("Rapor durumu güncellendi", "success");
      Modal.close();
      this.loadReports();
    } catch (error) {
      Toast.show("Hata: " + error.message, "error");
    }
  },

  async loadUsers() {
    try {
      const { data: users, error } = await window.supabase
        .from("profiles")
        .select("id, email, full_name, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Calculate stats
      const totalUsers = users?.length || 0;
      const activeUsers = totalUsers;
      const blockedUsers = 0;
      const thisMonth = new Date();
      thisMonth.setMonth(thisMonth.getMonth() - 1);
      const newUsers =
        users?.filter((u) => new Date(u.created_at) > thisMonth).length || 0;

      // Update stats
      document.getElementById("total-users").textContent = totalUsers;
      document.getElementById("active-users").textContent = activeUsers;
      document.getElementById("new-users").textContent = newUsers;
      document.getElementById("blocked-users").textContent = blockedUsers;

      // Render table
      const tbody = document.getElementById("users-table-body");
      const itemsPerPage = 15;
      let currentPage = 1;
      const totalPages = Math.ceil(totalUsers / itemsPerPage);

      const renderPage = (page) => {
        const start = (page - 1) * itemsPerPage;
        const pageUsers = users.slice(start, start + itemsPerPage);

        tbody.innerHTML =
          pageUsers
            .map(
              (user, idx) => `
                    <tr data-user-id="${user.id}">
                        <td onclick="event.stopPropagation()">
                            <input type="checkbox" class="user-checkbox" data-user-id="${user.id}" onchange="adminPanel.updateBulkActions()">
                        </td>
                        <td>${user.email}</td>
                        <td>${user.full_name || "-"}</td>
                        <td>
                            <span class="badge success">
                                Aktif
                            </span>
                        </td>
                        <td>-</td>
                        <td>${new Date(user.created_at).toLocaleDateString("tr-TR")}</td>
                        <td onclick="event.stopPropagation()">
                            <button class="btn btn-small btn-primary" onclick="adminPanel.viewUserDetail('${user.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-small btn-info" onclick="adminPanel.editUser('${user.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-small btn-danger" onclick="adminPanel.deleteUser('${user.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `,
            )
            .join("") ||
          '<tr><td colspan="7" style="text-align: center; padding: 20px;">Kullanıcı bulunamadı</td></tr>';

        // Add pagination
        const paginationHTML =
          totalPages > 1
            ? `
                    <tr>
                        <td colspan="7">
                            <div class="pagination">
                                <button class="pagination-btn" onclick="adminPanel.renderUsersPage(${currentPage - 1})" ${currentPage === 1 ? "disabled" : ""}>
                                    <i class="fas fa-chevron-left"></i>
                                </button>
                                ${Array.from(
                                  { length: Math.min(totalPages, 5) },
                                  (_, i) => {
                                    const pageNum = currentPage - 2 + i;
                                    if (pageNum > 0 && pageNum <= totalPages) {
                                      return `<button class="pagination-btn ${pageNum === currentPage ? "active" : ""}" onclick="adminPanel.renderUsersPage(${pageNum})">${pageNum}</button>`;
                                    }
                                    return "";
                                  },
                                ).join("")}
                                <button class="pagination-btn" onclick="adminPanel.renderUsersPage(${currentPage + 1})" ${currentPage === totalPages ? "disabled" : ""}>
                                    <i class="fas fa-chevron-right"></i>
                                </button>
                                <span class="pagination-info">Sayfa ${currentPage} / ${totalPages}</span>
                            </div>
                        </td>
                    </tr>
                `
            : "";

        if (paginationHTML) {
          tbody.insertAdjacentHTML("afterend", paginationHTML);
        }
      };

      adminPanel.renderUsersPage = (page) => {
        currentPage = Math.max(1, Math.min(page, totalPages));
        document.querySelectorAll(".pagination").forEach((p) => p.remove());
        renderPage(currentPage);
      };

      renderPage(currentPage);

      // Filter
      document
        .getElementById("users-filter")
        ?.addEventListener("change", (e) => {
          const status = e.target.value;
          document.querySelectorAll("#users-table-body tr").forEach((row) => {
            if (!status) {
              row.style.display = "";
            } else {
              const visible = status === "active";
              row.style.display = visible ? "" : "none";
            }
          });
        });

      // Search
      document
        .getElementById("users-search")
        ?.addEventListener("input", (e) => {
          const search = e.target.value.toLowerCase();
          document.querySelectorAll("#users-table-body tr").forEach((row) => {
            const visible = row.textContent.toLowerCase().includes(search);
            row.style.display = visible ? "" : "none";
          });
        });

      // Select all checkbox
      document
        .getElementById("select-all-checkbox")
        ?.addEventListener("change", (e) => {
          document.querySelectorAll(".user-checkbox").forEach((cb) => {
            cb.checked = e.target.checked;
          });
          adminPanel.updateBulkActions();
        });
    } catch (error) {
      console.error("Users load error:", error);
      Toast.show(
        "Kullanıcılar yüklenirken hata oluştu: " + error.message,
        "error",
      );
    }
  },

  async loadListings() {
    try {
      const { data: listings, error } = await window.supabase
        .from("listings")
        .select("id, title, category_id, user_id, status, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const tbody = document.getElementById("listings-table-body");
      tbody.innerHTML =
        listings
          ?.map((listing, index) => {
            const statusBadges = {
              pending: "pending",
              active: "success",
              rejected: "danger",
            };
            const shortId = listing.id.substring(0, 8).toUpperCase();
            return `
                    <tr>
                        <td><input type="checkbox" class="listing-checkbox" data-listing-id="${listing.id}" onchange="adminPanel.updateListingBulkActions()"></td>
                        <td style="font-family: monospace; font-weight: bold; color: var(--primary);">${shortId}</td>
                        <td>${listing.title}</td>
                        <td>${listing.category}</td>
                        <td>${listing.user_id}</td>
                        <td><span class="badge ${statusBadges[listing.status] || "info"}">${listing.status}</span></td>
                        <td>
                            <button class="btn btn-small btn-primary" onclick="adminPanel.editListing('${listing.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${
                              listing.status === "pending"
                                ? `
                                <button class="btn btn-small btn-success" onclick="adminPanel.approveListing('${listing.id}')">
                                    <i class="fas fa-check"></i>
                                </button>
                                <button class="btn btn-small btn-warning" onclick="adminPanel.rejectListing('${listing.id}')">
                                    <i class="fas fa-times"></i>
                                </button>
                            `
                                : `
                                <button class="btn btn-small btn-danger" onclick="adminPanel.deleteListing('${listing.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            `
                            }
                        </td>
                    </tr>
                `;
          })
          .join("") ||
        '<tr><td colspan="7" style="text-align: center; padding: 20px;">İlan bulunamadı</td></tr>';

      // Add listing bulk actions bar
      this.addListingBulkActionsBar();
    } catch (error) {
      console.error("Listings load error:", error);
    }
  },

  async loadMessages() {
    try {
      const { data: messages, error } = await window.supabase
        .from("messages")
        .select("id, sender_id, receiver_id, subject, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const tbody = document.getElementById("messages-table-body");
      tbody.innerHTML =
        messages
          ?.map(
            (msg) => `
                <tr>
                    <td>${msg.sender_id}</td>
                    <td>${msg.receiver_id}</td>
                    <td>${msg.subject}</td>
                    <td>${new Date(msg.created_at).toLocaleDateString("tr-TR")}</td>
                    <td>
                        <button class="btn btn-small btn-danger">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `,
          )
          .join("") ||
        '<tr><td colspan="5" style="text-align: center; padding: 20px;">Mesaj bulunamadı</td></tr>';
    } catch (error) {
      console.error("Messages load error:", error);
    }
  },

  async loadCategories() {
    try {
      const { data: categories, error } = await window.supabase
        .from("categories")
        .select("*")
        .order("id", { ascending: true });

      if (error) throw error;

      this.categories = categories;
      this.renderCategoryColumns();
    } catch (error) {
      console.error("Categories load error:", error);
      Toast.show("Kategoriler yüklenirken hata oluştu", "error");
    }
  },

  renderCategoryColumns() {
    const grid = document.getElementById("categories-grid");
    if (!grid) return;

    // Switch to flex for column view
    grid.style.display = "block";
    grid.style.overflowX = "auto";

    let html = `
      <div style="margin-bottom: 20px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <button class="btn btn-primary" onclick="adminPanel.showAddCategoryForm()">
              <i class="fas fa-plus"></i> Yeni Ana Kategori
          </button>
          <button class="btn btn-secondary" onclick="adminPanel.exportCategories()">
              <i class="fas fa-download"></i> Tümünü Yedekle
          </button>
          <label class="btn btn-secondary" style="margin: 0; cursor: pointer;">
              <i class="fas fa-upload"></i> Yedeği Yükle
              <input type="file" id="import-categories-file" accept=".json" style="display: none;" onchange="adminPanel.importCategories(event)">
          </label>
          <span style="color: var(--gray-dark); font-size: 0.9em; margin-left: auto;">
              <i class="fas fa-info-circle"></i> Kategorileri "İlan Ver" sayfasındaki gibi kolonlar halinde yönetebilirsiniz.
          </span>
      </div>
      <div class="miller-container" id="millerContainer">
          <div class="miller-column" id="col-1">
              <div class="column-header">
                <span><i class="fas fa-list"></i> 1. SEVİYE</span>
                <button class="header-add-btn" onclick="adminPanel.showAddCategoryForm(null)" title="Yeni Ana Kategori Ekle"><i class="fas fa-plus"></i></button>
              </div>
              <ul class="category-list" id="list-1"></ul>
          </div>
          <div class="miller-column" id="col-2">
              <div class="column-header" id="header-2">
                <span><i class="fas fa-folder-open"></i> 2. SEVİYE</span>
                <button class="header-add-btn" id="btn-add-2" style="display:none" title="Yeni Alt Kategori Ekle"><i class="fas fa-plus"></i></button>
              </div>
              <ul class="category-list" id="list-2"></ul>
          </div>
          <div class="miller-column" id="col-3">
              <div class="column-header" id="header-3">
                <span><i class="fas fa-tags"></i> 3. SEVİYE</span>
                <button class="header-add-btn" id="btn-add-3" style="display:none" title="Yeni Detay Kategorisi Ekle"><i class="fas fa-plus"></i></button>
              </div>
              <ul class="category-list" id="list-3"></ul>
          </div>
      </div>
    `;

    grid.innerHTML = html;

    this.renderColumn(1, null);
    this.updateHeaderButtons();
    if (this.selectedLevel1Id) this.renderColumn(2, this.selectedLevel1Id);
    if (this.selectedLevel2Id) this.renderColumn(3, this.selectedLevel2Id);
  },

  updateHeaderButtons() {
    const btn2 = document.getElementById("btn-add-2");
    const btn3 = document.getElementById("btn-add-3");

    if (btn2) {
      if (this.selectedLevel1Id) {
        btn2.style.display = "flex";
        btn2.onclick = () => this.showAddCategoryForm(this.selectedLevel1Id);
      } else {
        btn2.style.display = "none";
      }
    }

    if (btn3) {
      if (this.selectedLevel2Id) {
        btn3.style.display = "flex";
        btn3.onclick = () => this.showAddCategoryForm(this.selectedLevel2Id);
      } else {
        btn3.style.display = "none";
      }
    }
  },

  renderColumn(level, parentId) {
    const list = document.getElementById(`list-${level}`);
    if (!list) return;

    list.innerHTML = "";
    const filtered = this.categories.filter((cat) => {
      if (parentId === null) return !cat.parent_id;
      return cat.parent_id == parentId;
    });

    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="column-empty">
          <i class="fas fa-folder-open"></i>
          <p>Alt kategori bulunamadı</p>
          ${parentId ? `<button class="btn btn-primary btn-small" style="margin-top:10px" onclick="adminPanel.showAddCategoryForm('${parentId}')"><i class="fas fa-plus"></i> Yeni Alt Kategori</button>` : ""}
        </div>
      `;
      return;
    }

    filtered.forEach((cat) => {
      const hasChildren = this.categories.some((c) => c.parent_id == cat.id);
      const isActive =
        (level === 1 && this.selectedLevel1Id == cat.id) ||
        (level === 2 && this.selectedLevel2Id == cat.id) ||
        (level === 3 && this.selectedLevel3Id == cat.id);

      const li = document.createElement("li");
      li.className = `category-item ${isActive ? "active" : ""}`;
      li.innerHTML = `
        <div class="category-icon" style="background: ${cat.icon_color || "#3b82f6"}15">
          <i class="fas ${cat.icon || "fa-folder"}" style="color: ${cat.icon_color || "#3b82f6"}"></i>
        </div>
        <div class="category-text">
          <span class="category-name">${cat.name}</span>
        </div>
        <div class="category-actions">
          <button class="action-btn add" title="Alt Kategori Ekle" onclick="event.stopPropagation(); adminPanel.showAddCategoryForm('${cat.id}')"><i class="fas fa-plus"></i></button>
          <button class="action-btn edit" title="Düzenle" onclick="event.stopPropagation(); adminPanel.editCategory('${cat.id}')"><i class="fas fa-edit"></i></button>
          <button class="action-btn delete" title="Sil" onclick="event.stopPropagation(); adminPanel.deleteCategory('${cat.id}')"><i class="fas fa-trash"></i></button>
        </div>
        ${hasChildren ? '<div class="category-arrow"><i class="fas fa-chevron-right"></i></div>' : ""}
      `;

      li.onclick = () => this.handleCategoryClick(level, cat.id);
      list.appendChild(li);
    });
  },

  handleCategoryClick(level, id) {
    if (level === 1) {
      this.selectedLevel1Id = id;
      this.selectedLevel2Id = null;
      this.selectedLevel3Id = null;
      this.renderColumn(1, null);
      this.renderColumn(2, id);
      const col3 = document.getElementById("list-3");
      if (col3)
        col3.innerHTML =
          '<div class="column-empty"><i class="fas fa-arrow-left"></i><p>Soldan bir kategori seçin</p></div>';
      this.updateHeaderButtons();
    } else if (level === 2) {
      this.selectedLevel2Id = id;
      this.selectedLevel3Id = null;
      this.renderColumn(2, this.selectedLevel1Id);
      this.renderColumn(3, id);
      this.updateHeaderButtons();
    } else if (level === 3) {
      this.selectedLevel3Id = id;
      this.renderColumn(3, this.selectedLevel2Id);
      this.updateHeaderButtons();
    }
  },

  async loadAnalytics() {
    try {
      // Fetch listings status data
      const { data: listings, error: listingsError } = await window.supabase
        .from("listings")
        .select("status, created_at");

      if (listingsError) throw listingsError;

      // Calculate status counts
      const statusCounts = {
        active: 0,
        pending: 0,
        rejected: 0,
      };

      listings?.forEach((listing) => {
        if (listing.status in statusCounts) {
          statusCounts[listing.status]++;
        }
      });

      // Calculate monthly activity (last 6 months)
      const monthlyData = {};
      const now = new Date();
      const monthNames = [
        "Ocak",
        "Şubat",
        "Mart",
        "Nisan",
        "Mayıs",
        "Haziran",
        "Temmuz",
        "Ağustos",
        "Eylül",
        "Ekim",
        "Kasım",
        "Aralık",
      ];

      // Initialize last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        const monthLabel = monthNames[date.getMonth()];
        monthlyData[monthKey] = { label: monthLabel, count: 0 };
      }

      // Count listings per month
      listings?.forEach((listing) => {
        const date = new Date(listing.created_at);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        if (monthlyData[monthKey]) {
          monthlyData[monthKey].count++;
        }
      });

      const monthlyLabels = Object.values(monthlyData).map((m) => m.label);
      const monthlyCounts = Object.values(monthlyData).map((m) => m.count);

      // Create charts with real data
      this.createMonthlyActivityChart(monthlyLabels, monthlyCounts);
      this.createListingsStatusChart(statusCounts);
    } catch (error) {
      console.error("Analytics load error:", error);
      // Fallback to empty charts
      this.createMonthlyActivityChart(
        ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran"],
        [0, 0, 0, 0, 0, 0],
      );
      this.createListingsStatusChart({ active: 0, pending: 0, rejected: 0 });
    }
  },

  async loadUserStatistics() {
    try {
      // Fetch user listing counts
      const { data: profiles, error: profileError } = await window.supabase
        .from("profiles")
        .select("id, email, full_name, created_at")
        .order("created_at", { ascending: false });

      if (profileError) throw profileError;

      // Get listings for each user
      const { data: listings, error: listingsError } = await window.supabase
        .from("listings")
        .select("user_id, status");

      if (listingsError) throw listingsError;

      // Calculate user statistics
      const userStats = {};
      profiles.forEach((user) => {
        userStats[user.id] = {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          created_at: user.created_at,
          total: 0,
          active: 0,
          pending: 0,
          rejected: 0,
        };
      });

      listings.forEach((listing) => {
        if (userStats[listing.user_id]) {
          userStats[listing.user_id].total++;
          if (listing.status === "active") userStats[listing.user_id].active++;
          else if (listing.status === "pending")
            userStats[listing.user_id].pending++;
          else if (listing.status === "rejected")
            userStats[listing.user_id].rejected++;
        }
      });

      // Sort by total listings
      const sortedUsers = Object.values(userStats).sort(
        (a, b) => b.total - a.total,
      );

      // Render tables
      this.renderTopActiveUsers(sortedUsers.slice(0, 10));
      this.renderUserListingsDetail(sortedUsers);

      // Create charts
      this.createUserActivityChart(sortedUsers);
      this.createUserListingsChart(sortedUsers);
    } catch (error) {
      console.error("User statistics error:", error);
      Toast.show("İstatistikler yüklenemedi", "error");
    }
  },

  renderTopActiveUsers(users) {
    const tbody = document.getElementById("top-users-table");
    tbody.innerHTML =
      users
        .map(
          (user) => `
            <tr>
                <td><strong>${user.full_name || "Belirsiz"}</strong></td>
                <td>${user.email}</td>
                <td>
                    <span class="badge success">${user.total}</span>
                </td>
            </tr>
        `,
        )
        .join("") ||
      '<tr><td colspan="3" style="text-align: center; padding: 20px;">Kullanıcı bulunamadı</td></tr>';
  },

  renderUserListingsDetail(users) {
    const tbody = document.getElementById("user-listings-detail-table");
    tbody.innerHTML =
      users
        .map(
          (user) => `
            <tr>
                <td><strong>${user.full_name || "Belirsiz"}</strong></td>
                <td>${user.email}</td>
                <td><span class="badge info">${user.total}</span></td>
                <td><span class="badge success">${user.active}</span></td>
                <td><span class="badge warning">${user.pending}</span></td>
                <td><span class="badge danger">${user.rejected}</span></td>
                <td>${new Date(user.created_at).toLocaleDateString("tr-TR")}</td>
            </tr>
        `,
        )
        .join("") ||
      '<tr><td colspan="7" style="text-align: center; padding: 20px;">Kullanıcı bulunamadı</td></tr>';
  },

  createUserActivityChart(users) {
    const ctx = document.getElementById("userActivityChart");
    if (!ctx) return;

    // Top 8 users for chart
    const topUsers = users.slice(0, 8);
    const labels = topUsers.map((u) => u.full_name || u.email.split("@")[0]);
    const data = topUsers.map((u) => u.total);

    new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "İlan Sayısı",
            data: data,
            backgroundColor: "rgba(59, 130, 246, 0.7)",
            borderColor: "rgba(59, 130, 246, 1)",
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 },
          },
        },
      },
    });
  },

  createUserListingsChart(users) {
    const ctx = document.getElementById("userListingsChart");
    if (!ctx) return;

    const totalListings = users.reduce((sum, u) => sum + u.total, 0);
    const avgListings =
      totalListings > 0 ? (totalListings / users.length).toFixed(2) : 0;

    const statusCounts = {
      active: 0,
      pending: 0,
      rejected: 0,
    };

    users.forEach((user) => {
      statusCounts.active += user.active;
      statusCounts.pending += user.pending;
      statusCounts.rejected += user.rejected;
    });

    new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Aktif", "Beklemede", "Reddedildi"],
        datasets: [
          {
            data: [
              statusCounts.active,
              statusCounts.pending,
              statusCounts.rejected,
            ],
            backgroundColor: [
              "rgba(16, 185, 129, 0.7)",
              "rgba(245, 158, 11, 0.7)",
              "rgba(239, 68, 68, 0.7)",
            ],
            borderColor: [
              "rgba(16, 185, 129, 1)",
              "rgba(245, 158, 11, 1)",
              "rgba(239, 68, 68, 1)",
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "bottom",
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const value = context.dataset.data[context.dataIndex];
                const percentage = ((value / total) * 100).toFixed(1);
                return `${context.label}: ${value} (%${percentage})`;
              },
            },
          },
        },
      },
    });
  },

  async loadActivityLog() {
    try {
      const { data: logs, error } = await window.supabase
        .from("admin_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const container = document.getElementById("activity-log-container");
      const actionIcons = {
        create: "fas fa-plus-circle",
        update: "fas fa-edit",
        delete: "fas fa-trash-alt",
        approve_listing: "fas fa-check-circle",
        reject_listing: "fas fa-times-circle",
        delete_listing: "fas fa-trash-alt",
        delete_user: "fas fa-user-slash",
        login: "fas fa-sign-in-alt",
      };

      const actionTypes = {
        create: "create",
        update: "update",
        delete: "delete",
        approve_listing: "update",
        reject_listing: "delete",
        delete_listing: "delete",
        delete_user: "delete",
        login: "login",
      };

      container.innerHTML =
        logs
          ?.map(
            (log) => `
                <div class="activity-item">
                    <div class="activity-icon ${actionTypes[log.action] || "create"}">
                        <i class="${actionIcons[log.action] || "fas fa-circle"}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">${log.action.replace(/_/g, " ").toUpperCase()}</div>
                        <div class="activity-user">Hedef: ${log.target}</div>
                        <div class="activity-time">${new Date(log.created_at).toLocaleString("tr-TR")}</div>
                    </div>
                </div>
            `,
          )
          .join("") ||
        '<div style="text-align: center; padding: 40px; color: var(--gray-dark);">Henüz işlem kaydı yok</div>';
    } catch (error) {
      console.error("Activity log error:", error);
      Toast.show("İşlem geçmişi yüklenirken hata oluştu", "error");
    }
  },

  async loadSystemHealth() {
    try {
      const startTime = Date.now();

      // Test database connection
      const dbStartTime = Date.now();
      try {
        const { data, error } = await window.supabase
          .from("profiles")
          .select("count", { count: "exact" })
          .limit(1);

        if (error) throw error;

        const dbResponseTime = Date.now() - dbStartTime;
        this.updateHealthStatus("db", true, `Bağlı (${dbResponseTime}ms)`);
      } catch (error) {
        this.updateHealthStatus(
          "db",
          false,
          `Bağlantı başarısız: ${error.message}`,
        );
      }

      // Test API response time with multiple requests
      const apiStartTime = Date.now();
      try {
        await Promise.all([
          window.supabase
            .from("listings")
            .select("count", { count: "exact" })
            .limit(1),
          window.supabase
            .from("messages")
            .select("count", { count: "exact" })
            .limit(1),
        ]);

        const apiResponseTime = Date.now() - apiStartTime;
        const avgTime = Math.round(apiResponseTime / 2);

        let apiStatus = "İyi";
        if (avgTime > 1000) apiStatus = "Yavaş";
        else if (avgTime > 500) apiStatus = "Orta";

        this.updateHealthStatus(
          "api",
          avgTime < 1000,
          `${apiStatus} (${avgTime}ms)`,
        );
      } catch (error) {
        this.updateHealthStatus("api", false, `Hata: ${error.message}`);
      }

      // Get storage/data usage stats
      try {
        const { data: listings } = await window.supabase
          .from("listings")
          .select("id, images");

        const { data: messages } = await window.supabase
          .from("messages")
          .select("id");

        const totalImages =
          listings?.reduce((sum, l) => sum + (l.images?.length || 0), 0) || 0;
        const estimatedSize = (
          totalImages * 2.5 +
          (messages?.length || 0) * 0.05
        ).toFixed(2);

        this.updateHealthStatus(
          "storage",
          true,
          `~${estimatedSize}MB (${totalImages} resim)`,
        );
      } catch (error) {
        this.updateHealthStatus("storage", false, `Bilgi alınamadı`);
      }

      // Load recent error logs
      try {
        const { data: logs } = await window.supabase
          .from("admin_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);

        const errorContainer = document.getElementById("error-logs-container");
        if (logs && logs.length > 0) {
          errorContainer.innerHTML = logs
            .map(
              (log) => `
                        <div style="padding: 12px; border-bottom: 1px solid var(--border); font-size: 0.9rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                <strong>${log.action.replace(/_/g, " ").toUpperCase()}</strong>
                                <small style="color: var(--gray-dark);">${new Date(log.created_at).toLocaleString("tr-TR")}</small>
                            </div>
                            <div style="color: var(--gray-dark); font-size: 0.85rem;">Hedef: ${log.target}</div>
                        </div>
                    `,
            )
            .join("");
        } else {
          errorContainer.innerHTML =
            '<div style="text-align: center; padding: 40px; color: var(--gray-dark);">Hata günlüğü yok</div>';
        }
      } catch (error) {
        document.getElementById("error-logs-container").innerHTML =
          '<div style="text-align: center; padding: 40px; color: var(--gray-dark);">Hata günlüğü yüklenirken sorun oluştu</div>';
      }

      Toast.show("✓ Sistem sağlığı kontrol edildi", "success");
    } catch (error) {
      console.error("System health check error:", error);
      Toast.show("Sistem sağlığı kontrol başarısız", "error");
    }
  },

  updateHealthStatus(type, isHealthy, message) {
    const statusMap = {
      db: { badge: "db-status-badge", content: "db-status-content" },
      api: { badge: "api-status-badge", content: "api-status-content" },
      storage: {
        badge: "storage-status-badge",
        content: "storage-status-content",
      },
    };

    const ids = statusMap[type];
    if (!ids) return;

    const badgeEl = document.getElementById(ids.badge);
    const contentEl = document.getElementById(ids.content);

    const statusClass = isHealthy ? "status-healthy" : "status-unhealthy";
    const icon = isHealthy ? "fa-check-circle" : "fa-exclamation-circle";
    const statusText = isHealthy ? "Sağlıklı" : "Sorun";

    badgeEl.className = `status-badge ${statusClass}`;
    badgeEl.innerHTML = `<i class="fas ${icon}"></i> ${statusText}`;

    contentEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas ${icon}" style="font-size: 1.5rem; color: ${isHealthy ? "var(--success)" : "var(--danger)"}"></i>
                <div>
                    <div style="font-size: 0.9rem; color: var(--gray-dark);">${message}</div>
                </div>
            </div>
        `;
  },

  async approveListing(id) {
    try {
      const { error } = await window.supabase
        .from("listings")
        .update({ status: "active" })
        .eq("id", id);

      if (error) throw error;
      Toast.show("✓ İlan başarıyla onaylandı!", "success");
      ActivityLogger.log("approve_listing", "listings", id);
      this.loadListings();
    } catch (error) {
      console.error("Approve error:", error);
      Toast.show("✗ İlan onaylanırken hata oluştu", "error");
    }
  },

  async rejectListing(id) {
    try {
      const { error } = await window.supabase
        .from("listings")
        .update({ status: "rejected" })
        .eq("id", id);

      if (error) throw error;
      Toast.show("✓ İlan başarıyla reddedildi!", "success");
      ActivityLogger.log("reject_listing", "listings", id);
      this.loadListings();
    } catch (error) {
      console.error("Reject error:", error);
      Toast.show("✗ İlan reddedilirken hata oluştu", "error");
    }
  },

  async deleteListing(id) {
    if (
      !confirm("Bu işlem geri alınamaz. Devam etmek istediğinize emin misiniz?")
    )
      return;

    try {
      const { error } = await window.supabase
        .from("listings")
        .delete()
        .eq("id", id);

      if (error) throw error;
      Toast.show("✓ İlan başarıyla silindi!", "success");

      // Log activity but do not let logging failures break the main flow
      try {
        await ActivityLogger.log("delete_listing", "listings", id);
      } catch (logErr) {
        // Swallow logging errors to avoid noisy console errors if admin_logs table is missing
        if (console && console.debug)
          console.debug("Activity log skipped:", logErr);
      }

      this.loadListings();
    } catch (error) {
      console.error("Delete error:", error);
      Toast.show("✗ İlan silinirken hata oluştu", "error");
    }
  },

  async deleteUser(id) {
    if (
      !confirm(
        "Bu kullanıcıyı silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve kullanıcının tüm ilanları da silinecektir.",
      )
    )
      return;

    try {
      // Delete user from auth.users using admin API
      // This will cascade delete to profiles table automatically
      const { data, error } = await window.supabase.auth.admin.deleteUser(id);

      if (error) throw error;

      Toast.show("✓ Kullanıcı başarıyla silindi!", "success");

      // Log activity
      try {
        await ActivityLogger.log("delete_user", "auth.users", id);
      } catch (logErr) {
        console.debug("Activity log skipped:", logErr);
      }

      this.loadUsers();
    } catch (error) {
      console.error("Delete error:", error);
      Toast.show(
        "✗ Kullanıcı silinirken hata oluştu: " + error.message,
        "error",
      );
    }
  },

  async viewUserDetail(id) {
    try {
      const { data: user } = await window.supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

      if (!user) throw new Error("Kullanıcı bulunamadı");

      Modal.open(
        "Kullanıcı Detayları",
        `
                <div class="form-group">
                    <label>E-Mail</label>
                    <input type="text" class="form-control" value="${user.email}" disabled>
                </div>
                <div class="form-group">
                    <label>İsim</label>
                    <input type="text" class="form-control" value="${user.full_name || "-"}" disabled>
                </div>
                <div class="form-group">
                    <label>Kayıt Tarihi</label>
                    <input type="text" class="form-control" value="${new Date(user.created_at).toLocaleDateString("tr-TR")}" disabled>
                </div>
            `,
      );
    } catch (error) {
      console.error("Detail error:", error);
      Toast.show("Kullanıcı detayları yüklenemedi", "error");
    }
  },

  async bulkDeleteUsers() {
    const selected = Array.from(
      document.querySelectorAll(".user-checkbox:checked"),
    ).map((cb) => cb.dataset.userId);
    if (selected.length === 0) return;

    if (
      !confirm(
        `${selected.length} kullanıcıyı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      )
    )
      return;

    try {
      let successCount = 0;
      let failCount = 0;

      for (const userId of selected) {
        try {
          const { error } = await window.supabase.auth.admin.deleteUser(userId);
          if (error) throw error;
          successCount++;
        } catch (err) {
          console.error(`Failed to delete user ${userId}:`, err);
          failCount++;
        }
      }

      if (successCount > 0) {
        Toast.show(
          `✓ ${successCount} kullanıcı silindi!${failCount > 0 ? ` (${failCount} hata)` : ""}`,
          successCount > failCount ? "success" : "warning",
        );
      } else {
        Toast.show("Hiçbir kullanıcı silinemedi", "error");
      }

      this.loadUsers();
    } catch (error) {
      console.error("Bulk delete error:", error);
      Toast.show("İşlem başarısız oldu", "error");
    }
  },

  async bulkBlockUsers() {
    const selected = Array.from(
      document.querySelectorAll(".user-checkbox:checked"),
    ).map((cb) => cb.dataset.userId);
    if (selected.length === 0) return;

    Toast.show("Bu özellik yakında eklenecek", "info");
  },

  updateBulkActions() {
    const selectedCount = document.querySelectorAll(
      ".user-checkbox:checked",
    ).length;
    const bar = document.getElementById("bulk-actions-bar");
    if (bar) {
      document.getElementById("selected-count").textContent = selectedCount;
      if (selectedCount > 0) {
        bar.classList.remove("hidden");
      } else {
        bar.classList.add("hidden");
      }
    }
  },

  toggleSelectAll() {
    const allChecked = document.getElementById("select-all-checkbox").checked;
    document.querySelectorAll(".user-checkbox").forEach((cb) => {
      cb.checked = allChecked;
    });
    this.updateBulkActions();
  },

  // ===== LISTING BULK ACTIONS =====

  addListingBulkActionsBar() {
    if (document.getElementById("listing-bulk-actions-bar")) return;

    const bar = document.createElement("div");
    bar.id = "listing-bulk-actions-bar";
    bar.className = "bulk-actions-bar hidden";
    bar.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                <span>Seçili: <strong id="listing-selected-count">0</strong></span>
                <button class="btn btn-success" onclick="adminPanel.bulkApproveListing()">
                    <i class="fas fa-check"></i> Onayla
                </button>
                <button class="btn btn-warning" onclick="adminPanel.bulkRejectListing()">
                    <i class="fas fa-times"></i> Reddet
                </button>
                <button class="btn btn-danger" onclick="adminPanel.bulkDeleteListing()">
                    <i class="fas fa-trash"></i> Sil
                </button>
            </div>
        `;

    const section = document.getElementById("listings-section");
    const table = section.querySelector("table");
    table.parentNode.insertBefore(bar, table);
  },

  updateListingBulkActions() {
    const selectedCount = document.querySelectorAll(
      ".listing-checkbox:checked",
    ).length;
    const bar = document.getElementById("listing-bulk-actions-bar");
    if (bar) {
      document.getElementById("listing-selected-count").textContent =
        selectedCount;
      if (selectedCount > 0) {
        bar.classList.remove("hidden");
      } else {
        bar.classList.add("hidden");
      }
    }
  },

  async bulkApproveListing() {
    const selected = Array.from(
      document.querySelectorAll(".listing-checkbox:checked"),
    ).map((cb) => cb.dataset.listingId);
    if (selected.length === 0) return;

    if (
      !confirm(`${selected.length} ilanı onaylamak istediğinize emin misiniz?`)
    )
      return;

    try {
      for (const listingId of selected) {
        await window.supabase
          .from("listings")
          .update({ status: "active" })
          .eq("id", listingId);

        await ActivityLogger.log(
          "bulk_approve",
          "listing",
          `Listing ID: ${listingId}`,
        );
      }
      Toast.show(`✓ ${selected.length} ilan onaylandı!`, "success");
      this.loadListings();
    } catch (error) {
      console.error("Bulk approve error:", error);
      Toast.show("İşlem başarısız oldu", "error");
    }
  },

  async bulkRejectListing() {
    const selected = Array.from(
      document.querySelectorAll(".listing-checkbox:checked"),
    ).map((cb) => cb.dataset.listingId);
    if (selected.length === 0) return;

    if (
      !confirm(`${selected.length} ilanı reddetmek istediğinize emin misiniz?`)
    )
      return;

    try {
      for (const listingId of selected) {
        await window.supabase
          .from("listings")
          .update({ status: "rejected" })
          .eq("id", listingId);

        await ActivityLogger.log(
          "bulk_reject",
          "listing",
          `Listing ID: ${listingId}`,
        );
      }
      Toast.show(`✓ ${selected.length} ilan reddedildi!`, "success");
      this.loadListings();
    } catch (error) {
      console.error("Bulk reject error:", error);
      Toast.show("İşlem başarısız oldu", "error");
    }
  },

  async bulkDeleteListing() {
    const selected = Array.from(
      document.querySelectorAll(".listing-checkbox:checked"),
    ).map((cb) => cb.dataset.listingId);
    if (selected.length === 0) return;

    if (!confirm(`${selected.length} ilanı silmek istediğinize emin misiniz?`))
      return;

    try {
      for (const listingId of selected) {
        await window.supabase.from("listings").delete().eq("id", listingId);

        try {
          await ActivityLogger.log(
            "bulk_delete",
            "listing",
            `Listing ID: ${listingId}`,
          );
        } catch (logErr) {
          if (console && console.debug)
            console.debug("Activity log skipped for bulk delete:", logErr);
        }
      }
      Toast.show(`✓ ${selected.length} ilan silindi!`, "success");
      this.loadListings();
    } catch (error) {
      console.error("Bulk delete error:", error);
      Toast.show("İşlem başarısız oldu", "error");
    }
  },

  // ===== EDIT FUNCTIONS =====

  async editUser(id) {
    try {
      const { data: user } = await window.supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

      if (!user) throw new Error("Kullanıcı bulunamadı");

      Modal.open(
        "Kullanıcı Düzenle",
        `
                <form id="edit-user-form" data-user-id="${user.id}">
                    <div class="form-group">
                        <label>E-Mail</label>
                        <input type="email" class="form-control" id="edit-email" value="${user.email}" required>
                        <small style="color: var(--gray-dark);">E-posta adresini değiştirebilirsiniz</small>
                    </div>
                    <div class="form-group">
                        <label>İsim Soyisim</label>
                        <input type="text" class="form-control" id="edit-fullname" value="${user.full_name || ""}" required>
                    </div>
                    <div class="form-group">
                        <label>Telefon</label>
                        <input type="tel" class="form-control" id="edit-phone" value="${user.phone || ""}">
                    </div>
                    <div class="form-group">
                        <label>Hakkında</label>
                        <textarea class="form-control" id="edit-bio" style="min-height: 80px; padding: 10px;">${user.bio || ""}</textarea>
                    </div>
                </form>
            `,
        [
          {
            label: "Kaydet",
            class: "btn-primary",
            action: "adminPanel.saveUserEdit()",
          },
          {
            label: "İptal",
            class: "btn-secondary",
            action: "Modal.close()",
          },
        ],
      );
    } catch (error) {
      console.error("Edit error:", error);
      Toast.show("Kullanıcı düzenlemesi başarısız", "error");
    }
  },

  async saveUserEdit() {
    try {
      const form = document.getElementById("edit-user-form");
      if (!form) return;

      const userId = form.dataset.userId;
      const email = document.getElementById("edit-email")?.value || "";
      const fullName = document.getElementById("edit-fullname")?.value || "";
      const phone = document.getElementById("edit-phone")?.value || "";
      const bio = document.getElementById("edit-bio")?.value || "";

      // Validate email
      if (!email || !email.includes("@")) {
        Toast.show("Geçerli bir e-posta adresi girin", "error");
        return;
      }

      // Check if email already exists for another user
      const { data: existingUser } = await window.supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .neq("id", userId)
        .single();

      if (existingUser) {
        Toast.show(
          "Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor",
          "error",
        );
        return;
      }

      const { error } = await window.supabase
        .from("profiles")
        .update({
          email: email,
          full_name: fullName,
          phone: phone,
          bio: bio,
          updated_at: new Date(),
        })
        .eq("id", userId);

      if (error) throw error;

      Toast.show("✓ Kullanıcı başarıyla güncellendi!", "success");
      ActivityLogger.log("update_user", "profiles", userId);
      Modal.close();
      this.loadUsers();
    } catch (error) {
      console.error("Save error:", error);
      Toast.show("Kaydedilirken hata oluştu", "error");
    }
  },

  async editListing(id) {
    try {
      const { data: listing } = await window.supabase
        .from("listings")
        .select("*")
        .eq("id", id)
        .single();

      if (!listing) throw new Error("İlan bulunamadı");

      Modal.open(
        "İlan Düzenle",
        `
                <form id="edit-listing-form" data-listing-id="${listing.id}">
                    <div class="form-group">
                        <label>Başlık</label>
                        <input type="text" class="form-control" id="edit-title" value="${listing.title || ""}" required>
                    </div>
                    <div class="form-group">
                        <label>Açıklama</label>
                        <textarea class="form-control" id="edit-description" style="min-height: 100px; padding: 10px;" required>${listing.description || ""}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Kategori</label>
                        <input type="text" class="form-control" id="edit-category" value="${listing.category || ""}" required>
                    </div>
                    <div class="form-group">
                        <label>Fiyat</label>
                        <input type="number" class="form-control" id="edit-price" value="${listing.price || 0}" min="0">
                    </div>
                    <div class="form-group">
                        <label>Durum</label>
                        <select class="form-control" id="edit-status">
                            <option value="pending" ${listing.status === "pending" ? "selected" : ""}>Beklemede</option>
                            <option value="active" ${listing.status === "active" ? "selected" : ""}>Aktif</option>
                            <option value="rejected" ${listing.status === "rejected" ? "selected" : ""}>Reddedildi</option>
                        </select>
                    </div>
                </form>
            `,
        [
          {
            label: "Kaydet",
            class: "btn-primary",
            action: "adminPanel.saveListingEdit()",
          },
          {
            label: "İptal",
            class: "btn-secondary",
            action: "Modal.close()",
          },
        ],
      );
    } catch (error) {
      console.error("Edit error:", error);
      Toast.show("İlan düzenlemesi başarısız", "error");
    }
  },

  async saveListingEdit() {
    try {
      const form = document.getElementById("edit-listing-form");
      if (!form) return;

      const listingId = form.dataset.listingId;
      const title = document.getElementById("edit-title")?.value || "";
      const description =
        document.getElementById("edit-description")?.value || "";
      const category = document.getElementById("edit-category")?.value || "";
      const price = document.getElementById("edit-price")?.value || 0;
      const status = document.getElementById("edit-status")?.value || "pending";

      const { error } = await window.supabase
        .from("listings")
        .update({
          title,
          description,
          category,
          price: parseFloat(price),
          status,
          updated_at: new Date(),
        })
        .eq("id", listingId);

      if (error) throw error;

      Toast.show("✓ İlan başarıyla güncellendi!", "success");
      ActivityLogger.log("update_listing", "listings", listingId);
      Modal.close();
      this.loadListings();
    } catch (error) {
      console.error("Save error:", error);
      Toast.show("Kaydedilirken hata oluştu", "error");
    }
  },

  async createUserGrowthChart() {
    const ctx = document.getElementById("userGrowthChart");
    if (!ctx || this.charts.userGrowth) return;

    try {
      // Fetch user creation data from last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: users, error } = await window.supabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", sixMonthsAgo.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Group by month
      const monthNames = [
        "Ocak",
        "Şubat",
        "Mart",
        "Nisan",
        "Mayıs",
        "Haziran",
        "Temmuz",
        "Ağustos",
        "Eylül",
        "Ekim",
        "Kasım",
        "Aralık",
      ];
      const monthCounts = {};

      // Initialize last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        monthCounts[monthKey] = {
          label: monthNames[date.getMonth()],
          count: 0,
        };
      }

      // Count users per month
      users.forEach((user) => {
        const date = new Date(user.created_at);
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        if (monthCounts[monthKey]) {
          monthCounts[monthKey].count++;
        }
      });

      const labels = Object.values(monthCounts).map((m) => m.label);
      const data = Object.values(monthCounts).map((m) => m.count);

      this.charts.userGrowth = new Chart(ctx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Yeni Kullanıcılar",
              data: data,
              borderColor: "#667eea",
              backgroundColor: "rgba(102, 126, 234, 0.1)",
              borderWidth: 2,
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (context) {
                  return `Yeni Üye: ${context.parsed.y}`;
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1 },
            },
          },
        },
      });
    } catch (error) {
      console.error("User growth chart error:", error);
    }
  },

  async createCategoryChart() {
    const ctx = document.getElementById("categoryChartDash");
    if (!ctx || this.charts.category) return;

    try {
      // Fetch all listings with categories
      const { data: listings, error } = await window.supabase
        .from("listings")
        .select("category");

      if (error) throw error;

      // Count by category
      const categoryCounts = {};
      listings.forEach((listing) => {
        const cat = listing.category || "Diğer";
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });

      // Sort by count and get top categories
      const sortedCategories = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8); // Top 8 categories

      const labels = sortedCategories.map((c) => c[0]);
      const data = sortedCategories.map((c) => c[1]);
      const colors = [
        "#667eea",
        "#764ba2",
        "#f093fb",
        "#f5576c",
        "#4facfe",
        "#00f2fe",
        "#43e97b",
        "#fa709a",
      ];

      this.charts.category = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: labels,
          datasets: [
            {
              data: data,
              backgroundColor: colors.slice(0, labels.length),
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: "bottom" },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const value = context.dataset.data[context.dataIndex];
                  const percentage = ((value / total) * 100).toFixed(1);
                  return `${context.label}: ${value} (%${percentage})`;
                },
              },
            },
          },
        },
      });
    } catch (error) {
      console.error("Category chart error:", error);
    }
  },

  createMonthlyActivityChart(labels, data) {
    const ctx = document.getElementById("monthlyActivityChart");
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (this.charts.monthly) {
      this.charts.monthly.destroy();
    }

    this.charts.monthly = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels || [
          "Ocak",
          "Şubat",
          "Mart",
          "Nisan",
          "Mayıs",
          "Haziran",
        ],
        datasets: [
          {
            label: "Yeni İlanlar",
            data: data || [0, 0, 0, 0, 0, 0],
            backgroundColor: "#667eea",
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (context) {
                return context.parsed.y + " ilan";
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
        },
      },
    });
  },

  createListingsStatusChart(statusCounts) {
    const ctx = document.getElementById("listingsStatusChart");
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (this.charts.status) {
      this.charts.status.destroy();
    }

    const counts = statusCounts || { active: 0, pending: 0, rejected: 0 };
    const total = counts.active + counts.pending + counts.rejected;

    this.charts.status = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["Aktif", "Beklemede", "Reddedildi"],
        datasets: [
          {
            data: [counts.active, counts.pending, counts.rejected],
            backgroundColor: ["#10b981", "#f59e0b", "#ef4444"],
            borderWidth: 2,
            borderColor: "#fff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              padding: 15,
              font: {
                size: 12,
              },
            },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const value = context.parsed;
                const percentage =
                  total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return context.label + ": " + value + " (" + percentage + "%)";
              },
            },
          },
        },
      },
    });
  },

  setupTheme() {
    // Theme already set in initUI
  },

  // ===== SETTINGS FUNCTIONS =====

  switchSettingsTab(tab) {
    // Hide all tabs
    document.querySelectorAll(".settings-tab-content").forEach((el) => {
      el.classList.remove("active");
    });
    document.querySelectorAll(".settings-tab").forEach((el) => {
      el.classList.remove("active");
    });

    // Show selected tab
    const tabContent = document.getElementById(tab + "-settings-tab");
    if (tabContent) {
      tabContent.classList.add("active");
    }

    // Mark button as active
    document.querySelector(`[data-tab="${tab}"]`).classList.add("active");

    // Load settings if needed
    if (tab === "email") {
      this.loadEmailTemplates();
    } else if (tab === "notifications") {
      this.loadNotificationSettings();
    } else if (tab === "button") {
      this.loadPostAdButtonSettings();
      this.initDragAndDropPositioning();
    }
  },

  handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      Toast.show("Dosya boyutu 2MB'dan az olmalı", "error");
      return;
    }

    // Check file type
    const validTypes = ["image/png", "image/jpeg", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      Toast.show("Sadece PNG, JPG ve SVG dosyaları desteklenir", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const logoPreview = document.getElementById("logo-preview");
      const logoPlaceholder = document.getElementById("logo-placeholder");

      logoPreview.src = e.target.result;
      logoPreview.style.display = "block";
      logoPlaceholder.style.display = "none";

      // Store in localStorage for demo
      localStorage.setItem("admin-logo", e.target.result);
      Toast.show("Logo yüklendi", "success");
    };
    reader.readAsDataURL(file);
  },

  // ===== BUTTON SETTINGS =====

  async loadPostAdButtonSettings() {
    try {
      console.log("Loading button settings...");
      const { data, error } = await window.supabase
        .from("site_settings")
        .select("*")
        .eq("setting_key", "post_ad_button_config")
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        const config =
          typeof data.setting_value === "string"
            ? JSON.parse(data.setting_value)
            : data.setting_value;

        const previewImg = document.getElementById("btn-img-preview");
        const placeholder = document.getElementById("btn-img-placeholder");
        const hiddenUrl = document.getElementById("post-ad-btn-img-url");

        if (config.image_url) {
          previewImg.src = config.image_url;
          previewImg.style.display = "block";
          placeholder.style.display = "none";
          hiddenUrl.value = config.image_url;
        }

        // Color & Opacity mapping
        let hexColor = "#006994";
        let opacity = 0.6;

        if (config.overlay_color) {
          if (config.overlay_color.startsWith("#")) {
            hexColor = config.overlay_color;
          } else if (config.overlay_color.includes("rgba")) {
            const rgbaMatch = config.overlay_color.match(
              /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
            );
            if (rgbaMatch) {
              const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, "0");
              const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, "0");
              const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, "0");
              hexColor = `#${r}${g}${b}`;
              opacity = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;
            }
          }
        }

        if (document.getElementById("post-ad-btn-color"))
          document.getElementById("post-ad-btn-color").value = hexColor;
        if (document.getElementById("post-ad-btn-color-text"))
          document.getElementById("post-ad-btn-color-text").value =
            config.overlay_color || hexColor;
        if (document.getElementById("post-ad-btn-opacity"))
          document.getElementById("post-ad-btn-opacity").value = opacity;
        if (document.getElementById("opacity-value"))
          document.getElementById("opacity-value").textContent = opacity;

        // Position Alignment
        const posX = config.background_position_x || 50;
        const posY = config.background_position_y || 50;
        if (document.getElementById("post-ad-btn-posX"))
          document.getElementById("post-ad-btn-posX").value = posX;
        if (document.getElementById("posX-value"))
          document.getElementById("posX-value").textContent = posX + "%";
        if (document.getElementById("post-ad-btn-posY"))
          document.getElementById("post-ad-btn-posY").value = posY;
        if (document.getElementById("posY-value"))
          document.getElementById("posY-value").textContent = posY + "%";

        // Border Color
        const borderColor = config.border_color || "#003366";
        if (document.getElementById("post-ad-btn-border-color"))
          document.getElementById("post-ad-btn-border-color").value =
            borderColor;
        if (document.getElementById("post-ad-btn-border-text"))
          document.getElementById("post-ad-btn-border-text").value =
            borderColor;

        if (document.getElementById("post-ad-btn-active"))
          document.getElementById("post-ad-btn-active").checked =
            data.is_active;

        this.updateButtonPreview();
      }
    } catch (error) {
      console.error("Button settings load error:", error);
      Toast.show("Buton ayarları yüklenemedi", "error");
    }
  },

  async savePostAdButtonSettings() {
    try {
      Toast.show("⏳ Kaydediliyor...", "info");

      let imgUrl = document.getElementById("post-ad-btn-img-url").value;
      const fileInput = document.getElementById("post-ad-btn-upload");
      const file = fileInput.files[0];

      // If a new file is selected, upload it first
      if (file) {
        Toast.show("⏳ Görsel yükleniyor...", "info");
        const fileExt = file.name.split(".").pop();
        const fileName = `site-assets/post-ad-btn-bg-${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } =
          await window.supabase.storage
            .from("site-assets")
            .upload(fileName, file, { upsert: true });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = window.supabase.storage.from("site-assets").getPublicUrl(fileName);

        imgUrl = publicUrl;
      }

      const colorText = document.getElementById("post-ad-btn-color-text");
      const opacityInput = document.getElementById("post-ad-btn-opacity");
      const activeCheckbox = document.getElementById("post-ad-btn-active");

      const color = colorText.value;
      const opacity = opacityInput.value;
      const isActive = activeCheckbox.checked;

      // Convert hex to rgba for storage/display
      let overlayColor = color;
      if (color.startsWith("#") && color.length === 7) {
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        overlayColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
      }

      const posX = document.getElementById("post-ad-btn-posX").value;
      const posY = document.getElementById("post-ad-btn-posY").value;
      const borderColor =
        document.getElementById("post-ad-btn-border-text").value || "#003366";

      const config = {
        image_url: imgUrl,
        overlay_color: overlayColor,
        border_color: borderColor,
        background_position_x: posX,
        background_position_y: posY,
        is_active: isActive,
      };

      const { error: upsertError } = await window.supabase
        .from("site_settings")
        .upsert(
          {
            setting_key: "post_ad_button_config",
            setting_value: config,
            is_active: isActive,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "setting_key" },
        );

      if (upsertError) {
        console.error("Supabase upsert error details:", upsertError);
        if (upsertError.code === "42501") {
          throw new Error(
            "Veritabanına kaydetme izniniz yok (RLS Politikası hatası). Lütfen SQL komutunu çalıştırdığınızdan emin olun.",
          );
        }
        throw upsertError;
      }

      Toast.show("✓ Buton ayarları kaydedildi!", "success");
      ActivityLogger.log("update", "settings", "post_ad_button_config");

      // Refresh preview
      this.updateButtonPreview();
    } catch (error) {
      console.error("Button settings save error:", error);
      Toast.show(error.message || "Ayarlar kaydedilemedi", "error");
    }
  },

  updateButtonPreview() {
    const previewImg = document.getElementById("btn-img-preview");
    const colorText = document.getElementById("post-ad-btn-color-text");
    const colorPicker = document.getElementById("post-ad-btn-color");
    const opacityInput = document.getElementById("post-ad-btn-opacity");
    const activeCheckbox = document.getElementById("post-ad-btn-active");
    const previewBtn = document.getElementById("btn-preview");
    const previewBtnMobile = document.getElementById("btn-preview-mobile");

    if (!previewBtn || !previewImg || !colorText || !colorPicker) return;

    const elPosX = document.getElementById("post-ad-btn-posX");
    const elPosY = document.getElementById("post-ad-btn-posY");
    const posX = elPosX ? elPosX.value : 50;
    const posY = elPosY ? elPosY.value : 50;
    const opacity = opacityInput ? opacityInput.value : 0.6;
    const isActive = activeCheckbox.checked;
    const colorValue = colorText.value.trim();
    const borderPicker = document.getElementById("post-ad-btn-border-color");
    const borderText = document.getElementById("post-ad-btn-border-text");

    let borderColorValue = borderText?.value.trim() || "#003366";

    // Update drag indicator position
    const dragIndicator = document.getElementById("drag-indicator");
    if (dragIndicator) {
      dragIndicator.style.left = `${posX}%`;
      dragIndicator.style.top = `${posY}%`;
      dragIndicator.style.display =
        previewImg.style.display !== "none" ? "block" : "none";
    }

    // Sync border inputs
    if (borderPicker && borderText) {
      if (
        borderPicker.value !== borderColorValue &&
        /^#[0-9A-F]{6}$/i.test(borderPicker.value)
      ) {
        borderText.value = borderPicker.value;
        borderColorValue = borderPicker.value;
      } else if (
        borderText.value !== borderPicker.value &&
        /^#[0-9A-F]{6}$/i.test(borderColorValue)
      ) {
        borderPicker.value = borderColorValue;
      }
    }

    if (document.getElementById("opacity-value"))
      document.getElementById("opacity-value").textContent = opacity;
    if (document.getElementById("posX-value"))
      document.getElementById("posX-value").textContent = posX + "%";
    if (document.getElementById("posY-value"))
      document.getElementById("posY-value").textContent = posY + "%";

    // Sync color picker for overlay
    if (colorPicker && colorText && /^#[0-9A-F]{6}$/i.test(colorValue)) {
      colorPicker.value = colorValue;
    }

    const hasValidImage =
      previewImg.src &&
      previewImg.src !== "" &&
      previewImg.style.display !== "none" &&
      !previewImg.src.includes("undefined");

    const configImgUrl = document.getElementById("post-ad-btn-img-url").value;

    const updateBtnStyles = (btn) => {
      if (!btn) return;
      if (isActive && (hasValidImage || configImgUrl)) {
        const finalImgUrl = hasValidImage ? previewImg.src : configImgUrl;
        btn.style.backgroundImage = `url('${finalImgUrl}')`;
        btn.style.backgroundPosition = `${posX}% ${posY}%`;
        btn.style.setProperty("--btn-border", borderColorValue);
        btn.classList.add("dynamic-bg");

        let r = 0,
          g = 105,
          b = 148;
        let hexValue = colorPicker.value;
        if (/^#[0-9A-F]{6}$/i.test(hexValue)) {
          r = parseInt(hexValue.slice(1, 3), 16);
          g = parseInt(hexValue.slice(3, 5), 16);
          b = parseInt(hexValue.slice(5, 7), 16);
        }

        const overlayColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        colorText.value = overlayColor;
        btn.style.setProperty("--btn-overlay", overlayColor);

        const hoverColor = overlayColor.replace(/[\d.]+\)$/, "0.4)");
        btn.style.setProperty("--btn-overlay-hover", hoverColor);

        // For mobile specific border if needed
        if (btn.id === "btn-preview-mobile") {
          btn.style.border = `2px solid ${borderColorValue}`;
        }
      } else {
        btn.style.backgroundImage = "none";
        btn.classList.remove("dynamic-bg");
        btn.style.setProperty("--btn-overlay", "transparent");
        btn.style.setProperty("--btn-overlay-hover", "rgba(16, 185, 129, 0.1)");
        if (btn.id === "btn-preview-mobile") {
          btn.style.border = "none";
        }
      }
    };

    updateBtnStyles(previewBtn);
    updateBtnStyles(previewBtnMobile);
  },

  updateButtonColorText() {
    const colorPicker = document.getElementById("post-ad-btn-color");
    const colorText = document.getElementById("post-ad-btn-color-text");
    colorText.value = colorPicker.value;
    this.updateButtonPreview();
  },

  handlePostAdButtonImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      Toast.show("Dosya boyutu 2MB'dan az olmalı", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const previewImg = document.getElementById("btn-img-preview");
      const placeholder = document.getElementById("btn-img-placeholder");

      previewImg.src = e.target.result;
      previewImg.style.display = "block";
      placeholder.style.display = "none";

      this.updateButtonPreview();
    };
    reader.readAsDataURL(file);
  },

  initDragAndDropPositioning() {
    const container = document.getElementById("btn-img-preview-container");
    if (!container) return;

    let isDragging = false;
    const posXInput = document.getElementById("post-ad-btn-posX");
    const posYInput = document.getElementById("post-ad-btn-posY");

    const updateFromMouse = (e) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      let pctX = Math.round((x / rect.width) * 100);
      let pctY = Math.round((y / rect.height) * 100);

      pctX = Math.max(0, Math.min(100, pctX));
      pctY = Math.max(0, Math.min(100, pctY));

      posXInput.value = pctX;
      posYInput.value = pctY;

      this.updateButtonPreview();
    };

    container.onmousedown = (e) => {
      isDragging = true;
      updateFromMouse(e);
    };

    window.onmousemove = (e) => {
      if (!isDragging) return;
      updateFromMouse(e);
    };

    window.onmouseup = () => {
      isDragging = false;
    };
  },

  async saveGeneralSettings() {
    const title = document.getElementById("site-title").value.trim();
    const description = document
      .getElementById("site-description")
      .value.trim();

    if (!title) {
      Toast.show("Site başlığı boş olamaz", "error");
      return;
    }

    try {
      // In a real app, save to database
      localStorage.setItem("site-title", title);
      localStorage.setItem("site-description", description);

      Toast.show("✓ Genel ayarlar kaydedildi!", "success");
      await ActivityLogger.log("update", "settings", `Title: ${title}`);
    } catch (error) {
      console.error("Save settings error:", error);
      Toast.show("Ayarlar kaydedilemedi", "error");
    }
  },

  // Email Templates
  getEmailTemplates() {
    return {
      welcome: {
        name: "Hoşgeldin",
        subject: "Verde'ye Hoş Geldiniz - {{full_name}}",
        body: "<h2>Merhaba {{full_name}},</h2>\n<p>Verde ailesine katıldığınız için teşekkür ederiz!</p>\n<p>Artık ilanlarınızı yayınlayabilirsiniz.</p>",
      },
      "listing-approved": {
        name: "İlan Onaylandı",
        subject: "İlanınız Onaylandı - {listing_title}",
        body: '<h2>İlanınız Onaylandı!</h2>\n<p>İlan: <strong>{listing_title}</strong></p>\n<p><a href="{listing_link}">İlanı Görüntüle</a></p>',
      },
      "listing-rejected": {
        name: "İlan Reddedildi",
        subject: "İlanınız Reddedildi - {listing_title}",
        body: "<h2>İlanınız Reddedildi</h2>\n<p>İlan: <strong>{listing_title}</strong></p>\n<p>Daha fazla bilgi için lütfen bizimle iletişime geçin.</p>",
      },
      "password-reset": {
        name: "Şifre Sıfırlama",
        subject: "Şifre Sıfırlama - Verde",
        body: '<h2>Şifre Sıfırlama Talebi</h2>\n<p>Şifrenizi sıfırlamak için bu bağlantıya tıklayın:</p>\n<p><a href="{reset_link}">Şifreyi Sıfırla</a></p>',
      },
      "new-message": {
        name: "Yeni Mesaj",
        subject: "Yeni bir mesajınız var! | Verde",
        body: "<h2>Merhaba {{full_name}},</h2><p>Verde üzerinden yeni bir mesajınız var.</p>",
      },
      "listing-sold": {
        name: "İlan Satıldı",
        subject: "İlanınız Satıldı - {listing_title}",
        body: "<h2>Tebrikler!</h2>\n<p>İlanınız <strong>{listing_title}</strong> başarıyla satıldı.</p>",
      },
    };
  },

  async selectEmailTemplate(templateKey) {
    if (!this.emailTemplates) {
      await this.loadEmailTemplates();
    }
    const template = this.emailTemplates[templateKey];
    if (!template) return;

    // DB Mapping for special templates
    const dbKey =
      templateKey === "new-message" ? "email_template_message" : null;

    if (dbKey) {
      const { data, error } = await window.supabase
        .from("system_settings")
        .select("value")
        .eq("key", dbKey)
        .single();

      if (data && data.value) {
        template.subject = data.value.subject;
        template.body = data.value.content;
      }
    }

    // Show editor
    document.getElementById("template-editor").style.display = "block";
    document.getElementById("template-title").textContent = template.name;
    document.getElementById("email-subject").value = template.subject;
    document.getElementById("email-body").value = template.body;

    // Store current template key
    this.currentTemplateKey = templateKey;

    // Highlight selected card
    document.querySelectorAll(".email-template-card").forEach((card) => {
      card.style.borderColor = "var(--border)";
    });

    // Find the card by checking its content or icon class as event.target is unreliable here
    const cards = document.querySelectorAll(".email-template-card");
    const templateIcons = {
      welcome: "fa-hand-holding-heart",
      "listing-approved": "fa-check-circle",
      "listing-rejected": "fa-times-circle",
      "password-reset": "fa-key",
      "new-message": "fa-comments",
      "listing-sold": "fa-tag",
    };
    const targetIcon = templateIcons[templateKey];
    cards.forEach((card) => {
      if (card.querySelector(`i.fa-${targetIcon.replace("fa-", "")}`)) {
        card.style.borderColor = "var(--primary)";
      }
    });

    Toast.show(`${template.name} şablonu açıldı`, "info");
  },

  async loadEmailTemplates() {
    // Initialize with defaults
    if (!this.emailTemplates) {
      this.emailTemplates = this.getEmailTemplates();
    }

    // Load from Supabase system_settings if available
    const { data: dbTemplates } = await window.supabase
      .from("system_settings")
      .select("*");

    if (dbTemplates) {
      dbTemplates.forEach((row) => {
        if (row.key === "email_template_message") {
          this.emailTemplates["new-message"].subject = row.value.subject;
          this.emailTemplates["new-message"].body = row.value.content;
        }
      });
    }
  },

  async saveEmailTemplate() {
    const subject = document.getElementById("email-subject").value.trim();
    const body = document.getElementById("email-body").value.trim();

    if (!subject || !body || !this.currentTemplateKey) {
      Toast.show("Lütfen tüm alanları doldurun", "error");
      return;
    }

    try {
      if (!this.emailTemplates) {
        this.emailTemplates = this.getEmailTemplates();
      }

      this.emailTemplates[this.currentTemplateKey] = {
        name: this.emailTemplates[this.currentTemplateKey].name,
        subject,
        body,
      };

      // DB Mapping
      const dbKey =
        this.currentTemplateKey === "new-message"
          ? "email_template_message"
          : null;

      if (dbKey) {
        const { error } = await window.supabase.from("system_settings").upsert({
          key: dbKey,
          value: { subject, content: body },
        });

        if (error) throw error;
      } else {
        // Fallback to localStorage for other templates for now
        localStorage.setItem(
          "admin-email-templates",
          JSON.stringify(this.emailTemplates),
        );
      }

      Toast.show("✓ E-mail şablonu başarıyla kaydedildi!", "success");
      await ActivityLogger.log(
        "update",
        "email-template",
        `Template: ${this.currentTemplateKey}`,
      );

      // Hide editor
      document.getElementById("template-editor").style.display = "none";
      this.currentTemplateKey = null;
    } catch (error) {
      console.error("Save template error:", error);
      Toast.show("Şablon kaydedilemedi: " + error.message, "error");
    }
  },

  async saveNotificationSettings() {
    const settings = {
      notify_new_listing: document.getElementById("notify-new-listing").checked,
      notify_new_user: document.getElementById("notify-new-user").checked,
      notify_new_message: document.getElementById("notify-new-message").checked,
      notify_pending_listings: document.getElementById(
        "notify-pending-listings",
      ).checked,
      notify_system_alerts: document.getElementById("notify-system-alerts")
        .checked,
      daily_digest_time: document.getElementById("daily-digest-time").value,
    };

    try {
      localStorage.setItem(
        "admin-notification-settings",
        JSON.stringify(settings),
      );
      Toast.show("✓ Bildirim ayarları kaydedildi!", "success");
      await ActivityLogger.log(
        "update",
        "settings",
        "Notification settings updated",
      );
    } catch (error) {
      console.error("Save notification settings error:", error);
      Toast.show("Bildirim ayarları kaydedilemedi", "error");
    }
  },

  loadNotificationSettings() {
    const settings = localStorage.getItem("admin-notification-settings");
    if (settings) {
      const parsed = JSON.parse(settings);
      document.getElementById("notify-new-listing").checked =
        parsed.notify_new_listing;
      document.getElementById("notify-new-user").checked =
        parsed.notify_new_user;
      document.getElementById("notify-new-message").checked =
        parsed.notify_new_message;
      document.getElementById("notify-pending-listings").checked =
        parsed.notify_pending_listings;
      document.getElementById("notify-system-alerts").checked =
        parsed.notify_system_alerts;
      document.getElementById("daily-digest-time").value =
        parsed.daily_digest_time;
    }
  },

  // ===== DASHBOARD CUSTOMIZATION =====

  toggleDashboardCustomization() {
    const panel = document.getElementById("dashboard-customization");
    if (panel.style.display === "none") {
      panel.style.display = "block";
    } else {
      panel.style.display = "none";
    }
  },

  toggleWidget(widgetName) {
    const widget = document.querySelector(`[data-widget="${widgetName}"]`);
    const checkbox = document.querySelector(
      `input[data-widget="${widgetName}"]`,
    );

    if (checkbox.checked) {
      widget.style.display = "block";
    } else {
      widget.style.display = "none";
    }
  },

  initDragAndDrop() {
    const container = document.getElementById("dashboard-widgets");
    if (!container) return;

    const cards = container.querySelectorAll('.stat-card[draggable="true"]');
    let draggedElement = null;

    cards.forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        draggedElement = card;
        card.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
        draggedElement = null;
      });

      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (draggedElement && draggedElement !== card) {
          card.classList.add("drag-over");
        }
      });

      card.addEventListener("dragleave", () => {
        card.classList.remove("drag-over");
      });

      card.addEventListener("drop", (e) => {
        e.preventDefault();
        card.classList.remove("drag-over");

        if (draggedElement && draggedElement !== card) {
          const allCards = [...container.querySelectorAll(".stat-card")];
          const draggedIndex = allCards.indexOf(draggedElement);
          const targetIndex = allCards.indexOf(card);

          if (draggedIndex < targetIndex) {
            card.after(draggedElement);
          } else {
            card.before(draggedElement);
          }

          Toast.show("Widget yeri değiştirildi", "info", 2000);
        }
      });
    });
  },

  saveDashboardLayout() {
    const container = document.getElementById("dashboard-widgets");
    const cards = container.querySelectorAll(".stat-card");

    const layout = {
      order: [],
      visibility: {},
    };

    cards.forEach((card) => {
      const widgetName = card.getAttribute("data-widget");
      layout.order.push(widgetName);
      layout.visibility[widgetName] = card.style.display !== "none";
    });

    localStorage.setItem("admin-dashboard-layout", JSON.stringify(layout));
    Toast.show("✓ Dashboard ayarları kaydedildi!", "success");
    ActivityLogger.log("update", "dashboard", "Layout saved");
  },

  loadDashboardLayout() {
    const saved = localStorage.getItem("admin-dashboard-layout");
    if (!saved) return;

    try {
      const layout = JSON.parse(saved);
      const container = document.getElementById("dashboard-widgets");

      // Reorder widgets
      layout.order.forEach((widgetName) => {
        const widget = container.querySelector(`[data-widget="${widgetName}"]`);
        if (widget) {
          container.appendChild(widget);
        }
      });

      // Apply visibility
      Object.keys(layout.visibility).forEach((widgetName) => {
        const widget = container.querySelector(`[data-widget="${widgetName}"]`);
        const checkbox = document.querySelector(
          `input[data-widget="${widgetName}"]`,
        );

        if (widget) {
          widget.style.display = layout.visibility[widgetName]
            ? "block"
            : "none";
        }
        if (checkbox) {
          checkbox.checked = layout.visibility[widgetName];
        }
      });
    } catch (error) {
      console.error("Load layout error:", error);
    }
  },

  resetDashboardLayout() {
    if (!confirm("Dashboard ayarlarını sıfırlamak istediğinize emin misiniz?"))
      return;

    localStorage.removeItem("admin-dashboard-layout");

    // Reset visibility
    const container = document.getElementById("dashboard-widgets");
    const cards = container.querySelectorAll(".stat-card");
    cards.forEach((card) => {
      card.style.display = "block";
    });

    // Reset checkboxes
    document.querySelectorAll(".widget-toggle input").forEach((cb) => {
      cb.checked = true;
    });

    Toast.show("✓ Dashboard ayarları sıfırlandı!", "success");
    ActivityLogger.log("delete", "dashboard", "Layout reset");

    // Reload page to restore default order
    setTimeout(() => location.reload(), 1000);
  },

  // ===== AUTOMATION FUNCTIONS =====

  async loadAutomation() {
    try {
      // Load task statuses from localStorage
      const taskStatuses = JSON.parse(
        localStorage.getItem("taskStatuses") || "{}",
      );

      // Update task status displays
      const tasks = [
        "archive_listings",
        "delete_inactive_users",
        "delete_spam_listings",
      ];
      tasks.forEach((task) => {
        const status = taskStatuses[task] !== false; // Default to true (active)
        const statusEl = document.querySelector(
          `[onclick="adminPanel.toggleTask('${task}')"]`,
        );
        if (statusEl) {
          statusEl.textContent = status
            ? '\n                                                <i class="fas fa-toggle-on"></i> Devre Dışı\n                                            '
            : '\n                                                <i class="fas fa-toggle-off"></i> Etkinleştir\n                                            ';
        }
      });

      Toast.show("✓ Otomasyon ayarları yüklendi", "success");
    } catch (error) {
      console.error("Automation load error:", error);
      Toast.show("Otomasyon ayarları yüklenirken hata oluştu", "error");
    }
  },

  switchAutomationTab(tab) {
    document.querySelectorAll(".automation-tab-content").forEach((el) => {
      el.style.display = "none";
    });
    document.querySelectorAll(".automation-tab").forEach((el) => {
      el.classList.remove("active");
    });

    document.getElementById(tab + "-tab").style.display = "block";
    document.querySelector(`[data-tab="${tab}"]`).classList.add("active");
  },

  toggleTask(taskName) {
    const taskStatuses = JSON.parse(
      localStorage.getItem("taskStatuses") || "{}",
    );
    taskStatuses[taskName] = taskStatuses[taskName] === false ? true : false;
    localStorage.setItem("taskStatuses", JSON.stringify(taskStatuses));
    Toast.show(
      taskStatuses[taskName]
        ? "Görev etkinleştirildi"
        : "Görev devre dışı bırakıldı",
      "success",
    );
  },

  async runTask(taskName) {
    try {
      const taskNames = {
        archive_listings: "İlanları Arşivle",
        delete_inactive_users: "İnaktif Hesapları Sil",
        delete_spam_listings: "Spam İlanları Temizle",
      };

      Toast.show(`⏳ ${taskNames[taskName]} çalıştırılıyor...`, "info");

      if (taskName === "archive_listings") {
        // Archive listings older than 90 days with no activity
        const { data: listings, error } = await window.supabase
          .from("listings")
          .update({ status: "archived" })
          .lt(
            "updated_at",
            new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          )
          .eq("status", "active");

        if (error) throw error;
        Toast.show(`✓ ${listings?.length || 0} ilan arşivlendi`, "success");
        document.getElementById("task-archive-last").textContent =
          new Date().toLocaleString("tr-TR");
      } else if (taskName === "delete_inactive_users") {
        // Delete users with no login for 180 days
        const { data: users } = await window.supabase
          .from("profiles")
          .select("id")
          .lt(
            "last_login",
            new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
          );

        if (users && users.length > 0) {
          const { error } = await window.supabase
            .from("profiles")
            .update({ status: "deleted" })
            .in(
              "id",
              users.map((u) => u.id),
            );

          if (error) throw error;
        }
        Toast.show(`✓ ${users?.length || 0} inaktif hesap silindi`, "success");
        document.getElementById("task-inactive-last").textContent =
          new Date().toLocaleString("tr-TR");
      } else if (taskName === "delete_spam_listings") {
        // Delete listings with 5+ reports
        const { data: spamListings } = await window.supabase
          .from("listings")
          .select("id")
          .gte("report_count", 5);

        if (spamListings && spamListings.length > 0) {
          const { error } = await window.supabase
            .from("listings")
            .update({ status: "deleted" })
            .in(
              "id",
              spamListings.map((l) => l.id),
            );

          if (error) throw error;
        }
        Toast.show(
          `✓ ${spamListings?.length || 0} spam ilan silindi`,
          "success",
        );
        document.getElementById("task-spam-last").textContent =
          new Date().toLocaleString("tr-TR");
      }

      ActivityLogger.log("run_task", "automation", taskName);
    } catch (error) {
      console.error("Task execution error:", error);
      Toast.show("Görev çalıştırılırken hata oluştu", "error");
    }
  },

  async runBackup() {
    try {
      Toast.show("⏳ Yedekleme başlatılıyor...", "info");

      // Get all important data
      const [profiles, listings, messages] = await Promise.all([
        window.supabase.from("profiles").select("*"),
        window.supabase.from("listings").select("*"),
        window.supabase.from("messages").select("*"),
      ]);

      const backupData = {
        timestamp: new Date().toISOString(),
        profiles: profiles.data,
        listings: listings.data,
        messages: messages.data,
      };

      // Save to localStorage with timestamp
      localStorage.setItem("lastBackupTime", new Date().toISOString());
      localStorage.setItem(
        "lastBackupData",
        JSON.stringify(backupData).slice(0, 50000000),
      ); // 50MB limit

      document.getElementById("last-backup-time").textContent =
        new Date().toLocaleString("tr-TR");
      Toast.show("✓ Yedekleme başarıyla tamamlandı", "success");
      ActivityLogger.log("create", "backup", "automated");
    } catch (error) {
      console.error("Backup error:", error);
      Toast.show("Yedekleme sırasında hata oluştu", "error");
    }
  },

  downloadBackup() {
    try {
      const backupData = localStorage.getItem("lastBackupData");
      if (!backupData) {
        Toast.show("Henüz yedekleme yapılmamış", "warning");
        return;
      }

      const dataStr = backupData;
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup-${new Date().getTime()}.json`;
      link.click();
      URL.revokeObjectURL(url);

      Toast.show("✓ Yedekleme indirildi", "success");
    } catch (error) {
      console.error("Download error:", error);
      Toast.show("İndirme başarısız", "error");
    }
  },

  updateCampaignPreview() {
    const type = document.getElementById("campaign-type").value;
    const subject = document.getElementById("campaign-subject").value;
    const message = document.getElementById("campaign-message").value;

    const preview = document.getElementById("campaign-preview");
    if (type && subject && message) {
      preview.innerHTML = `
                <div style="background: white; padding: 15px; border-radius: 6px;">
                    <div style="border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 10px;">
                        <strong style="color: var(--dark);">Konu:</strong> ${subject}
                    </div>
                    <div style="color: var(--gray-dark); white-space: pre-wrap;">${message.slice(0, 300)}${message.length > 300 ? "..." : ""}</div>
                </div>
            `;
    } else {
      preview.innerHTML =
        '<p style="color: var(--gray-dark); text-align: center;">Kampanya bilgilerini doldurunuz</p>';
    }

    // Calculate recipient count
    this.calculateCampaignRecipients(type);
  },

  async calculateCampaignRecipients(type) {
    try {
      let count = 0;

      if (type === "all_users") {
        const { count: userCount } = await window.supabase
          .from("profiles")
          .select("*", { count: "exact" });
        count = userCount;
      } else if (type === "inactive_users") {
        const { count: inactiveCount } = await window.supabase
          .from("profiles")
          .select("*", { count: "exact" })
          .lt(
            "last_login",
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          );
        count = inactiveCount;
      } else if (type === "premium_users") {
        const { count: premiumCount } = await window.supabase
          .from("profiles")
          .select("*", { count: "exact" })
          .eq("is_premium", true);
        count = premiumCount;
      } else if (type === "no_listings") {
        const { data: usersWithNoListings } = await window.supabase
          .from("profiles")
          .select("id")
          .not("id", "in", "(select user_id from listings)");
        count = usersWithNoListings?.length || 0;
      }

      document.getElementById("campaign-recipient-count").textContent = count;
    } catch (error) {
      console.error("Recipient calculation error:", error);
      document.getElementById("campaign-recipient-count").textContent = "?";
    }
  },

  async sendCampaign() {
    try {
      const type = document.getElementById("campaign-type").value;
      const subject = document.getElementById("campaign-subject").value;
      const message = document.getElementById("campaign-message").value;

      if (!type || !subject || !message) {
        Toast.show("Lütfen tüm alanları doldurunuz", "warning");
        return;
      }

      Toast.show("⏳ Email gönderiliyor...", "info");

      // In a real application, this would call a backend function
      // For now, we'll just log it and save to admin_logs
      const campaignData = {
        type,
        subject,
        message,
        sent_at: new Date().toISOString(),
        status: "completed",
      };

      const { error } = await window.supabase.from("admin_logs").insert({
        action: "send_campaign",
        target: `campaign_${type}`,
        details: JSON.stringify(campaignData),
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      Toast.show("✓ Email kampanyası gönderildi", "success");
      document.getElementById("campaign-type").value = "";
      document.getElementById("campaign-subject").value = "";
      document.getElementById("campaign-message").value = "";
      document.getElementById("campaign-preview").innerHTML =
        '<p style="color: var(--gray-dark); text-align: center;">Kampanya bilgilerini doldurunuz</p>';
      document.getElementById("campaign-recipient-count").textContent = "0";
    } catch (error) {
      console.error("Campaign send error:", error);
      Toast.show("Email gönderimi sırasında hata oluştu", "error");
    }
  },
  // CATEGORY MANAGEMENT

  // Common Icons List
  commonIcons: [
    "fa-home",
    "fa-user",
    "fa-cog",
    "fa-calendar",
    "fa-envelope",
    "fa-bell",
    "fa-search",
    "fa-bars",
    "fa-check",
    "fa-times",
    "fa-trash",
    "fa-edit",
    "fa-plus",
    "fa-minus",
    "fa-info-circle",
    "fa-exclamation-triangle",
    "fa-star",
    "fa-heart",
    "fa-camera",
    "fa-image",
    "fa-video",
    "fa-music",
    "fa-map-marker-alt",
    "fa-phone",
    "fa-comment",
    "fa-car",
    "fa-motorcycle",
    "fa-truck",
    "fa-bus",
    "fa-bicycle",
    "fa-ship",
    "fa-plane",
    "fa-tractor",
    "fa-taxi",
    "fa-building",
    "fa-city",
    "fa-hotel",
    "fa-warehouse",
    "fa-store",
    "fa-landmark",
    "fa-laptop",
    "fa-desktop",
    "fa-mobile-alt",
    "fa-tablet-alt",
    "fa-headphones",
    "fa-tv",
    "fa-gamepad",
    "fa-tshirt",
    "fa-shopping-bag",
    "fa-tag",
    "fa-couch",
    "fa-chair",
    "fa-tools",
    "fa-paw",
    "fa-futbol",
    "fa-basketball-ball",
    "fa-dumbbell",
    "fa-briefcase",
    "fa-handshake",
    "fa-utensils",
  ],

  // Helper to render icon selector
  renderIconSelector(currentIcon) {
    let html = `
            <div class="icon-selector-container">
                <div class="selected-icon-preview">
                    <i class="${currentIcon || "fas fa-question"} fa-2x"></i>
                    <input type="text" id="cat-icon" class="form-control" value="${currentIcon || ""}" placeholder="fa-class" onkeyup="document.querySelector('.selected-icon-preview i').className = 'fas ' + this.value">
                </div>
                <div class="icon-grid">
        `;

    this.commonIcons.forEach((icon) => {
      const isSelected = icon === currentIcon ? "selected" : "";
      html += `
                <div class="icon-option ${isSelected}" onclick="adminPanel.selectIcon('${icon}')">
                    <i class="fas ${icon}"></i>
                </div>
            `;
    });

    html += `
                </div>
            </div>
        `;
    return html;
  },

  selectIcon(iconClass) {
    document.getElementById("cat-icon").value = iconClass;
    document.querySelector(".selected-icon-preview i").className =
      `fas ${iconClass}`;

    // Update selection visual
    document
      .querySelectorAll(".icon-option")
      .forEach((el) => el.classList.remove("selected"));
    event.currentTarget.classList.add("selected");
  },

  async showAddCategoryForm(preSelectedParentId = null) {
    const iconSelectorHtml = this.renderIconSelector("fa-folder");
    
    let preLevel = 0;
    if (preSelectedParentId) {
      const parentCat = this.categories.find(c => c.id == preSelectedParentId);
      if (parentCat) {
        preLevel = (parentCat.level || 0) + 1;
      }
    }

        const content = `
            <div class="modal-tabs">
                <button class="modal-tab active" data-tab="tab-info" onclick="Modal.switchTab('tab-info')">Kategori Bilgisi</button>
                <button class="modal-tab" data-tab="tab-fields" onclick="Modal.switchTab('tab-fields')">Sorular</button>
                <button class="modal-tab" data-tab="tab-tech" onclick="Modal.switchTab('tab-tech')">Teknik Detaylar</button>
                <button class="modal-tab" data-tab="tab-json" onclick="Modal.switchTab('tab-json')">JSON</button>
            </div>
            <form id="category-form">
                <div id="tab-info" class="tab-pane active">
                    <div class="form-group">
                        <label>Kategori Adı</label>
                        <input type="text" id="cat-name" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Slug (URL) - Boş bırakılırsa otomatik üretilir</label>
                        <input type="text" id="cat-slug" class="form-control">
                    </div>
                    <div class="form-group">
                        <label>İkon Seçimi</label>
                        ${iconSelectorHtml}
                    </div>
                    <div class="form-group">
                        <label>İkon Rengi (Hex code)</label>
                        <input type="color" id="cat-color" class="form-control" value="#3b82f6">
                    </div>
                    <div class="form-group">
                        <label>Üst Kategori ID (Opsiyonel)</label>
                        <input type="text" id="cat-parent" class="form-control" value="${preSelectedParentId || ""}">
                    </div>
                    <div class="form-group">
                        <label>Seviye (0: Ana, 1: Alt, 2: Detay)</label>
                        <input type="number" id="cat-level" class="form-control" value="${preLevel}">
                    </div>
                </div>
                <div id="tab-fields" class="tab-pane">
                    ${this.renderFieldBuilder([])}
                </div>
                <div id="tab-tech" class="tab-pane">
                    ${this.renderTechnicalDetailsBuilder({})}
                </div>
                <div id="tab-json" class="tab-pane">
                    <div class="form-group" style="margin-top: 20px;">
                        <label>Ek Alanlar Konfigürasyonu (JSON - Otomatik güncellenir)</label>
                        <textarea id="cat-config" class="form-control" rows="15" 
                            style="font-family: monospace; white-space: pre;">{"fields": []}</textarea>
                    </div>
                </div>
            </form>
        `;

    Modal.open("Yeni Kategori Ekle", content, [
      { label: "İptal", class: "btn-secondary", action: "Modal.close()" },
      {
        label: "Kaydet",
        class: "btn-success",
        action: "adminPanel.saveCategory()",
      },
    ], true);
  },

  async editCategory(id) {
    try {
      const { data: cat, error } = await window.supabase
        .from("categories")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      const configStr = cat.extra_fields_config
        ? JSON.stringify(cat.extra_fields_config, null, 2)
        : "{}";
      const iconSelectorHtml = this.renderIconSelector(cat.icon);

      const content = `
                <div class="modal-tabs">
                    <button class="modal-tab active" data-tab="tab-info" onclick="Modal.switchTab('tab-info')">Kategori Bilgisi</button>
                    <button class="modal-tab" data-tab="tab-fields" onclick="Modal.switchTab('tab-fields')">Sorular</button>
                    <button class="modal-tab" data-tab="tab-tech" onclick="Modal.switchTab('tab-tech')">Teknik Detaylar</button>
                    <button class="modal-tab" data-tab="tab-json" onclick="Modal.switchTab('tab-json')">JSON</button>
                </div>
                <form id="category-form">
                    <div id="tab-info" class="tab-pane active">
                        <div class="form-group">
                            <label>Kategori Adı</label>
                            <input type="text" id="cat-name" class="form-control" value="${cat.name || ""}" required>
                        </div>
                        <div class="form-group">
                            <label>Slug (URL)</label>
                            <input type="text" id="cat-slug" class="form-control" value="${cat.slug || ""}">
                        </div>
                        <div class="form-group">
                            <label>İkon Seçimi</label>
                            ${iconSelectorHtml}
                        </div>
                        <div class="form-group">
                            <label>İkon Rengi</label>
                            <input type="color" id="cat-color" class="form-control" value="${cat.icon_color || "#3b82f6"}">
                        </div>
                        <div class="form-group">
                            <label>Üst Kategori ID</label>
                            <input type="number" id="cat-parent" class="form-control" value="${cat.parent_id || ""}">
                        </div>
                        <div class="form-group">
                            <label>Seviye</label>
                            <input type="number" id="cat-level" class="form-control" value="${cat.level || 0}">
                        </div>
                    </div>
                    <div id="tab-fields" class="tab-pane">
                        ${this.renderFieldBuilder(cat.extra_fields_config?.fields || [])}
                    </div>
                    <div id="tab-tech" class="tab-pane">
                        ${this.renderTechnicalDetailsBuilder(cat.extra_fields_config?.tech_details || {})}
                    </div>
                    <div id="tab-json" class="tab-pane">
                        <div class="form-group" style="margin-top: 20px;">
                            <label>Ek Alanlar Konfigürasyonu (JSON - Otomatik güncellenir)</label>
                            <textarea id="cat-config" class="form-control" rows="15" 
                                style="font-family: monospace; white-space: pre;">${configStr}</textarea>
                        </div>
                    </div>
                </form>
            `;

      Modal.open("Kategoriyi Düzenle", content, [
        { label: "İptal", class: "btn-secondary", action: "Modal.close()" },
        {
          label: "Güncelle",
          class: "btn-primary",
          action: `adminPanel.saveCategory('${id}')`,
        },
      ], true);
    } catch (error) {
      console.error("Category load error:", error);
      Toast.show("Kategori yüklenirken hata oluştu", "error");
    }
  },

  // ... rest of existing code ...

  // Drag & Drop Handlers
  handleDragStart(e, id) {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    e.target.closest("li").classList.add("dragging");
  },

  handleDragOver(e) {
    e.preventDefault();
    const targetLi = e.target.closest("li");
    if (targetLi) {
      targetLi.classList.add("drag-over");
    }
    e.dataTransfer.dropEffect = "move";
  },

  handleDragLeave(e) {
    const targetLi = e.target.closest("li");
    if (targetLi) {
      targetLi.classList.remove("drag-over");
    }
  },

  async handleDrop(e, targetId) {
    e.preventDefault();

    // Clean up styles
    document
      .querySelectorAll(".drag-over")
      .forEach((el) => el.classList.remove("drag-over"));
    document.querySelector(".dragging")?.classList.remove("dragging");

    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === targetId) return;

    // Prevent dragging a parent into its own child (infinite loop)
    if (targetId && this.isDescendant(draggedId, targetId)) {
      Toast.show("Bir kategori kendi altına tanışamaz!", "warning");
      return;
    }

    if (!confirm("Kategoriyi taşımak istediğinize emin misiniz?")) return;

    try {
      const { error } = await window.supabase
        .from("categories")
        .update({ parent_id: targetId }) // targetId null ise root olur
        .eq("id", draggedId);

      if (error) throw error;

      Toast.show("Kategori başarıyla taşındı", "success");
      this.loadCategories(); // Reload tree
    } catch (error) {
      console.error("Move category error:", error);
      Toast.show("Taşıma işlemi başarısız", "error");
    }
  },

  // Helper to check circular dependency
  isDescendant(parentId, childId) {
    const parentNode = document.getElementById(`cat-node-${parentId}`);
    const childNode = document.getElementById(`cat-node-${childId}`);
    return parentNode && parentNode.contains(childNode);
  },

  renderFieldBuilder(initialFields = []) {
    let html = `
        <div class="field-builder-container">
            <h3>Sorular ve Filtreler</h3>
            <div id="fields-list" class="fields-list">
    `;

    (initialFields || []).forEach((field, index) => {
      html += this.renderFieldRow(field, index);
    });

    html += `
            </div>
            <button type="button" class="btn btn-small btn-success" style="margin-top: 10px;" onclick="adminPanel.addNewFieldRow()">
                <i class="fas fa-plus"></i> Yeni Soru/Filtre Ekle
            </button>
        </div>
    `;
    return html;
  },

  renderFieldRow(field, index) {
    return `
        <div class="field-row" data-index="${index}">
            <div class="field-row-main">
                <div class="field-order-btns">
                    <button type="button" class="btn btn-tiny" onclick="adminPanel.moveFieldRow(this, 'up')" title="Yukarı Taşı"><i class="fas fa-chevron-up"></i></button>
                    <button type="button" class="btn btn-tiny" onclick="adminPanel.moveFieldRow(this, 'down')" title="Aşağı Taşı"><i class="fas fa-chevron-down"></i></button>
                </div>
                <input type="text" class="form-control f-label" value="${field.label || ""}" placeholder="Soru Etiketi (örn: Marka)" oninput="adminPanel.syncFieldsToJson()">
                <input type="text" class="form-control f-name" value="${field.name || ""}" placeholder="Sistem Adı (örn: brand)" oninput="adminPanel.syncFieldsToJson()">
                <select class="form-control f-type" onchange="adminPanel.syncFieldsToJson()">
                    <option value="text" ${field.type === "text" ? "selected" : ""}>Yazı</option>
                    <option value="number" ${field.type === "number" ? "selected" : ""}>Sayı</option>
                    <option value="select" ${field.type === "select" ? "selected" : ""}>Seçenekli (Dropdown)</option>
                </select>
                <button type="button" class="btn btn-small btn-danger" onclick="adminPanel.removeFieldRow(this)">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="field-row-options">
                <div class="f-options-container" style="display: ${field.type === "select" ? "block" : "none"}">
                    <input type="text" class="form-control f-options" value="${(field.options || []).join(", ")}" placeholder="Seçenekler (virgülle ayırın)" oninput="adminPanel.syncFieldsToJson()">
                    <small>Seçenekleri virgül ile ayırarak yazın (örn: Audi, BMW, Mercedes)</small>
                </div>
                <div class="field-row-toggles">
                    <label>
                        <input type="checkbox" class="f-required" ${field.required ? "checked" : ""} onchange="adminPanel.syncFieldsToJson()"> <b>Zorunlu</b>
                    </label>
                    <label>
                        <input type="checkbox" class="f-filter" ${field.isFilter !== false ? "checked" : ""} onchange="adminPanel.syncFieldsToJson()"> Yan menüde filtre olsun
                    </label>
                </div>
            </div>
        </div>
    `;
  },

  renderTechnicalDetailsBuilder(initialTechDetails = {}) {
    let html = `
        <div class="field-builder-container">
            <h3><i class="fas fa-tools"></i> Teknik Detay Grupları</h3>
            <div id="tech-list" class="fields-list">
    `;

    Object.entries(initialTechDetails || {}).forEach(([groupName, features], index) => {
      html += this.renderTechnicalDetailRow(groupName, features, index);
    });

    html += `
            </div>
            <button type="button" class="btn btn-small btn-success" style="margin-top: 10px;" onclick="adminPanel.addNewTechDetailRow()">
                <i class="fas fa-plus"></i> Yeni Grup Ekle
            </button>
        </div>
    `;
    return html;
  },

  renderTechnicalDetailRow(groupName, features, index) {
    return `
        <div class="field-row tech-row" data-index="${index}">
            <div class="field-row-main">
                <input type="text" class="form-control t-group" value="${groupName || ""}" placeholder="Grup Adı (örn: Güvenlik)" oninput="adminPanel.syncFieldsToJson()" style="flex: 1;">
                <button type="button" class="btn btn-small btn-danger" onclick="adminPanel.removeFieldRow(this)">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="field-row-options">
                <div class="f-options-container">
                    <textarea class="form-control t-features" rows="2" placeholder="Özellikler (virgülle ayırın)" oninput="adminPanel.syncFieldsToJson()">${(features || []).join(", ")}</textarea>
                    <small>Özellikleri virgül ile ayırarak yazın (örn: ABS, Airbag, ESP)</small>
                </div>
            </div>
        </div>
    `;
  },

  addNewFieldRow() {
    const list = document.getElementById("fields-list");
    const index = Date.now();
    const html = this.renderFieldRow({}, index);
    list.insertAdjacentHTML("beforeend", html);
    this.syncFieldsToJson();
  },

  addNewTechDetailRow() {
    const list = document.getElementById("tech-list");
    const index = Date.now();
    const html = this.renderTechnicalDetailRow("", [], index);
    list.insertAdjacentHTML("beforeend", html);
    this.syncFieldsToJson();
  },

  removeFieldRow(btn) {
    btn.closest('.field-row').remove();
    this.syncFieldsToJson();
  },

  moveFieldRow(btn, direction) {
    const row = btn.closest('.field-row');
    if (direction === 'up') {
      const prev = row.previousElementSibling;
      if (prev && prev.classList.contains('field-row')) {
        row.parentNode.insertBefore(row, prev);
      }
    } else {
      const next = row.nextElementSibling;
      if (next && next.classList.contains('field-row')) {
        row.parentNode.insertBefore(next, row);
      }
    }
    this.syncFieldsToJson();
  },

  syncFieldsToJson() {
    const configTextarea = document.getElementById("cat-config");
    if (!configTextarea) return;

    const fields = [];
    document.querySelectorAll("#fields-list .field-row").forEach((row) => {
      const labelInput = row.querySelector(".f-label");
      const nameInput = row.querySelector(".f-name");
      const typeInput = row.querySelector(".f-type");
      const optionsInput = row.querySelector(".f-options");
      const filterInput = row.querySelector(".f-filter");
      const requiredInput = row.querySelector(".f-required");

      if (!labelInput || !nameInput || !typeInput) return;

      const label = labelInput.value.trim();
      const name = nameInput.value.trim() || label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      const type = typeInput.value;
      const optionsStr = optionsInput ? optionsInput.value : "";
      const isFilter = filterInput ? filterInput.checked : false;
      const isRequired = requiredInput ? requiredInput.checked : false;

      const field = {
        name,
        label,
        type,
        required: isRequired,
        isFilter,
      };

      if (type === "select" && optionsStr) {
        field.options = optionsStr.split(",").map((o) => o.trim()).filter((o) => o);
      }

      const optionsContainer = row.querySelector(".f-options-container");
      if (optionsContainer) {
        optionsContainer.style.display = type === "select" ? "block" : "none";
      }

      if (label) fields.push(field);
    });

    const tech_details = {};
    document.querySelectorAll("#tech-list .tech-row").forEach((row) => {
      const groupInput = row.querySelector(".t-group");
      const featuresInput = row.querySelector(".t-features");

      if (groupInput && featuresInput) {
        const groupName = groupInput.value.trim();
        const featuresStr = featuresInput.value.trim();

        if (groupName) {
          tech_details[groupName] = featuresStr ? featuresStr.split(",").map((f) => f.trim()).filter((f) => f) : [];
        }
      }
    });

    const config = { fields, tech_details };
    configTextarea.value = JSON.stringify(config, null, 2);
  },

  async saveCategory(id = null) {
    try {
      const name = document.getElementById("cat-name").value;
      let slug = document.getElementById("cat-slug").value;
      const icon = document.getElementById("cat-icon").value;
      const icon_color = document.getElementById("cat-color").value;
      const parent_id = document.getElementById("cat-parent").value || null;
      const level = parseInt(document.getElementById("cat-level").value) || 0;

      // Force sync from builder UI to JSON textarea before saving
      this.syncFieldsToJson();
      const configStr = document.getElementById("cat-config").value;

      if (!name) {
        Toast.show("Kategori adı zorunludur", "warning");
        return;
      }

      // Auto-generate slug if empty
      if (!slug) {
        slug = name
          .toLowerCase()
          .replace(/ğ/g, "g")
          .replace(/ü/g, "u")
          .replace(/ş/g, "s")
          .replace(/ı/g, "i")
          .replace(/ö/g, "o")
          .replace(/ç/g, "c")
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-");
      }

      // Parse JSON
      let extra_fields_config = {};
      try {
        extra_fields_config = JSON.parse(configStr);
      } catch (e) {
        Toast.show("Geçersiz JSON formatı!", "error");
        return;
      }

      const data = {
        name,
        slug,
        icon,
        icon_color,
        parent_id,
        level,
        extra_fields_config,
      };

      let error;
      if (id) {
        const { error: updateError } = await window.supabase
          .from("categories")
          .update(data)
          .eq("id", id);
        error = updateError;
      } else {
        const { error: insertError } = await window.supabase
          .from("categories")
          .insert(data);
        error = insertError;
      }

      if (error) throw error;

      Toast.show(id ? "Kategori güncellendi" : "Kategori eklendi", "success");
      Modal.close();
      this.loadCategories();
    } catch (error) {
      console.error("Save category error:", error);
      Toast.show("Kaydetme hatası: " + error.message, "error");
    }
  },

  async deleteCategory(id) {
    if (!confirm("Bu kategoriyi silmek istediğinizden emin misiniz?")) return;

    try {
      const { error } = await window.supabase
        .from("categories")
        .delete()
        .eq("id", id);

      if (error) throw error;

      Toast.show("Kategori silindi", "success");
      this.loadCategories();
    } catch (error) {
      console.error("Delete category error:", error);
      Toast.show("Silme hatası: " + error.message, "error");
    }
  },

    async exportCategories() {
        try {
            const { data, error } = await window.supabase
                .from('categories')
                .select('*')
                .order('id', { ascending: true });
            
            if (error) throw error;
            
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `categories_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            Toast.show('Yedek başarıyla indirildi', 'success');
        } catch (error) {
            console.error('Export categories error:', error);
            Toast.show('Yedekleme hatası: ' + error.message, 'error');
        }
    },

    async importCategories(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!confirm('Dosyadaki kategoriler yüklenecek ve var olan IDler güncellenecektir. Geri alınamaz işlem, devam etmek istiyor musunuz?')) {
            event.target.value = ''; 
            return;
        }

        Toast.show('Yükleniyor, lütfen bekleyin...', 'info');

        try {
            const text = await file.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                Toast.show('Geçersiz JSON dosyası', 'error');
                event.target.value = '';
                return;
            }

            if (!Array.isArray(data)) {
                Toast.show('JSON dosyası geçerli bir kategori listesi içermiyor', 'error');
                event.target.value = '';
                return;
            }

            const { error } = await window.supabase
                .from('categories')
                .upsert(data, { onConflict: 'id' });
                
            if (error) throw error;
            
            Toast.show('Kategoriler başarıyla geri yüklendi', 'success');
            this.loadCategories();
        } catch (error) {
            console.error('Import error:', error);
            Toast.show('İçe aktarma hatası: ' + error.message, 'error');
        } finally {
            event.target.value = ''; 
        }
    }

};

// Initialize on load
document.addEventListener("DOMContentLoaded", () => {
  adminPanel.init();
});

// Reklam Yönetimi sayfasına yönlendirme
document.addEventListener("DOMContentLoaded", () => {
  const bannerNavItem = document.querySelector(
    '.nav-item[data-section="banners"]',
  );
  if (bannerNavItem) {
    bannerNavItem.addEventListener("click", () => {
      window.location.href = "html/banner-settings.html";
    });
  }

  // Yorum Yönetimi sayfasına yönlendirme
  const reviewsNavItem = document.querySelector(
    '.nav-item[data-section="reviews"]',
  );
  if (reviewsNavItem) {
    reviewsNavItem.addEventListener("click", () => {
      window.location.href = "html/review-management.html";
    });
  }
});

// Make objects global
window.Modal = Modal;
window.Toast = Toast;
window.adminPanel = adminPanel;
