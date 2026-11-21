/**
 * MBS Point-Bin WMS — Unified Data Layer (Firebase Firestore + Google Apps Script + Demo Fallback)
 *
 * - Lazy single-item writes to Firebase `items/{barcode}` (NEVER bulk-loads 200k items!)
 * - Single-row fast lookup against Google Sheet `Item_Master` via Apps Script `createTextFinder`
 * - Compresses phone photos (500x500 JPEG ~35KB) -> uploads to Google Drive -> creates Share URL -> updates Sheet & Firebase
 * - Maintains rolling latest 1,000 logs in `pick_logs`
 * - Maintains rolling 100 PO history entries per (branch, barcode) in Google Sheet `PO_History`
 * - Auto-runs in Built-in Local Demo Mode (localStorage) if FIREBASE_CONFIG.apiKey is blank
 */
(function () {
  const LS_KEY = "mbs_wms_demo_db_v2";
  const CACHE_ITEMS_KEY = "mbs_fb_items_cache_v1";
  const CACHE_ITEMS_TS_KEY = "mbs_fb_items_last_ts_v1";
  const CACHE_ACC_KEY = "mbs_fb_accounts_cache_v1";
  const cfg = () => window.MBS_CONFIG || {};

  let isLiveFirebase = false;
  let db = null;
  let fs = null; // firestore module functions

  // Session quota telemetry (visible in Admin Debug tab)
  const quotaStats = { reads: 0, writes: 0, cacheHits: 0 };
  const trackRead = (n = 1) => { quotaStats.reads += n; };
  const trackWrite = (n = 1) => { quotaStats.writes += n; };
  const trackCacheHit = (n = 1) => { quotaStats.cacheHits += n; };

  function loadLocalItemsCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_ITEMS_KEY) || "{}"); } catch (_) { return {}; }
  }
  function saveLocalItemsCache(mapObj, lastTs) {
    try {
      localStorage.setItem(CACHE_ITEMS_KEY, JSON.stringify(mapObj));
      if (lastTs) localStorage.setItem(CACHE_ITEMS_TS_KEY, String(lastTs));
    } catch (_) {
      // Ignore quota exceeded if browser storage is tight
    }
  }
  function upsertLocalItemCache(record) {
    if (!record || !record.barcode) return;
    const map = loadLocalItemsCache();
    map[record.barcode] = record;
    saveLocalItemsCache(map, Math.max(Number(localStorage.getItem(CACHE_ITEMS_TS_KEY) || 0), record.updated_at || 0));
  }

  function normalizeRack(code) {
    const raw = String(code || "").trim().toUpperCase();
    if (raw.replace(/\s+/g, "") === "PICKNOW") return "PICKNOW";
    return raw;
  }

  function isPickNowItem(item) {
    if (!item) return false;
    if (item.pick_now === true) return true;
    return (item.rack_codes || []).some((r) => normalizeRack(r) === "PICKNOW");
  }

  function seedDemoData() {
    const existing = localStorage.getItem(LS_KEY);
    if (existing) {
      try { return JSON.parse(existing); } catch (_) {}
    }
    const now = Date.now();
    const initial = {
      items: {
        "9789834912345": {
          barcode: "9789834912345",
          item_name: "Buku Teks Matematik Tingkatan 1 KSSM",
          brand: "DBP",
          photo_url: "",
          rack_codes: ["TB-01-01"],
          stock_quantity: 120,
          item_status: "ACTIVE",
          updated_by: "Ali (Putaway)",
          updated_at: now - 3600000
        },
        "4902505163104": {
          barcode: "4902505163104",
          item_name: "Pilot G2 Gel Pen 0.5mm Black (Box 12)",
          brand: "PILOT",
          photo_url: "",
          rack_codes: ["LS-01-02"],
          stock_quantity: 45,
          item_status: "ACTIVE",
          updated_by: "Ali (Putaway)",
          updated_at: now - 3000000
        },
        "9556089001234": {
          barcode: "9556089001234",
          item_name: "Faber-Castell 2B Exam Grade Pencil (12s)",
          brand: "FABER-CASTELL",
          photo_url: "",
          rack_codes: ["LS-01-04", "CS-02-01"],
          stock_quantity: 0,
          item_status: "ACTIVE", // Note: stock 0 stays ACTIVE unless picker clicks Move to No Stock!
          updated_by: "Ali (Putaway)",
          updated_at: now - 2500000
        },
        "6971234560001": {
          barcode: "6971234560001",
          item_name: "Cute Capybara 3-Layer Pencil Case (China)",
          brand: "CHINA-STAT",
          photo_url: "",
          rack_codes: ["CS-03-12"],
          stock_quantity: 18,
          item_status: "NO_STOCK",
          pick_now: false,
          updated_by: "Siti (Picker)",
          updated_at: now - 1200000
        },
        "6971234568888": {
          barcode: "6971234568888",
          item_name: "New Arrival Sanrio Kuromi Gel Pen Set 6pcs (China)",
          brand: "CHINA-STAT",
          photo_url: "",
          rack_codes: ["PICKNOW"],
          stock_quantity: 60,
          item_status: "ACTIVE",
          pick_now: true,
          updated_by: "Ali (Putaway)",
          updated_at: now - 600000
        }
      },
      // Demo 200k Sheet Master simulation (items not yet in Firebase!)
      sheet_master: {
        "9555078900011": {
          barcode: "9555078900011",
          item_name: "Campap A4 70gsm Exercise Book 80 Pages",
          brand: "CAMPAP",
          photo_url: ""
        },
        "6971234560099": {
          barcode: "6971234560099",
          item_name: "Kawaii Pastel Highlighter Set 6 Colors",
          brand: "DELI",
          photo_url: ""
        },
        "9789672891002": {
          barcode: "9789672891002",
          item_name: "Sasbadi Top Class SPM Sejarah 2026",
          brand: "SASBADI",
          photo_url: ""
        }
      },
      branches_staff: (window.MBS_BRANCH_STAFF || []).map((u) => ({ ...u, active: true })),
      orders: [
        {
          id: "ORD-DEMO-01",
          branch_name: "MBS WORLD",
          staff_name: "Farah",
          barcode: "4902505163104",
          item_name: "Pilot G2 Gel Pen 0.5mm Black (Box 12)",
          brand: "PILOT",
          photo_url: "",
          qty: 10,
          is_custom: false,
          status: "PENDING",
          is_urgent: false,
          urgent_extra_qty: 0,
          customer_contact: "",
          remark: "",
          created_at: now - 1800000,
          updated_at: now - 1800000
        },
        {
          id: "ORD-DEMO-02",
          branch_name: "MBS KUANTAN",
          staff_name: "Hafiz",
          barcode: "4902505163104",
          item_name: "Pilot G2 Gel Pen 0.5mm Black (Box 12)",
          brand: "PILOT",
          photo_url: "",
          qty: 6,
          is_custom: false,
          status: "PENDING",
          is_urgent: true,
          urgent_extra_qty: 4,
          customer_contact: "Cikgu Amin 012-9876543",
          remark: "Sekolah nak esok pagi!",
          created_at: now - 1500000,
          updated_at: now - 900000
        },
        {
          id: "ORD-DEMO-03",
          branch_name: "MBS WORLD",
          staff_name: "Farah",
          barcode: "6971234560001",
          item_name: "Cute Capybara 3-Layer Pencil Case (China)",
          brand: "CHINA-STAT",
          photo_url: "",
          qty: 12,
          is_custom: false,
          status: "PENDING",
          is_urgent: false,
          urgent_extra_qty: 0,
          customer_contact: "",
          remark: "",
          created_at: now - 1300000,
          updated_at: now - 1200000
        }
      ],
      pick_logs: [
        {
          id: "LOG-DEMO-01",
          picker_name: "Siti (Picker)",
          barcode: "9789834912345",
          item_name: "Buku Teks Matematik Tingkatan 1 KSSM",
          branch_name: "MBS KEMAMAN",
          qty: 30,
          action: "PICKED",
          rack_code: "TB-01-01",
          created_at: now - 5400000
        }
      ],
      po_history: {
        "MBS WORLD__4902505163104": [10, 20, 5]
      }
    };
    localStorage.setItem(LS_KEY, JSON.stringify(initial));
    return initial;
  }

  function loadDemo() {
    return seedDemoData();
  }

  function saveDemo(data) {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  }

  // Initialize Firebase dynamically if config is filled in
  let initPromise = null;
  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const fbCfg = cfg().FIREBASE_CONFIG || {};
      if (fbCfg.apiKey && fbCfg.projectId) {
        try {
          const appMod = await import("https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js");
          const fsMod = await import("https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js");
          const app = appMod.initializeApp(fbCfg);
          db = fsMod.getFirestore(app);
          fs = fsMod;
          isLiveFirebase = true;
        } catch (err) {
          console.error("Firebase init failed, falling back to DEMO mode:", err);
          isLiveFirebase = false;
        }
      }
      renderModeBanner();
      return { isLiveFirebase, hasGas: Boolean(cfg().GAS_WEBAPP_URL) };
    })();
    return initPromise;
  }

  function renderModeBanner() {
    const el = document.getElementById("mode-banner");
    if (!el) return;
    if (isLiveFirebase) {
      el.textContent = t("liveBanner");
      el.style.background = "#dcfce7";
      el.style.color = "#166534";
      el.style.borderBottomColor = "#86efac";
    } else {
      el.textContent = t("demoBanner");
    }
  }
  document.addEventListener("mbs:langchange", renderModeBanner);

  // ---------------- Google Apps Script Helpers ----------------
  async function callGas(payload) {
    const url = (cfg().GAS_WEBAPP_URL || "").trim();
    if (!url) return null;
    // Use text/plain to avoid CORS preflight with Google Apps Script Web App
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("GAS HTTP " + res.status);
    return res.json();
  }

  // ---------------- 1:1 Square Interactive Cropper + Strict <=45KB Compressor ----------------
  const TARGET_SQUARE_PX = 400; // 400x400 crisp square thumbnail
  const MAX_PHOTO_KB = 45;      // Hard cap: ~18-45 KB (100,000 items = ~2.5 GB!)

  function dataUrlBytes(dataUrl) {
    const b64 = (dataUrl.split(",")[1] || "");
    return Math.round((b64.length * 3) / 4);
  }

  // Strictly compress any square source canvas to <= MAX_PHOTO_KB
  function encodeSquareUnderLimit(srcCanvas) {
    let size = TARGET_SQUARE_PX;
    let outCanvas = document.createElement("canvas");
    let ctx = outCanvas.getContext("2d");

    for (const attemptSize of [TARGET_SQUARE_PX, 340, 280]) {
      size = attemptSize;
      outCanvas.width = size;
      outCanvas.height = size;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(srcCanvas, 0, 0, size, size);

      for (const q of [0.72, 0.62, 0.52, 0.44, 0.36, 0.28]) {
        const dataUrl = outCanvas.toDataURL("image/jpeg", q);
        const kb = Math.ceil(dataUrlBytes(dataUrl) / 1024);
        if (kb <= MAX_PHOTO_KB) {
          return { dataUrl, kb, size, quality: q };
        }
      }
    }
    const fallbackUrl = outCanvas.toDataURL("image/jpeg", 0.25);
    return { dataUrl: fallbackUrl, kb: Math.ceil(dataUrlBytes(fallbackUrl) / 1024), size, quality: 0.25 };
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => resolve(img);
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function ensureCropDialog() {
    let dlg = document.getElementById("mbs-crop-dialog");
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "mbs-crop-dialog";
    dlg.setAttribute("aria-labelledby", "mbs-crop-title");

    const hdr = document.createElement("div");
    hdr.className = "dialog-header";
    const h2 = document.createElement("h2");
    h2.id = "mbs-crop-title";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "btn btn-sm btn-outline";
    closeBtn.id = "mbs-crop-cancel-top";
    hdr.append(h2, closeBtn);

    const body = document.createElement("div");
    body.className = "dialog-body crop-stage-wrap";

    const hint = document.createElement("p");
    hint.id = "mbs-crop-hint";
    hint.style.cssText = "margin:0;font-size:0.82rem;color:var(--muted);text-align:center;";

    const canvas = document.createElement("canvas");
    canvas.id = "mbs-crop-canvas";
    canvas.width = TARGET_SQUARE_PX;
    canvas.height = TARGET_SQUARE_PX;

    const sizeBadge = document.createElement("span");
    sizeBadge.id = "mbs-crop-size-badge";
    sizeBadge.className = "badge badge-green";

    const ctrl = document.createElement("div");
    ctrl.className = "crop-controls";
    const zLbl = document.createElement("span");
    zLbl.id = "mbs-crop-zoom-lbl";
    zLbl.style.cssText = "font-size:0.84rem;font-weight:700;";
    const zoom = document.createElement("input");
    zoom.type = "range";
    zoom.id = "mbs-crop-zoom";
    zoom.min = "1";
    zoom.max = "3";
    zoom.step = "0.05";
    zoom.value = "1";
    const rotBtn = document.createElement("button");
    rotBtn.type = "button";
    rotBtn.id = "mbs-crop-rot-btn";
    rotBtn.className = "btn btn-sm btn-outline";
    ctrl.append(zLbl, zoom, rotBtn);

    body.append(hint, canvas, sizeBadge, ctrl);

    const footer = document.createElement("div");
    footer.className = "dialog-footer";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.id = "mbs-crop-cancel-btn";
    cancelBtn.className = "btn btn-outline";
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.id = "mbs-crop-ok-btn";
    okBtn.className = "btn btn-success";
    footer.append(cancelBtn, okBtn);

    dlg.append(hdr, body, footer);
    document.body.appendChild(dlg);
    return dlg;
  }

  /**
   * Opens interactive 1:1 square crop modal (pre-cropped centered so 1 tap confirms,
   * or drag/zoom/rotate to frame tightly), returning compressed <=45KB JPEG result.
   */
  async function openSquareCropper(file) {
    const img = await loadImageFromFile(file);
    return new Promise((resolve) => {
      const dlg = ensureCropDialog();
      document.getElementById("mbs-crop-title").textContent = t("cropTitle");
      document.getElementById("mbs-crop-hint").textContent = t("cropHint");
      document.getElementById("mbs-crop-zoom-lbl").textContent = t("cropZoom");
      document.getElementById("mbs-crop-rot-btn").textContent = "↻ 90°";
      document.getElementById("mbs-crop-cancel-top").textContent = t("close");
      document.getElementById("mbs-crop-cancel-btn").textContent = t("cancel");
      document.getElementById("mbs-crop-ok-btn").textContent = "✓ " + t("cropConfirm");

      const canvas = document.getElementById("mbs-crop-canvas");
      const ctx = canvas.getContext("2d");
      const zoomEl = document.getElementById("mbs-crop-zoom");
      const badgeEl = document.getElementById("mbs-crop-size-badge");

      let scale = 1;
      let rotDeg = 0;
      let offsetX = 0;
      let offsetY = 0;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      let latestEncoded = null;

      zoomEl.value = "1";

      function drawFrame(updateKb = true) {
        const W = canvas.width;
        const H = canvas.height;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, W, H);

        const swapped = (rotDeg % 180) !== 0;
        const iw = swapped ? img.height : img.width;
        const ih = swapped ? img.width : img.height;
        // Cover-fit so the 1:1 square has zero blank bars
        const baseScale = Math.max(W / iw, H / ih);
        const drawScale = baseScale * scale;

        const maxPanX = Math.max(0, (iw * drawScale - W) / 2);
        const maxPanY = Math.max(0, (ih * drawScale - H) / 2);
        offsetX = Math.max(-maxPanX, Math.min(maxPanX, offsetX));
        offsetY = Math.max(-maxPanY, Math.min(maxPanY, offsetY));

        ctx.save();
        ctx.translate(W / 2 + offsetX, H / 2 + offsetY);
        ctx.rotate((rotDeg * Math.PI) / 180);
        ctx.scale(drawScale, drawScale);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();

        // Draw subtle rule-of-thirds guide on preview? Keep canvas clean so encoding uses it directly!
        if (updateKb) {
          latestEncoded = encodeSquareUnderLimit(canvas);
          badgeEl.textContent = `1:1 Square • ${latestEncoded.size}×${latestEncoded.size} px • ${latestEncoded.kb} KB`;
        }
      }

      const onDown = (e) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
      };
      const onMove = (e) => {
        if (!dragging) return;
        const rect = canvas.getBoundingClientRect();
        const ratio = canvas.width / rect.width;
        offsetX += (e.clientX - lastX) * ratio;
        offsetY += (e.clientY - lastY) * ratio;
        lastX = e.clientX;
        lastY = e.clientY;
        drawFrame(false);
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        drawFrame(true);
      };

      const onZoom = () => { scale = Number(zoomEl.value) || 1; drawFrame(true); };
      const onRot = () => { rotDeg = (rotDeg + 90) % 360; offsetX = 0; offsetY = 0; drawFrame(true); };

      function finish(val) {
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointercancel", onUp);
        zoomEl.removeEventListener("input", onZoom);
        document.getElementById("mbs-crop-rot-btn").onclick = null;
        document.getElementById("mbs-crop-cancel-top").onclick = null;
        document.getElementById("mbs-crop-cancel-btn").onclick = null;
        document.getElementById("mbs-crop-ok-btn").onclick = null;
        dlg.removeEventListener("cancel", onCancel);
        if (dlg.open) { dlg.close(); dlg.returnValue = ""; }
        resolve(val);
      }

      const onCancel = (e) => { e.preventDefault(); finish(null); };

      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", onUp);
      zoomEl.addEventListener("input", onZoom);
      document.getElementById("mbs-crop-rot-btn").onclick = onRot;
      document.getElementById("mbs-crop-cancel-top").onclick = () => finish(null);
      document.getElementById("mbs-crop-cancel-btn").onclick = () => finish(null);
      document.getElementById("mbs-crop-ok-btn").onclick = () => {
        const res = encodeSquareUnderLimit(canvas);
        finish(res);
      };
      dlg.addEventListener("cancel", onCancel);

      dlg.showModal();
      drawFrame(true);
    });
  }

  // ---------------- Public API ----------------
  window.MBS_API = {
    init,
    isLive: () => isLiveFirebase,
    normalizeRack,
    isPickNow: isPickNowItem,
    getQuotaStats: () => ({ ...quotaStats }),
    clearItemsCache: () => {
      localStorage.removeItem(CACHE_ITEMS_KEY);
      localStorage.removeItem(CACHE_ITEMS_TS_KEY);
      localStorage.removeItem(CACHE_ACC_KEY);
    },

    // 1. Lookup single item: Firebase first (fast!), then Google Sheet 1-row TextFinder
    async lookupItem(barcode) {
      await init();
      const code = String(barcode || "").trim();
      if (!code) return { found: false, source: "none", item: null };

      let fbItem = null;
      if (isLiveFirebase) {
        const snap = await fs.getDoc(fs.doc(db, "items", code));
        trackRead(1);
        if (snap.exists()) {
          fbItem = snap.data();
          upsertLocalItemCache(fbItem);
        }
      } else {
        const d = loadDemo();
        if (d.items[code]) fbItem = { ...d.items[code] };
      }

      // Check Google Sheet 1-row lookup if not in Firebase OR missing brand/photo
      let sheetItem = null;
      if (!fbItem || !fbItem.photo_url || !fbItem.brand) {
        if (cfg().GAS_WEBAPP_URL) {
          try {
            const res = await callGas({ action: "lookupItem", barcode: code });
            if (res && res.found && res.item) sheetItem = res.item;
          } catch (e) {
            console.warn("Sheet lookup failed:", e);
          }
        } else {
          const d = loadDemo();
          if (d.sheet_master[code]) sheetItem = { ...d.sheet_master[code] };
        }
      }

      if (fbItem) {
        // Merge sheet photo/brand if Firebase lacked them
        return {
          found: true,
          inFirebase: true,
          source: "firebase",
          item: {
            barcode: code,
            item_name: fbItem.item_name || (sheetItem && sheetItem.item_name) || "",
            brand: fbItem.brand || (sheetItem && sheetItem.brand) || "",
            photo_url: fbItem.photo_url || (sheetItem && sheetItem.photo_url) || "",
            rack_codes: Array.isArray(fbItem.rack_codes) ? fbItem.rack_codes : [],
            stock_quantity: fbItem.stock_quantity ?? "",
            item_status: fbItem.item_status || "ACTIVE",
            pick_now: isPickNowItem(fbItem)
          }
        };
      }

      if (sheetItem) {
        return {
          found: true,
          inFirebase: false,
          source: "sheet",
          item: {
            barcode: code,
            item_name: sheetItem.item_name || "",
            brand: sheetItem.brand || "",
            photo_url: sheetItem.photo_url || "",
            rack_codes: [],
            stock_quantity: "",
            item_status: "ACTIVE",
            pick_now: false
          }
        };
      }

      return { found: false, inFirebase: false, source: "none", item: null };
    },

    // 2. Save SINGLE item on demand to Firebase (+ optional Sheet master sync)
    async saveItem(itemData, staffName = "") {
      await init();
      const code = String(itemData.barcode || "").trim();
      if (!code) throw new Error("Barcode required");

      let cleanRacks = [...new Set((itemData.rack_codes || []).map((r) => normalizeRack(r)).filter(Boolean))];
      const hasPickNowFlag = itemData.pick_now === true || cleanRacks.includes("PICKNOW");
      if (itemData.pick_now === false) {
        cleanRacks = cleanRacks.filter((r) => r !== "PICKNOW");
      } else if (hasPickNowFlag && !cleanRacks.includes("PICKNOW")) {
        cleanRacks.push("PICKNOW");
      }
      const stockVal = itemData.stock_quantity === "" || itemData.stock_quantity === null || itemData.stock_quantity === undefined
        ? null
        : Number(itemData.stock_quantity);

      const record = {
        barcode: code,
        item_name: String(itemData.item_name || "").trim(),
        brand: String(itemData.brand || "").trim(),
        photo_url: String(itemData.photo_url || "").trim(),
        rack_codes: cleanRacks,
        stock_quantity: Number.isNaN(stockVal) ? null : stockVal,
        item_status: itemData.item_status || "ACTIVE",
        pick_now: cleanRacks.includes("PICKNOW"),
        updated_by: staffName || "Staff",
        updated_at: Date.now()
      };

      if (isLiveFirebase) {
        await fs.setDoc(fs.doc(db, "items", code), record, { merge: true });
        trackWrite(1);
        upsertLocalItemCache(record);
      } else {
        const d = loadDemo();
        d.items[code] = record;
        d.sheet_master[code] = {
          barcode: code,
          item_name: record.item_name,
          brand: record.brand,
          photo_url: record.photo_url
        };
        saveDemo(d);
      }

      // Sync new item / updated photo back to Google Sheet Item_Master asynchronously
      if (cfg().GAS_WEBAPP_URL) {
        callGas({
          action: "upsertItem",
          barcode: record.barcode,
          item_name: record.item_name,
          brand: record.brand,
          photo_url: record.photo_url
        }).catch((e) => console.warn("Sheet upsert skipped:", e));
      }
      return record;
    },

    // 3. Interactive 1:1 Square Crop + <=45KB Compress -> Google Drive -> auto Share URL -> write to Sheet
    async uploadPhoto(barcode, file) {
      await init();
      const cropped = await openSquareCropper(file);
      if (!cropped) return null; // user cancelled crop

      const { dataUrl, kb, size } = cropped;
      if (cfg().GAS_WEBAPP_URL) {
        const base64 = dataUrl.split(",")[1];
        const res = await callGas({
          action: "uploadPhoto",
          barcode: String(barcode).trim(),
          mimeType: "image/jpeg",
          base64
        });
        if (!res || !res.photo_url) throw new Error((res && res.error) || "Drive upload failed");
        return { url: res.photo_url, kb, size };
      }
      // Demo mode: return compressed 1:1 square data URL directly
      return { url: dataUrl, kb, size };
    },

    // 4. Delta-Cached listItems (ONLY reads items changed since lastSyncTs -> saves ~99% Firestore reads!)
    async listItems(forceFull = false) {
      await init();
      if (isLiveFirebase) {
        let map = forceFull ? {} : loadLocalItemsCache();
        let lastTs = forceFull ? 0 : Number(localStorage.getItem(CACHE_ITEMS_TS_KEY) || 0);
        const hasCache = Object.keys(map).length > 0 && lastTs > 0;

        let q = fs.collection(db, "items");
        if (hasCache) {
          // 5-minute overlap window prevents missing writes due to phone clock drift
          const safeSince = Math.max(0, lastTs - 5 * 60 * 1000);
          q = fs.query(q, fs.where("updated_at", ">", safeSince));
        }
        const snap = await fs.getDocs(q);
        trackRead(snap.size || 1);
        if (hasCache) trackCacheHit(Object.keys(map).length);

        let maxTs = lastTs;
        snap.docs.forEach((doc) => {
          const d = doc.data();
          if (d && d.barcode) {
            map[d.barcode] = d;
            if ((d.updated_at || 0) > maxTs) maxTs = d.updated_at;
          }
        });
        saveLocalItemsCache(map, maxTs || Date.now());
        return Object.values(map);
      }
      const d = loadDemo();
      return Object.values(d.items);
    },

    // 4b. Direct lightweight query for ONLY NO_STOCK items (used by Restock Export — never scans all items!)
    async listNoStockItems() {
      await init();
      if (isLiveFirebase) {
        const q = fs.query(fs.collection(db, "items"), fs.where("item_status", "==", "NO_STOCK"));
        const snap = await fs.getDocs(q);
        trackRead(snap.size || 1);
        return snap.docs.map((doc) => doc.data());
      }
      const d = loadDemo();
      return Object.values(d.items).filter((i) => i.item_status === "NO_STOCK");
    },

    // 5. Query items inside a specific rack (View-Only Tab in putaway.html)
    async listItemsByRack(rackCode) {
      await init();
      const rack = normalizeRack(rackCode);
      if (!rack) return [];
      if (isLiveFirebase) {
        const q = fs.query(fs.collection(db, "items"), fs.where("rack_codes", "array-contains", rack));
        const snap = await fs.getDocs(q);
        trackRead(snap.size || 1);
        return snap.docs.map((doc) => doc.data());
      }
      const d = loadDemo();
      return Object.values(d.items).filter((it) => (it.rack_codes || []).map(normalizeRack).includes(rack));
    },

    // 6. Set item status explicitly (ONLY Move to No Stock or Restock)
    // Safely initializes full doc if item was Custom or 200k-Sheet-only (never leaves broken stub!)
    async setItemStatus(barcode, status, staffName, fallbackMeta = {}) {
      await init();
      const code = String(barcode || "").trim();
      if (!code) return;
      const now = Date.now();
      if (isLiveFirebase) {
        const ref = fs.doc(db, "items", code);
        const snap = await fs.getDoc(ref);
        trackRead(1);
        let payload;
        if (snap.exists()) {
          payload = { item_status: status, updated_by: staffName || "Staff", updated_at: now };
          await fs.setDoc(ref, payload, { merge: true });
          upsertLocalItemCache({ ...snap.data(), ...payload });
        } else {
          payload = {
            barcode: code,
            item_name: fallbackMeta.item_name || code,
            brand: fallbackMeta.brand || "",
            photo_url: fallbackMeta.photo_url || "",
            rack_codes: [],
            stock_quantity: null,
            item_status: status,
            pick_now: false,
            updated_by: staffName || "Staff",
            updated_at: now
          };
          await fs.setDoc(ref, payload, { merge: true });
          upsertLocalItemCache(payload);
        }
        trackWrite(1);
      } else {
        const d = loadDemo();
        if (!d.items[code]) {
          d.items[code] = {
            barcode: code,
            item_name: fallbackMeta.item_name || code,
            brand: fallbackMeta.brand || "",
            photo_url: fallbackMeta.photo_url || "",
            rack_codes: [],
            stock_quantity: null,
            item_status: status,
            pick_now: false,
            updated_by: staffName || "Staff",
            updated_at: now
          };
        } else {
          d.items[code].item_status = status;
          d.items[code].updated_by = staffName || "Staff";
          d.items[code].updated_at = now;
        }
        saveDemo(d);
      }
    },

    // 7. Branches & Staff Auth (cached 12h locally to avoid repeated reads)
    async listAccounts(forceRefresh = false) {
      await init();
      const seed = (window.MBS_BRANCH_STAFF || []).map((u) => ({
        id: `${u.branch}__${u.staff}`,
        branch: u.branch,
        staff: u.staff,
        password: String(u.password),
        role: u.role || "BRANCH",
        active: true
      }));
      if (isLiveFirebase) {
        if (!forceRefresh) {
          try {
            const cached = JSON.parse(localStorage.getItem(CACHE_ACC_KEY) || "null");
            if (cached && Date.now() - cached.ts < 12 * 3600 * 1000 && Array.isArray(cached.list)) {
              trackCacheHit(cached.list.length);
              return cached.list;
            }
          } catch (_) {}
        }
        const snap = await fs.getDocs(fs.collection(db, "branches_staff"));
        trackRead(snap.size || 1);
        const list = snap.empty ? seed : snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        localStorage.setItem(CACHE_ACC_KEY, JSON.stringify({ ts: Date.now(), list }));
        return list;
      }
      const d = loadDemo();
      return d.branches_staff.map((u) => ({ id: `${u.branch}__${u.staff}`, ...u }));
    },

    async saveAccount(acc) {
      await init();
      const id = `${acc.branch.trim()}__${acc.staff.trim()}`;
      const record = {
        branch: acc.branch.trim(),
        staff: acc.staff.trim(),
        password: String(acc.password || ""),
        role: acc.role || "BRANCH",
        active: acc.active !== false
      };
      if (isLiveFirebase) {
        // If branches_staff is brand new/empty in Firestore, seed default branch.js accounts first
        // so adding 1 new branch doesn't hide existing seed accounts!
        const existingSnap = await fs.getDocs(fs.query(fs.collection(db, "branches_staff"), fs.limit(1)));
        trackRead(1);
        if (existingSnap.empty) {
          for (const s of (window.MBS_BRANCH_STAFF || [])) {
            const sId = `${s.branch.trim()}__${s.staff.trim()}`;
            await fs.setDoc(fs.doc(db, "branches_staff", sId), {
              branch: s.branch.trim(),
              staff: s.staff.trim(),
              password: String(s.password || ""),
              role: s.role || "BRANCH",
              active: true
            }, { merge: true });
            trackWrite(1);
          }
        }
        await fs.setDoc(fs.doc(db, "branches_staff", id), record, { merge: true });
        trackWrite(1);
        localStorage.removeItem(CACHE_ACC_KEY);
      } else {
        const d = loadDemo();
        const idx = d.branches_staff.findIndex((u) => `${u.branch}__${u.staff}` === id);
        if (idx >= 0) d.branches_staff[idx] = record;
        else d.branches_staff.push(record);
        saveDemo(d);
      }
      return record;
    },

    async deleteAccount(branch, staff) {
      await init();
      const id = `${branch}__${staff}`;
      if (isLiveFirebase) {
        await fs.deleteDoc(fs.doc(db, "branches_staff", id));
        trackWrite(1);
        localStorage.removeItem(CACHE_ACC_KEY);
      } else {
        const d = loadDemo();
        d.branches_staff = d.branches_staff.filter((u) => `${u.branch}__${u.staff}` !== id);
        saveDemo(d);
      }
    },

    // 8. Orders — uses single-field `branch_status` key (ZERO composite indexes!) & caps completed history
    async listOrders(filter = {}) {
      await init();
      let list = [];
      if (isLiveFirebase) {
        if (filter.branch_name && filter.status) {
          const key = `${filter.branch_name}__${filter.status}`;
          let q = fs.query(fs.collection(db, "orders"), fs.where("branch_status", "==", key));
          if (filter.limit) q = fs.query(q, fs.limit(filter.limit));
          const snap = await fs.getDocs(q);
          trackRead(snap.size || 1);
          list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        } else if (filter.branch_name) {
          // Load ALL PENDING + capped latest 30 PICKED (prevents reading thousands of old completed orders!)
          const [pSnap, dSnap] = await Promise.all([
            fs.getDocs(fs.query(fs.collection(db, "orders"), fs.where("branch_status", "==", `${filter.branch_name}__PENDING`))),
            fs.getDocs(fs.query(fs.collection(db, "orders"), fs.where("branch_status", "==", `${filter.branch_name}__PICKED`), fs.limit(30)))
          ]);
          trackRead((pSnap.size || 1) + (dSnap.size || 1));
          list = [...pSnap.docs, ...dSnap.docs].map((doc) => ({ id: doc.id, ...doc.data() }));
        } else if (filter.status) {
          let q = fs.query(fs.collection(db, "orders"), fs.where("status", "==", filter.status));
          if (filter.limit) q = fs.query(q, fs.limit(filter.limit));
          const snap = await fs.getDocs(q);
          trackRead(snap.size || 1);
          list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        } else {
          const snap = await fs.getDocs(fs.query(fs.collection(db, "orders"), fs.limit(filter.limit || 200)));
          trackRead(snap.size || 1);
          list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        }
      } else {
        const d = loadDemo();
        list = d.orders.filter((o) => {
          if (filter.status && o.status !== filter.status) return false;
          if (filter.branch_name && o.branch_name !== filter.branch_name) return false;
          return true;
        });
      }
      return list.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
    },

    async submitOrderLines(branchName, staffName, cartItems) {
      await init();
      const now = Date.now();
      const created = [];

      // Check existing PENDING orders for same branch + barcode so we merge cleanly
      const existingPending = await this.listOrders({ status: "PENDING", branch_name: branchName });

      for (const line of cartItems) {
        const code = String(line.barcode || "").trim();
        const qty = Number(line.qty) || 1;
        // Rule 3B: Always merge into existing PENDING order for same (branch, barcode),
        // even if that existing order is Urgent (1 branch x 1 barcode = max 1 PENDING row!)
        const match = existingPending.find((o) => o.barcode === code);

        if (match) {
          const newQty = Number(match.qty || 0) + qty;
          const mergedRemark = [match.remark, line.remark].filter(Boolean).join(" | ");
          if (isLiveFirebase) {
            await fs.setDoc(fs.doc(db, "orders", match.id), {
              qty: newQty,
              remark: mergedRemark,
              branch_status: `${branchName}__PENDING`,
              updated_at: now
            }, { merge: true });
            trackWrite(1);
          } else {
            const d = loadDemo();
            const target = d.orders.find((o) => o.id === match.id);
            if (target) { target.qty = newQty; target.remark = mergedRemark; target.updated_at = now; }
            saveDemo(d);
          }
          match.qty = newQty;
          match.remark = mergedRemark;
          created.push({ ...match, qty: newQty });
        } else {
          const id = `ORD-${now}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
          const rec = {
            id,
            branch_name: branchName,
            branch_status: `${branchName}__PENDING`,
            staff_name: staffName,
            barcode: code,
            item_name: line.item_name || code,
            brand: line.brand || "",
            photo_url: line.photo_url || "",
            qty,
            is_custom: Boolean(line.is_custom),
            status: "PENDING",
            is_urgent: false,
            urgent_extra_qty: 0,
            customer_contact: "",
            remark: line.remark || "",
            created_at: now,
            updated_at: now
          };
          if (isLiveFirebase) {
            await fs.setDoc(fs.doc(db, "orders", id), rec);
            trackWrite(1);
          } else {
            const d = loadDemo();
            d.orders.push(rec);
            saveDemo(d);
          }
          created.push(rec);
        }

        // Write rolling 100-entry PO History to Google Sheet
        if (cfg().GAS_WEBAPP_URL) {
          callGas({
            action: "appendPOHistory",
            branch_name: branchName,
            barcode: code,
            item_name: line.item_name || code,
            qty
          }).catch((e) => console.warn("PO History sync warning:", e));
        } else {
          const d = loadDemo();
          const key = `${branchName}__${code}`;
          const arr = d.po_history[key] || [];
          arr.push(qty);
          while (arr.length > (cfg().MAX_PO_HISTORY_PER_ITEM || 100)) arr.shift();
          d.po_history[key] = arr;
          saveDemo(d);
        }
      }
      return created;
    },

    // Escalate existing Pending Order with extra customer qty -> URGENT ORDER
    // Also appends extraQty to Google Sheet PO_History so Sheet stays 100% in sync!
    async escalateOrderUrgent(orderId, extraQty, customerContact, remark) {
      await init();
      const now = Date.now();
      const add = Number(extraQty) || 0;
      let orderMeta = null;

      if (isLiveFirebase) {
        const ref = fs.doc(db, "orders", orderId);
        const snap = await fs.getDoc(ref);
        trackRead(1);
        if (!snap.exists()) throw new Error("Order not found");
        const cur = snap.data();
        orderMeta = cur;
        const mergedRemark = [cur.remark, remark].filter(Boolean).join(" | ");
        await fs.setDoc(ref, {
          qty: Number(cur.qty || 0) + add,
          is_urgent: true,
          urgent_extra_qty: Number(cur.urgent_extra_qty || 0) + add,
          customer_contact: customerContact || cur.customer_contact || "",
          remark: mergedRemark,
          updated_at: now
        }, { merge: true });
        trackWrite(1);
      } else {
        const d = loadDemo();
        const cur = d.orders.find((o) => o.id === orderId);
        if (!cur) throw new Error("Order not found");
        orderMeta = cur;
        cur.qty = Number(cur.qty || 0) + add;
        cur.is_urgent = true;
        cur.urgent_extra_qty = Number(cur.urgent_extra_qty || 0) + add;
        cur.customer_contact = customerContact || cur.customer_contact || "";
        cur.remark = [cur.remark, remark].filter(Boolean).join(" | ");
        cur.updated_at = now;
        saveDemo(d);
      }

      // Record urgent extra qty into Google Sheet PO_History (100 rolling)
      if (orderMeta && add > 0) {
        if (cfg().GAS_WEBAPP_URL) {
          callGas({
            action: "appendPOHistory",
            branch_name: orderMeta.branch_name,
            barcode: orderMeta.barcode,
            item_name: orderMeta.item_name || orderMeta.barcode,
            qty: add
          }).catch((e) => console.warn("Urgent PO History sync warning:", e));
        } else {
          const d = loadDemo();
          const key = `${orderMeta.branch_name}__${orderMeta.barcode}`;
          const arr = d.po_history[key] || [];
          arr.push(add);
          while (arr.length > (cfg().MAX_PO_HISTORY_PER_ITEM || 100)) arr.shift();
          d.po_history[key] = arr;
          saveDemo(d);
        }
      }
    },

    // Picker marks order line PICKED:
    // - Double-pick guard (checks if already PICKED by another picker!)
    // - Rule 1B: Auto-deducts stock_quantity if set (clamped >= 0, NEVER auto-marks NO_STOCK!)
    // - Appends to half-day log bucket
    async markOrderPicked(order, pickerName, rackCode) {
      await init();
      const now = Date.now();
      const qtyPicked = Number(order.qty || 0);
      let newStockQty = null;

      if (isLiveFirebase) {
        const ordRef = fs.doc(db, "orders", order.id);
        const ordSnap = await fs.getDoc(ordRef);
        trackRead(1);
        if (ordSnap.exists() && ordSnap.data().status === "PICKED") {
          return { alreadyPicked: true, pickedBy: ordSnap.data().picked_by || "Staff" };
        }

        await fs.setDoc(ordRef, {
          status: "PICKED",
          branch_status: `${order.branch_name}__PICKED`,
          picked_by: pickerName,
          picked_at: now,
          updated_at: now
        }, { merge: true });
        trackWrite(1);

        // Auto-deduct stock_quantity if item exists and has numeric stock_quantity (floor 0, status stays unchanged!)
        const itemRef = fs.doc(db, "items", order.barcode);
        const itemSnap = await fs.getDoc(itemRef);
        trackRead(1);
        if (itemSnap.exists()) {
          const it = itemSnap.data();
          if (it.stock_quantity !== null && it.stock_quantity !== "" && it.stock_quantity !== undefined && !Number.isNaN(Number(it.stock_quantity))) {
            newStockQty = Math.max(0, Number(it.stock_quantity) - qtyPicked);
            await fs.setDoc(itemRef, {
              stock_quantity: newStockQty,
              updated_by: pickerName,
              updated_at: now
            }, { merge: true });
            trackWrite(1);
            upsertLocalItemCache({ ...it, stock_quantity: newStockQty, updated_by: pickerName, updated_at: now });
          }
        }
      } else {
        const d = loadDemo();
        const cur = d.orders.find((o) => o.id === order.id);
        if (cur && cur.status === "PICKED") {
          return { alreadyPicked: true, pickedBy: cur.picked_by || "Staff" };
        }
        if (cur) {
          cur.status = "PICKED";
          cur.picked_by = pickerName;
          cur.picked_at = now;
          cur.updated_at = now;
        }
        const it = d.items[order.barcode];
        if (it && it.stock_quantity !== null && it.stock_quantity !== "" && it.stock_quantity !== undefined && !Number.isNaN(Number(it.stock_quantity))) {
          newStockQty = Math.max(0, Number(it.stock_quantity) - qtyPicked);
          it.stock_quantity = newStockQty;
          it.updated_by = pickerName;
          it.updated_at = now;
        }
        saveDemo(d);
      }

      await this.addPickLog({
        picker_name: pickerName,
        barcode: order.barcode,
        item_name: order.item_name,
        branch_name: order.branch_name,
        qty: qtyPicked,
        action: "PICKED",
        rack_code: rackCode || "-"
      });
      return { alreadyPicked: false, newStockQty };
    },

    // Picker clicks "Move to No Stock" -> sets item_status = NO_STOCK (safe even for Custom/Sheet items!)
    async moveItemToNoStock(barcode, itemName, pickerName, rackCode, brand = "", photoUrl = "") {
      await this.setItemStatus(barcode, "NO_STOCK", pickerName, {
        item_name: itemName || barcode,
        brand: brand === "-" ? "" : brand,
        photo_url: photoUrl || ""
      });
      await this.addPickLog({
        picker_name: pickerName,
        barcode,
        item_name: itemName || barcode,
        branch_name: "ALL PENDING",
        qty: 0,
        action: "MOVE_NO_STOCK",
        rack_code: rackCode || "-"
      });
    },

    // Bucketed pick logs: 1 half-day doc holds ~100-250 logs via arrayUnion ->
    // Fetching latest 1,000 logs costs ONLY ~10 Firestore reads instead of 1,000 reads!
    async addPickLog(entry) {
      await init();
      const maxLogs = (cfg().MAX_PICK_LOGS || 1000);
      const now = Date.now();
      const rec = {
        id: `LOG-${now}-${Math.random().toString(36).slice(2, 5)}`,
        picker_name: entry.picker_name || "Picker",
        barcode: entry.barcode || "",
        item_name: entry.item_name || "",
        branch_name: entry.branch_name || "",
        qty: Number(entry.qty || 0),
        action: entry.action || "PICKED",
        rack_code: entry.rack_code || "-",
        created_at: now
      };
      if (isLiveFirebase) {
        const dt = new Date(now);
        const day = dt.toISOString().slice(0, 10);
        const half = dt.getHours() < 12 ? "AM" : "PM";
        const bucketId = `${day}_${half}`;
        await fs.setDoc(fs.doc(db, "pick_log_buckets", bucketId), {
          bucket_id: bucketId,
          updated_at: now,
          logs: fs.arrayUnion(rec)
        }, { merge: true });
        trackWrite(1);
      } else {
        const d = loadDemo();
        d.pick_logs.unshift(rec);
        if (d.pick_logs.length > maxLogs) d.pick_logs = d.pick_logs.slice(0, maxLogs);
        saveDemo(d);
      }
      return rec;
    },

    async listPickLogs(limitCount = 1000) {
      await init();
      if (isLiveFirebase) {
        // Read only latest 14 half-day buckets (~7 days, ~14 reads total for 1,000 logs!)
        const q = fs.query(
          fs.collection(db, "pick_log_buckets"),
          fs.orderBy("bucket_id", "desc"),
          fs.limit(14)
        );
        const snap = await fs.getDocs(q);
        trackRead(snap.size || 1);
        const merged = [];
        snap.docs.forEach((doc) => {
          const arr = doc.data().logs || [];
          arr.forEach((entry) => merged.push(entry));
        });
        merged.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        return merged.slice(0, limitCount);
      }
      const d = loadDemo();
      return (d.pick_logs || []).slice(0, limitCount);
    },

    resetDemoData() {
      localStorage.removeItem(LS_KEY);
      seedDemoData();
    },

    // 9. Update Brand from ANY page (Put-Away, Admin, Picker, Branch)
    // Safe for Custom / Sheet-only items (only updates `items` if it exists or includes full item_name!)
    async updateItemBrand(barcode, newBrand, staffName = "", fallbackItemName = "") {
      await init();
      const code = String(barcode || "").trim();
      const brand = String(newBrand || "").trim().toUpperCase();
      if (!code) throw new Error("Barcode required");
      const now = Date.now();

      if (isLiveFirebase) {
        const itemRef = fs.doc(db, "items", code);
        const itemSnap = await fs.getDoc(itemRef);
        trackRead(1);
        if (itemSnap.exists()) {
          await fs.setDoc(itemRef, {
            brand,
            updated_by: staffName || "Staff",
            updated_at: now
          }, { merge: true });
          trackWrite(1);
          upsertLocalItemCache({ ...itemSnap.data(), brand, updated_by: staffName || "Staff", updated_at: now });
        } else if (fallbackItemName) {
          const full = {
            barcode: code,
            item_name: fallbackItemName,
            brand,
            photo_url: "",
            rack_codes: [],
            stock_quantity: null,
            item_status: "ACTIVE",
            pick_now: false,
            updated_by: staffName || "Staff",
            updated_at: now
          };
          await fs.setDoc(itemRef, full, { merge: true });
          trackWrite(1);
          upsertLocalItemCache(full);
        }

        // Keep matching PENDING orders in sync (single-field query on barcode -> filter PENDING in JS = zero composite index!)
        const q = fs.query(fs.collection(db, "orders"), fs.where("barcode", "==", code));
        const snap = await fs.getDocs(q);
        trackRead(snap.size || 1);
        for (const docSnap of snap.docs) {
          if (docSnap.data().status === "PENDING") {
            await fs.setDoc(docSnap.ref, { brand, updated_at: now }, { merge: true });
            trackWrite(1);
          }
        }
      } else {
        const d = loadDemo();
        if (d.items[code]) {
          d.items[code].brand = brand;
          d.items[code].updated_by = staffName || "Staff";
          d.items[code].updated_at = now;
        }
        if (d.sheet_master[code]) {
          d.sheet_master[code].brand = brand;
        }
        (d.orders || []).forEach((o) => {
          if (o.barcode === code && o.status === "PENDING") {
            o.brand = brand;
            o.updated_at = now;
          }
        });
        saveDemo(d);
      }

      if (cfg().GAS_WEBAPP_URL) {
        callGas({ action: "upsertItem", barcode: code, brand }).catch((e) => console.warn("Sheet brand sync:", e));
      }
      return brand;
    },

    // Shared Brand Editor Dialog (usable on putaway, order, pick, restock)
    async openBrandEditor({ barcode, currentBrand = "", itemName = "", staffName = "", knownBrands = [] }) {
      let dlg = document.getElementById("mbs-brand-dialog");
      if (!dlg) {
        dlg = document.createElement("dialog");
        dlg.id = "mbs-brand-dialog";
        dlg.setAttribute("closedby", "any");
        dlg.setAttribute("aria-labelledby", "mbs-brand-dlg-title");

        const hdr = document.createElement("div");
        hdr.className = "dialog-header";
        const h2 = document.createElement("h2");
        h2.id = "mbs-brand-dlg-title";
        const cBtn = document.createElement("button");
        cBtn.type = "button";
        cBtn.id = "mbs-brand-close-btn";
        cBtn.className = "btn btn-sm btn-outline";
        hdr.append(h2, cBtn);

        const form = document.createElement("form");
        form.id = "mbs-brand-form";
        form.className = "dialog-body";

        const info = document.createElement("div");
        info.id = "mbs-brand-item-info";
        info.className = "alert alert-info";

        const fld = document.createElement("div");
        fld.className = "field";
        const lbl = document.createElement("label");
        lbl.setAttribute("for", "mbs-brand-input");
        lbl.id = "mbs-brand-input-lbl";
        const inp = document.createElement("input");
        inp.type = "text";
        inp.id = "mbs-brand-input";
        inp.autocomplete = "off";
        inp.placeholder = "e.g. PILOT / FABER-CASTELL / DBP / CHINA-STAT";
        fld.append(lbl, inp);

        const chipsWrap = document.createElement("div");
        chipsWrap.id = "mbs-brand-chips";
        chipsWrap.className = "flex-row";
        chipsWrap.style.marginBottom = "14px";

        const saveBtn = document.createElement("button");
        saveBtn.type = "submit";
        saveBtn.id = "mbs-brand-save-btn";
        saveBtn.className = "btn btn-lg btn-success btn-block";

        form.append(info, fld, chipsWrap, saveBtn);
        dlg.append(hdr, form);
        document.body.appendChild(dlg);
        if (window.initDialogPolyfill) window.initDialogPolyfill();
      }

      document.getElementById("mbs-brand-dlg-title").textContent = "🏷 " + t("editBrandTitle");
      document.getElementById("mbs-brand-close-btn").textContent = t("close");
      document.getElementById("mbs-brand-input-lbl").textContent = t("brand");
      document.getElementById("mbs-brand-save-btn").textContent = "✓ " + t("save");
      document.getElementById("mbs-brand-item-info").textContent = `${itemName || barcode} (${barcode})`;

      const inp = document.getElementById("mbs-brand-input");
      inp.value = currentBrand || "";

      const chips = document.getElementById("mbs-brand-chips");
      chips.replaceChildren();
      const presets = [...new Set(["PILOT", "FABER-CASTELL", "DBP", "CAMPAP", "SASBADI", "DELI", "CHINA-STAT", ...knownBrands].filter(Boolean))].sort();
      presets.slice(0, 14).forEach((br) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-sm btn-soft-blue";
        b.textContent = br;
        b.onclick = () => { inp.value = br; };
        chips.appendChild(b);
      });

      return new Promise((resolve) => {
        const form = document.getElementById("mbs-brand-form");
        const finish = (val) => {
          form.onsubmit = null;
          document.getElementById("mbs-brand-close-btn").onclick = null;
          dlg.removeEventListener("cancel", onCancel);
          if (dlg.open) { dlg.close(); dlg.returnValue = ""; }
          resolve(val);
        };
        const onCancel = (e) => { e.preventDefault(); finish(null); };
        document.getElementById("mbs-brand-close-btn").onclick = () => finish(null);
        dlg.addEventListener("cancel", onCancel);
        form.onsubmit = async (e) => {
          e.preventDefault();
          const newBr = inp.value.trim().toUpperCase();
          await this.updateItemBrand(barcode, newBr, staffName, itemName);
          showToast(`${t("brandUpdated")} (${newBr || "-"})`);
          finish(newBr);
        };
        dlg.showModal();
        inp.focus();
      });
    },

    // Helper: Collect unique brands from items + orders for filter dropdowns
    collectBrands(itemsList = [], ordersList = []) {
      const set = new Set();
      itemsList.forEach((i) => { if (i && i.brand) set.add(String(i.brand).trim().toUpperCase()); });
      ordersList.forEach((o) => { if (o && o.brand) set.add(String(o.brand).trim().toUpperCase()); });
      return [...set].sort();
    },

    // Helper: Resolve effective brand for an order
    resolveOrderBrand(order, itemsMap = {}) {
      const it = itemsMap[order.barcode];
      return String((it && it.brand) || order.brand || "").trim().toUpperCase();
    },

    // 10. Export Pending Orders CSV with optional Brand filter (Admin, Picker, Branch)
    exportPendingOrdersCsv({ orders = [], itemsMap = {}, brandFilter = "ALL", scopeLabel = "ALL" }) {
      const pending = orders.filter((o) => o.status === "PENDING");
      const filtered = pending.filter((o) => {
        if (!brandFilter || brandFilter === "ALL") return true;
        const br = this.resolveOrderBrand(o, itemsMap);
        if (brandFilter === "__NONE__") return !br;
        return br === brandFilter.toUpperCase();
      });

      if (!filtered.length) {
        showToast(t("noData"));
        return 0;
      }

      const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const rows = [[
        "Order ID", "Branch", "Staff", "Barcode", "Item Name", "Brand",
        "Rack Codes", "Pick Now", "Qty", "Item Status", "Urgent",
        "Urgent Extra Qty", "Customer Contact", "Remark", "Updated At"
      ]];

      // Sort cleanly by Brand -> Rack -> Branch
      const sorted = [...filtered].sort((a, b) => {
        const ba = this.resolveOrderBrand(a, itemsMap);
        const bb = this.resolveOrderBrand(b, itemsMap);
        if (ba !== bb) return ba.localeCompare(bb);
        return (a.branch_name || "").localeCompare(b.branch_name || "");
      });

      sorted.forEach((o) => {
        const it = itemsMap[o.barcode] || {};
        const brand = this.resolveOrderBrand(o, itemsMap);
        rows.push([
          o.id || "",
          o.branch_name || "",
          o.staff_name || "",
          o.barcode || "",
          it.item_name || o.item_name || "",
          brand,
          (it.rack_codes || []).join(" | "),
          isPickNowItem(it) ? "YES" : "NO",
          o.qty ?? 0,
          it.item_status || "ACTIVE",
          o.is_urgent ? "URGENT" : "NORMAL",
          o.urgent_extra_qty ?? 0,
          o.customer_contact || "",
          o.remark || "",
          o.updated_at ? new Date(o.updated_at).toLocaleString() : ""
        ]);
      });

      const csv = "\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\n");
      const today = new Date().toISOString().slice(0, 10);
      const safeScope = String(scopeLabel || "ALL").replace(/[^a-zA-Z0-9_-]+/g, "-");
      const safeBrand = brandFilter === "ALL" ? "ALL-BRANDS" : brandFilter === "__NONE__" ? "NO-BRAND" : brandFilter.replace(/[^a-zA-Z0-9_-]+/g, "-");
      const filename = `MBS_Pending_${safeScope}_${safeBrand}_${today}.csv`;

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`⬇ Exported ${filtered.length} pending orders!`);
      return filtered.length;
    },

    // 11. Universal Pending Restock Exporter (Available to ALL roles: Put-Away, Order, Pick, Admin)
    // Filter by Brand, grouped/classified by Branch!
    buildPendingRestockRows(allItems, allPendingOrders, brandFilter = "ALL", branchFilter = "ALL") {
      const noStockItems = allItems.filter((it) => it.item_status === "NO_STOCK");
      const rows = [];

      noStockItems.forEach((it) => {
        const brand = String(it.brand || "").trim().toUpperCase();
        if (brandFilter !== "ALL") {
          if (brandFilter === "__NONE__" ? brand : brand !== brandFilter.toUpperCase()) return;
        }

        const waitingOrders = allPendingOrders.filter((o) => o.barcode === it.barcode);
        if (waitingOrders.length === 0) {
          if (branchFilter === "ALL" || branchFilter === "WAREHOUSE (NO BRANCH ORDER)") {
            rows.push({
              branch: "WAREHOUSE (NO BRANCH ORDER)",
              brand,
              barcode: it.barcode,
              item_name: it.item_name || it.barcode,
              rack_codes: (it.rack_codes || []).join(" | "),
              qty_needed: 0,
              stock_quantity: it.stock_quantity ?? "",
              is_urgent: false,
              customer_contact: "",
              remark: "",
              updated_by: it.updated_by || ""
            });
          }
        } else {
          waitingOrders.forEach((o) => {
            if (branchFilter !== "ALL" && o.branch_name !== branchFilter) return;
            rows.push({
              branch: o.branch_name || "UNKNOWN",
              brand,
              barcode: it.barcode,
              item_name: it.item_name || o.item_name || it.barcode,
              rack_codes: (it.rack_codes || []).join(" | "),
              qty_needed: Number(o.qty || 0),
              stock_quantity: it.stock_quantity ?? "",
              is_urgent: Boolean(o.is_urgent),
              customer_contact: o.customer_contact || "",
              remark: o.remark || "",
              updated_by: it.updated_by || ""
            });
          });
        }
      });

      // Classify / Sort cleanly by Branch -> Brand -> Barcode
      rows.sort((a, b) => {
        if (a.branch !== b.branch) return a.branch.localeCompare(b.branch);
        if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
        return a.barcode.localeCompare(b.barcode);
      });
      return rows;
    },

    async openPendingRestockExportDialog() {
      await init();
      // QUOTA-SAFE: Only fetch NO_STOCK items (e.g. ~20 docs) instead of scanning entire items collection!
      const [allItems, allPendingOrders] = await Promise.all([
        this.listNoStockItems(),
        this.listOrders({ status: "PENDING" })
      ]);

      let dlg = document.getElementById("mbs-restock-export-dialog");
      if (!dlg) {
        dlg = document.createElement("dialog");
        dlg.id = "mbs-restock-export-dialog";
        dlg.setAttribute("closedby", "any");
        dlg.setAttribute("aria-labelledby", "mbs-rexp-title");

        const hdr = document.createElement("div");
        hdr.className = "dialog-header";
        const h2 = document.createElement("h2");
        h2.id = "mbs-rexp-title";
        const cBtn = document.createElement("button");
        cBtn.type = "button";
        cBtn.id = "mbs-rexp-close";
        cBtn.className = "btn btn-sm btn-outline";
        hdr.append(h2, cBtn);

        const body = document.createElement("div");
        body.className = "dialog-body";

        const filters = document.createElement("div");
        filters.className = "grid-2";
        filters.style.marginBottom = "10px";

        const f1 = document.createElement("div");
        f1.className = "field";
        f1.style.marginBottom = "0";
        const l1 = document.createElement("label");
        l1.id = "mbs-rexp-brand-lbl";
        l1.setAttribute("for", "mbs-rexp-brand");
        const s1 = document.createElement("select");
        s1.id = "mbs-rexp-brand";
        f1.append(l1, s1);

        const f2 = document.createElement("div");
        f2.className = "field";
        f2.style.marginBottom = "0";
        const l2 = document.createElement("label");
        l2.id = "mbs-rexp-branch-lbl";
        l2.setAttribute("for", "mbs-rexp-branch");
        const s2 = document.createElement("select");
        s2.id = "mbs-rexp-branch";
        f2.append(l2, s2);

        filters.append(f1, f2);

        const summary = document.createElement("div");
        summary.id = "mbs-rexp-summary";
        summary.className = "alert alert-info";

        const preview = document.createElement("div");
        preview.id = "mbs-rexp-preview";
        preview.style.cssText = "max-height:260px;overflow-y:auto;margin-bottom:12px;";

        const dlBtn = document.createElement("button");
        dlBtn.type = "button";
        dlBtn.id = "mbs-rexp-download";
        dlBtn.className = "btn btn-lg btn-success btn-block";

        body.append(filters, summary, preview, dlBtn);
        dlg.append(hdr, body);
        document.body.appendChild(dlg);
        if (window.initDialogPolyfill) window.initDialogPolyfill();
      }

      document.getElementById("mbs-rexp-title").textContent = "⬇ " + t("exportRestockTitle");
      document.getElementById("mbs-rexp-close").textContent = t("close");
      document.getElementById("mbs-rexp-brand-lbl").textContent = t("brand");
      document.getElementById("mbs-rexp-branch-lbl").textContent = t("branch");
      document.getElementById("mbs-rexp-download").textContent = "⬇ " + t("exportRestockCsv") + " (CSV)";

      const noStockItems = allItems.filter((i) => i.item_status === "NO_STOCK");
      const brandSel = document.getElementById("mbs-rexp-brand");
      brandSel.replaceChildren();
      [
        ["ALL", t("allBrands")],
        ["__NONE__", t("noBrandTag")],
        ...this.collectBrands(noStockItems, []).map((b) => [b, b])
      ].forEach(([val, lbl]) => {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = lbl;
        brandSel.appendChild(opt);
      });

      const branchSel = document.getElementById("mbs-rexp-branch");
      const allBranchNames = [...new Set(
        this.buildPendingRestockRows(allItems, allPendingOrders, "ALL", "ALL").map((r) => r.branch)
      )].sort();
      branchSel.replaceChildren();
      const allBOpt = document.createElement("option");
      allBOpt.value = "ALL";
      allBOpt.textContent = t("allBranchesOpt");
      branchSel.appendChild(allBOpt);
      allBranchNames.forEach((b) => {
        const opt = document.createElement("option");
        opt.value = b;
        opt.textContent = b;
        branchSel.appendChild(opt);
      });

      const renderPreview = () => {
        const rows = this.buildPendingRestockRows(allItems, allPendingOrders, brandSel.value, branchSel.value);
        const grouped = new Map();
        rows.forEach((r) => {
          if (!grouped.has(r.branch)) grouped.set(r.branch, []);
          grouped.get(r.branch).push(r);
        });

        document.getElementById("mbs-rexp-summary").textContent =
          `${rows.length} Pending Restock rows across ${grouped.size} Branch(es)`;

        const box = document.getElementById("mbs-rexp-preview");
        box.replaceChildren();
        if (!rows.length) {
          const p = document.createElement("p");
          p.style.color = "var(--muted)";
          p.textContent = t("noData");
          box.appendChild(p);
          document.getElementById("mbs-rexp-download").disabled = true;
          return;
        }
        document.getElementById("mbs-rexp-download").disabled = false;

        grouped.forEach((bRows, branchName) => {
          const grpCard = document.createElement("div");
          grpCard.style.cssText = "border:1px solid var(--border);border-radius:10px;padding:8px 10px;margin-bottom:8px;background:var(--surface-2);";
          const hdrRow = document.createElement("div");
          hdrRow.style.cssText = "font-weight:800;font-size:0.88rem;color:var(--accent-dark);margin-bottom:4px;";
          hdrRow.textContent = `🏪 ${branchName} (${bRows.length})`;
          grpCard.appendChild(hdrRow);

          bRows.forEach((r) => {
            const line = document.createElement("div");
            line.style.cssText = "font-size:0.8rem;padding:3px 0;border-top:1px dashed #cbd5e1;";
            line.textContent = `[${r.brand || "-"}] ${r.item_name} (${r.barcode}) • Rack: ${r.rack_codes || "-"} • Qty: ${r.qty_needed}${r.is_urgent ? " 🔥URGENT" : ""}`;
            grpCard.appendChild(line);
          });
          box.appendChild(grpCard);
        });
      };

      brandSel.onchange = renderPreview;
      branchSel.onchange = renderPreview;
      document.getElementById("mbs-rexp-close").onclick = () => { dlg.close(); dlg.returnValue = ""; };
      document.getElementById("mbs-rexp-download").onclick = () => {
        const rows = this.buildPendingRestockRows(allItems, allPendingOrders, brandSel.value, branchSel.value);
        if (!rows.length) return showToast(t("noData"));

        const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const csvRows = [[
          "Branch", "Brand", "Barcode", "Item Name", "Rack Codes",
          "Qty Needed", "System Stock Qty", "Urgent", "Customer Contact", "Remark", "Flagged By"
        ]];
        rows.forEach((r) => {
          csvRows.push([
            r.branch,
            r.brand,
            r.barcode,
            r.item_name,
            r.rack_codes,
            r.qty_needed,
            r.stock_quantity,
            r.is_urgent ? "URGENT" : "NORMAL",
            r.customer_contact,
            r.remark,
            r.updated_by
          ]);
        });
        const csv = "\uFEFF" + csvRows.map((r) => r.map(esc).join(",")).join("\n");
        const today = new Date().toISOString().slice(0, 10);
        const safeBrand = brandSel.value === "ALL" ? "ALL-BRANDS" : brandSel.value === "__NONE__" ? "NO-BRAND" : brandSel.value.replace(/[^a-zA-Z0-9_-]+/g, "-");
        const safeBranch = branchSel.value === "ALL" ? "BY-BRANCH" : branchSel.value.replace(/[^a-zA-Z0-9_-]+/g, "-");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `MBS_PendingRestock_${safeBrand}_${safeBranch}_${today}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`⬇ Exported ${rows.length} Pending Restock rows!`);
      };

      renderPreview();
      dlg.showModal();
    }
  };
})();
