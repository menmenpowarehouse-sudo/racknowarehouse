/**
 * MBS Point-Bin WMS — Bahasa Melayu / English Bilingual Dictionary
 */
(function () {
  const DICT = {
    en: {
      home: "Home",
      demoBanner: "DEMO MODE (Local Browser Storage) — Paste Firebase & Apps Script URL in js/branch.js to go LIVE",
      liveBanner: "LIVE MODE — Connected to Firebase & Google Sheets",
      portalTitle: "MBS Warehouse Point-Bin & Order System",
      portalSub: "Select your operational module (Independent pages, shared database)",
      putawayTitle: "Put-Away / Rack Stocking",
      putawayDesc: "Scan rack + item (3x match guard), photo upload to Drive, split/replace racks, rack view.",
      orderTitle: "Branch Ordering",
      orderDesc: "Browse catalog & stock, trolley checkout, custom item, pending history & urgent add-on.",
      pickTitle: "Warehouse Picking",
      pickDesc: "Rack A-Z item view & single-branch view, move to No Stock, latest 1,000 pick logs.",
      restockTitle: "Restock & Admin",
      restockDesc: "Pending restock queue, branch/staff manager, item/photo editor, logs & stock export.",

      // Common
      login: "Login",
      logout: "Logout",
      branch: "Branch",
      staff: "Staff Name",
      password: "Password",
      save: "Confirm & Save",
      cancel: "Cancel",
      close: "Close",
      search: "Search",
      scan: "Scan",
      edit: "Edit",
      delete: "Delete",
      refresh: "Refresh",
      barcode: "Barcode / Item Code",
      itemName: "Item Name",
      brand: "Brand",
      stockQty: "Stock Quantity (Shared across all racks)",
      rackCode: "Rack Code",
      status: "Status",
      qty: "Qty",
      noData: "No records found.",
      loading: "Loading...",
      wrongLogin: "Invalid Branch, Staff, or Password.",

      // Put-Away Page
      tabPutaway: "Put-Away Stocking",
      tabRackView: "Check Rack (View Only)",
      currentRack: "Current Rack Code",
      noRackSet: "NOT SET (Required first!)",
      changeRackBtn: "Change / Set Rack Code",
      rackRequiredErr: "Error: Rack Code is empty! Please scan or enter Rack Code first.",
      rackReminderText: "5 minutes passed. Still working on rack",
      keepRack: "Keep Current Rack",
      rackHistory: "Recent Rack History",
      scanItemBtn: "Scan Item (3x Match)",
      lookupBtn: "Lookup",
      newItemTag: "NEW ITEM (Not in Master/Firebase)",
      existingItemTag: "EXISTING ITEM",
      noPhoto: "No Photo",
      editPhoto: "Photo",
      uploadingPhoto: "Uploading square compressed photo...",
      cropTitle: "Square Crop (1:1) & Compress",
      cropHint: "Drag image to adjust, zoom if needed. Auto-cropped to 400×400 square (≤45 KB).",
      cropZoom: "Zoom",
      cropRotate: "Rotate 90°",
      cropConfirm: "Crop & Upload",
      oldRackLabel: "Existing Old Rack(s)",
      rackConflictTitle: "Rack Code Differs from Existing Rack — Choose Action:",
      optSplit: "Split / Keep Both Racks (Add current rack to existing)",
      optMoveOld: "Move to Old Rack (Keep old rack & switch current rack to old)",
      optReplaceNew: "Keep New Rack Only (Delete old rack(s))",
      savedSuccess: "Saved to Firebase!",
      viewRackPrompt: "Scan or enter a Rack Code to view all items currently placed in it (Read-Only).",

      // Scanner
      scanTitle: "Camera Scanner (QR / Code128 / Barcode)",
      scanRule: "Hold steady: requires 3 consecutive identical scans. Camera closes automatically.",
      scanWaiting: "Waiting for barcode / QR...",
      scanMatched: "Confirmed 3/3!",
      scanMismatch: "Mismatch detected — reset to 0/3!",

      // Order Page
      tabCatalog: "Select Items",
      tabPickNow: "Pick Now",
      tabTrolley: "Trolley",
      tabPending: "History & Pending",
      viewTrolleyBtn: "View Trolley",
      clearTrolleyBtn: "Clear Trolley",
      pickNowBanner: "⚡ PICK NOW Zone — Freshly arrived items ready to order even before permanent racking!",
      pickNowSetBtn: "Set Rack = PICKNOW (New Stock)",
      pickNowPreserved: "⚡ PICKNOW Mode: Existing permanent rack(s) stay untouched!",
      pickNowToggleLabel: "⚡ Mark as PICK NOW (Visible in Branch Pick Now tab, does not affect permanent racks)",
      restoreActiveLabel: "✓ Item was NO_STOCK (Pending Restock) — Restore to ACTIVE on save!",
      alreadyPickedBy: "Already picked by",
      searchCatalogPlaceholder: "Search barcode, name, brand...",
      searchSheetBtn: "Lookup 200k Sheet",
      customItemBtn: "+ Custom Item",
      addToCart: "Add to Cart",
      trolleyTitle: "Trolley (Pending Confirmation)",
      submitOrder: "Confirm & Submit Order",
      emptyTrolley: "Trolley is empty.",
      orderSubmitted: "Order submitted to Warehouse!",
      pendingHelp: "Unpicked & No-Stock items stay here automatically. Do NOT re-order — use [+ Add Qty / Urgent] for customer add-ons.",
      addUrgentBtn: "+ Add Qty / Urgent",
      urgentModalTitle: "Add Quantity & Escalate to Urgent Order",
      extraQty: "Additional Quantity (+)",
      custContact: "Customer Name / Phone",
      remark: "Remark / Reason",
      confirmUrgent: "Submit Urgent Add-On",

      // Pick Page
      tabPickList: "Picking List",
      tabPickLog: "History Log (Latest 1,000)",
      modeByItem: "By Item (Rack A–Z)",
      modeByBranch: "Single Branch",
      allBranches: "Select a Branch...",
      pickedBtn: "Picked",
      moveNoStockBtn: "Move to No Stock",
      urgentTag: "URGENT",
      noStockRuleNote: "Note: Stock 0 does NOT auto-move to Pending. Only clicking [Move to No Stock] flags Pending.",

      // Restock / Admin
      tabRestockQueue: "Pending Restock",
      tabBranchStaff: "Branches & Staff",
      tabItemEditor: "Item / Photo & Export",
      tabAdminTools: "Debug & Logs",
      markRestocked: "Restocked (Set Active)",
      exportStockCsv: "Export Warehouse Stock CSV",
      exportBranchJs: "Download Updated branch.js",
      exportPendingCsv: "Export Pending CSV",
      exportRestockCsv: "Export Pending Restock",
      exportRestockTitle: "Export Pending Restock (Filter Brand · Grouped by Branch)",
      allBrands: "All Brands",
      allBranchesOpt: "All Branches (Grouped by Branch)",
      noBrandTag: "(No Brand)",
      editBrandBtn: "Edit Brand",
      editBrandTitle: "Edit Brand",
      brandUpdated: "Brand updated!"
    },
    bm: {
      home: "Utama",
      demoBanner: "MOD DEMO (Storan Tempatan) — Masukkan Firebase & URL Apps Script dalam js/branch.js untuk mod LIVE",
      liveBanner: "MOD LIVE — Disambung ke Firebase & Google Sheets",
      portalTitle: "Sistem Point-Bin & Pesanan Gudang MBS",
      portalSub: "Pilih modul operasi anda (Halaman berasingan, pangkalan data sama)",
      putawayTitle: "Susun Barang (Put-Away)",
      putawayDesc: "Imbas rak + barang (3x imbasan sah), muat naik gambar Drive, gabung/ganti rak & semak rak.",
      orderTitle: "Pesanan Cawangan (Order)",
      orderDesc: "Pilih barang & stok, troli pesanan, barang manual, sejarah pending & tambah Urgent.",
      pickTitle: "Ambil Barang (Picking)",
      pickDesc: "Susunan rak A-Z ikut barang atau ikut cawangan, tandakan Tiada Stok & log 1,000 terkini.",
      restockTitle: "Restock & Admin",
      restockDesc: "Senarai Pending Restock, urus cawangan/staf, edit gambar/barang, log & eksport stok.",

      // Common
      login: "Log Masuk",
      logout: "Log Keluar",
      branch: "Cawangan (Branch)",
      staff: "Nama Staf",
      password: "Kata Laluan",
      save: "Sahkan & Simpan",
      cancel: "Batal",
      close: "Tutup",
      search: "Cari",
      scan: "Imbas",
      edit: "Edit",
      delete: "Padam",
      refresh: "Muat Semula",
      barcode: "Barkod / Kod Barang",
      itemName: "Nama Barang",
      brand: "Jenama (Brand)",
      stockQty: "Kuantiti Stok (Dikongsi semua rak)",
      rackCode: "Kod Rak (Rack Code)",
      status: "Status",
      qty: "Kuantiti",
      noData: "Tiada rekod dijumpai.",
      loading: "Memuatkan...",
      wrongLogin: "Cawangan, Staf atau Kata Laluan tidak sah.",

      // Put-Away Page
      tabPutaway: "Susun Barang",
      tabRackView: "Semak Rak (Lihat Sahaja)",
      currentRack: "Kod Rak Semasa",
      noRackSet: "BELUM DITETAPKAN (Wajib isi dulu!)",
      changeRackBtn: "Tukar / Tetapkan Kod Rak",
      rackRequiredErr: "Ralat: Kod Rak kosong! Sila imbas atau taip Kod Rak dahulu.",
      rackReminderText: "Sudah 5 minit. Masih menyusun di rak",
      keepRack: "Kekal Rak Ini",
      rackHistory: "Sejarah Rak Terkini",
      scanItemBtn: "Imbas Barang (3x Sah)",
      lookupBtn: "Semak",
      newItemTag: "BARANG BARU (Tiada dalam Master/Firebase)",
      existingItemTag: "BARANG SEDIA ADA",
      noPhoto: "Tiada Gambar",
      editPhoto: "Gambar",
      uploadingPhoto: "Memuat naik gambar segi empat mampat...",
      cropTitle: "Potong Segi Empat (1:1) & Mampat",
      cropHint: "Seret gambar untuk laras kedudukan. Dipotong automatik 400×400 segi empat (≤45 KB).",
      cropZoom: "Zum",
      cropRotate: "Pusing 90°",
      cropConfirm: "Potong & Muat Naik",
      oldRackLabel: "Rak Lama Sedia Ada",
      rackConflictTitle: "Kod Rak Berbeza dari Rak Lama — Pilih Tindakan:",
      optSplit: "Bahagi 2 Zon (Tambah rak baru & kekalkan rak lama)",
      optMoveOld: "Susun ke Rak Lama (Kekal rak lama & tukar rak semasa ke rak lama)",
      optReplaceNew: "Kekal Rak Baru Sahaja (Padam rak lama)",
      savedSuccess: "Berjaya disimpan ke Firebase!",
      viewRackPrompt: "Imbas atau masukkan Kod Rak untuk melihat semua barang di rak ini (Lihat Sahaja).",

      // Scanner
      scanTitle: "Pengimbas Kamera (QR / Code128 / Barkod)",
      scanRule: "Pegang stabil: perlu 3 imbasan berturut-turut yang sama. Kamera ditutup automatik.",
      scanWaiting: "Menunggu barkod / QR...",
      scanMatched: "Disahkan 3/3!",
      scanMismatch: "Tidak sepadan — set semula 0/3!",

      // Order Page
      tabCatalog: "Pilih Barang",
      tabPickNow: "Pick Now",
      tabTrolley: "Troli",
      tabPending: "Sejarah & Pending",
      viewTrolleyBtn: "Lihat Troli",
      clearTrolleyBtn: "Kosongkan Troli",
      pickNowBanner: "⚡ Zon PICK NOW — Barang baru sampai yang boleh dipesan segera walaupun belum naik rak kekal!",
      pickNowSetBtn: "Tetapkan Rak = PICKNOW (Stok Baru)",
      pickNowPreserved: "⚡ Mod PICKNOW: Rak kekal sedia ada TIDAK diubah!",
      pickNowToggleLabel: "⚡ Tanda sebagai PICK NOW (Dipaparkan di tab Pick Now cawangan, tidak ganggu rak kekal)",
      restoreActiveLabel: "✓ Barang ini NO_STOCK (Pending Restock) — Aktifkan semula (ACTIVE) apabila simpan!",
      alreadyPickedBy: "Sudah diambil oleh",
      searchCatalogPlaceholder: "Cari barkod, nama barang, jenama...",
      searchSheetBtn: "Cari 200k Sheet",
      customItemBtn: "+ Barang Manual",
      addToCart: "Masuk Troli",
      trolleyTitle: "Troli (Menunggu Pengesahan)",
      submitOrder: "Sahkan & Hantar Pesanan",
      emptyTrolley: "Troli masih kosong.",
      orderSubmitted: "Pesanan berjaya dihantar ke Gudang!",
      pendingHelp: "Barang belum diambil / Tiada Stok kekal di sini. TIDAK perlu pesan semula — tekan [+ Tambah / Urgent] jika pelanggan tambah kuantiti.",
      addUrgentBtn: "+ Tambah / Urgent",
      urgentModalTitle: "Tambah Kuantiti & Hantar ke Urgent Order",
      extraQty: "Kuantiti Tambahan (+)",
      custContact: "Nama / No. Telefon Pelanggan",
      remark: "Catatan / Sebab (Remark)",
      confirmUrgent: "Hantar Urgent",

      // Pick Page
      tabPickList: "Senarai Ambil",
      tabPickLog: "Sejarah Log (1,000 Terkini)",
      modeByItem: "Ikut Barang (Rak A–Z)",
      modeByBranch: "Satu Cawangan",
      allBranches: "Pilih Cawangan...",
      pickedBtn: "Sudah Ambil",
      moveNoStockBtn: "Pindah ke Tiada Stok",
      urgentTag: "URGENT",
      noStockRuleNote: "Nota: Stok 0 TIDAK masuk Pending secara automatik. Hanya klik [Pindah ke Tiada Stok] menukar status Pending.",

      // Restock / Admin
      tabRestockQueue: "Pending Restock",
      tabBranchStaff: "Cawangan & Staf",
      tabItemEditor: "Barang / Gambar & Eksport",
      tabAdminTools: "Debug & Log",
      markRestocked: "Sudah Isi (Aktifkan)",
      exportStockCsv: "Eksport Senarai Stok Gudang (CSV)",
      exportBranchJs: "Muat Turun branch.js Terkini",
      exportPendingCsv: "Eksport Pending CSV",
      exportRestockCsv: "Eksport Pending Restock",
      exportRestockTitle: "Eksport Pending Restock (Tapis Brand · Ikut Cawangan)",
      allBrands: "Semua Jenama (Brand)",
      allBranchesOpt: "Semua Cawangan (Disusun ikut Cawangan)",
      noBrandTag: "(Tiada Jenama)",
      editBrandBtn: "Edit Brand",
      editBrandTitle: "Kemaskini Jenama (Brand)",
      brandUpdated: "Jenama berjaya dikemaskini!"
    }
  };

  let currentLang = localStorage.getItem("mbs_lang") || "bm";

  window.t = function (key) {
    return (DICT[currentLang] && DICT[currentLang][key]) || DICT.en[key] || key;
  };

  window.getLang = function () {
    return currentLang;
  };

  window.setLang = function (lang) {
    currentLang = lang === "en" ? "en" : "bm";
    localStorage.setItem("mbs_lang", currentLang);
    applyI18n();
    document.dispatchEvent(new CustomEvent("mbs:langchange", { detail: currentLang }));
  };

  window.toggleLang = function () {
    setLang(currentLang === "bm" ? "en" : "bm");
  };

  window.applyI18n = function () {
    document.documentElement.lang = currentLang === "bm" ? "ms" : "en";
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    const langBtn = document.getElementById("lang-toggle-btn");
    if (langBtn) langBtn.textContent = currentLang === "bm" ? "BM / EN" : "EN / BM";
  };

  // Global toast helper
  window.showToast = function (msg) {
    let box = document.getElementById("toast-box");
    if (!box) {
      box = document.createElement("div");
      box.id = "toast-box";
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");
      document.body.appendChild(box);
    }
    box.textContent = msg;
    box.classList.add("show");
    clearTimeout(box._timer);
    box._timer = setTimeout(() => box.classList.remove("show"), 2600);
  };

  // Safe DOM text helper & light-dismiss fallback for <dialog closedby="any">
  window.initDialogPolyfill = function () {
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (e, dialog) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      document.querySelectorAll('dialog[closedby="any"]').forEach((dialog) => {
        if (dialog._ldBound) return;
        dialog._ldBound = true;
        let pressedOutside = false;
        dialog.addEventListener("pointerdown", (e) => { pressedOutside = outside(e, dialog); });
        dialog.addEventListener("pointerup", (e) => { if (pressedOutside && outside(e, dialog)) dialog.close(); });
      });
    }
  };

  // Accessible Tabs helper (complies with modern-web-guidance tabs pattern)
  window.initTabs = function (root = document) {
    root.querySelectorAll(".tabs").forEach((tabsEl) => {
      const tablist = tabsEl.querySelector('[role="tablist"]');
      if (!tablist || tablist._bound) return;
      tablist._bound = true;
      const tabs = [...tablist.querySelectorAll('[role="tab"]')];
      const panels = tabs.map((tab) =>
        tabsEl.querySelector(`[role="tabpanel"][aria-labelledby="${tab.id}"]`)
      );

      const activate = (targetTab) => {
        tabs.forEach((tab, idx) => {
          const isSel = tab === targetTab;
          tab.setAttribute("aria-selected", isSel ? "true" : "false");
          tab.toggleAttribute("focusgroupstart", isSel);
          const panel = panels[idx];
          if (panel) {
            if (isSel) {
              panel.removeAttribute("hidden");
            } else {
              panel.setAttribute("hidden", "until-found");
            }
          }
        });
        targetTab.scrollIntoView({ block: "nearest", inline: "nearest" });
        tabsEl.dispatchEvent(new CustomEvent("mbs:tabchange", { detail: targetTab.id }));
      };

      tabs.forEach((tab) => {
        tab.addEventListener("click", () => activate(tab));
        tab.addEventListener("keydown", (e) => {
          const idx = tabs.indexOf(tab);
          if (e.key === "ArrowRight") {
            const nxt = tabs[(idx + 1) % tabs.length];
            nxt.focus();
            activate(nxt);
          } else if (e.key === "ArrowLeft") {
            const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
            prev.focus();
            activate(prev);
          }
        });
      });

      panels.forEach((panel, idx) => {
        if (!panel) return;
        panel.addEventListener("beforematch", () => activate(tabs[idx]));
      });
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    applyI18n();
    initDialogPolyfill();
    initTabs();
  });
})();
