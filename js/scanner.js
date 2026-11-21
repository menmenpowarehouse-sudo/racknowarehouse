/**
 * MBS Point-Bin WMS — 3-Layer Rapid Triple-Match Camera Scanner
 *
 * - Auto-recognizes QR Code, Code128, EAN-13, EAN-8, Code39, UPC-A/E
 * - Requires 3 consecutive identical scans (configurable via MBS_CONFIG.SCAN_CONFIRM_COUNT)
 * - Resets to 0/3 with error buzz if any mismatched read occurs
 * - Immediately stops camera hardware & releases MediaStream on 3/3 match or dialog close
 */
(function () {
  let html5Qr = null;
  let activeResolve = null;
  let isStopping = false;

  // Web Audio lightweight beep (no audio files needed)
  function playBeep(freq, durationMs, type = "sine") {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = 0.14;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, durationMs);
    } catch (_) {}
  }

  function vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  function ensureDialog() {
    let dlg = document.getElementById("mbs-scanner-dialog");
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "mbs-scanner-dialog";
    dlg.setAttribute("aria-labelledby", "mbs-scan-title");

    const hdr = document.createElement("div");
    hdr.className = "dialog-header";
    const h2 = document.createElement("h2");
    h2.id = "mbs-scan-title";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "btn btn-sm btn-outline";
    closeBtn.id = "mbs-scan-close-btn";
    hdr.append(h2, closeBtn);

    const body = document.createElement("div");
    body.className = "dialog-body";

    const rule = document.createElement("p");
    rule.id = "mbs-scan-rule";
    rule.style.cssText = "margin:0 0 10px;font-size:0.86rem;color:#475569;font-weight:600;";

    const videoBox = document.createElement("div");
    videoBox.id = "scanner-video-box";

    const dots = document.createElement("div");
    dots.className = "scan-dots";
    dots.id = "mbs-scan-dots";
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("div");
      dot.className = "scan-dot";
      dots.appendChild(dot);
    }

    const status = document.createElement("div");
    status.id = "mbs-scan-status";
    status.style.cssText = "font-size:0.95rem;font-weight:800;text-align:center;min-height:28px;color:#0f172a;";

    const manualHint = document.createElement("div");
    manualHint.id = "mbs-scan-err";
    manualHint.style.cssText = "font-size:0.84rem;color:#b91c1c;text-align:center;margin-top:6px;";

    body.append(rule, videoBox, dots, status, manualHint);
    dlg.append(hdr, body);
    document.body.appendChild(dlg);

    closeBtn.addEventListener("click", () => {
      stopScannerAndClose(null);
    });
    dlg.addEventListener("cancel", (e) => {
      e.preventDefault();
      stopScannerAndClose(null);
    });
    return dlg;
  }

  async function stopCameraNow() {
    if (isStopping) return;
    isStopping = true;
    try {
      if (html5Qr) {
        const state = html5Qr.getState ? html5Qr.getState() : 2;
        if (state === 2 || state === 3) {
          await html5Qr.stop();
        }
        await html5Qr.clear();
        html5Qr = null;
      }
    } catch (_) {
      html5Qr = null;
    } finally {
      // Defensive kill of any lingering video tracks in #scanner-video-box
      const box = document.getElementById("scanner-video-box");
      if (box) {
        box.querySelectorAll("video").forEach((v) => {
          if (v.srcObject) {
            v.srcObject.getTracks().forEach((tr) => tr.stop());
            v.srcObject = null;
          }
        });
        box.replaceChildren();
      }
      isStopping = false;
    }
  }

  async function stopScannerAndClose(resultValue) {
    await stopCameraNow();
    const dlg = document.getElementById("mbs-scanner-dialog");
    if (dlg && dlg.open) {
      dlg.close();
      dlg.returnValue = "";
    }
    if (activeResolve) {
      const fn = activeResolve;
      activeResolve = null;
      fn(resultValue);
    }
  }

  /**
   * Opens camera modal, requires 3 consecutive identical scans, then immediately kills camera.
   * @param {Object} opts - { title?: string, requiredMatches?: number }
   * @returns {Promise<string|null>}
   */
  window.openTripleScanner = function (opts = {}) {
    return new Promise(async (resolve) => {
      const required = opts.requiredMatches || (window.MBS_CONFIG && window.MBS_CONFIG.SCAN_CONFIRM_COUNT) || 3;
      const dlg = ensureDialog();
      activeResolve = resolve;

      document.getElementById("mbs-scan-title").textContent = opts.title || t("scanTitle");
      document.getElementById("mbs-scan-close-btn").textContent = t("close");
      document.getElementById("mbs-scan-rule").textContent = t("scanRule");
      const statusEl = document.getElementById("mbs-scan-status");
      const errEl = document.getElementById("mbs-scan-err");
      const dotsEl = document.getElementById("mbs-scan-dots");

      statusEl.textContent = t("scanWaiting");
      statusEl.style.color = "#0f172a";
      errEl.textContent = "";

      const renderDots = (hits, isErr = false) => {
        dotsEl.replaceChildren();
        for (let i = 0; i < required; i++) {
          const d = document.createElement("div");
          d.className = "scan-dot" + (isErr ? " err" : i < hits ? " hit" : "");
          dotsEl.appendChild(d);
        }
      };
      renderDots(0);

      dlg.showModal();

      if (typeof window.Html5Qrcode === "undefined") {
        errEl.textContent = "Scanner library (html5-qrcode) failed to load. Check internet or type manually.";
        return;
      }

      let lastCode = "";
      let matchCount = 0;
      let lastReadTs = 0;
      let locked = false;

      const onScanSuccess = (decodedText) => {
        if (locked) return;
        const clean = String(decodedText || "").trim();
        if (!clean) return;

        // Throttle 140ms between frames so rapid 3x takes ~0.5 seconds naturally
        const now = Date.now();
        if (now - lastReadTs < 140) return;
        lastReadTs = now;

        if (clean === lastCode) {
          matchCount += 1;
          playBeep(700 + matchCount * 160, 70);
          vibrate(35);
          renderDots(matchCount);
          statusEl.style.color = "#15803d";
          statusEl.textContent = `${clean}  (${matchCount}/${required})`;
        } else if (matchCount > 0) {
          // Mismatch! Anti-mistake reset to 0/3
          lastCode = "";
          matchCount = 0;
          playBeep(220, 180, "sawtooth");
          vibrate([80, 40, 80]);
          renderDots(0, true);
          statusEl.style.color = "#b91c1c";
          statusEl.textContent = t("scanMismatch");
          return;
        } else {
          lastCode = clean;
          matchCount = 1;
          playBeep(760, 70);
          vibrate(30);
          renderDots(1);
          statusEl.style.color = "#1d4ed8";
          statusEl.textContent = `${clean}  (1/${required})`;
        }

        if (matchCount >= required) {
          locked = true;
          playBeep(1180, 140);
          vibrate([40, 30, 80]);
          statusEl.style.color = "#15803d";
          statusEl.textContent = `${t("scanMatched")} ${clean}`;
          // Immediately shut down camera & background stream
          setTimeout(() => stopScannerAndClose(clean), 160);
        }
      };

      try {
        await stopCameraNow();
        html5Qr = new Html5Qrcode("scanner-video-box", {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E
          ],
          verbose: false
        });
        await html5Qr.start(
          { facingMode: "environment" },
          { fps: 14, qrbox: { width: 250, height: 150 } },
          onScanSuccess,
          () => {}
        );
      } catch (e) {
        errEl.textContent = "Camera unavailable (HTTPS & camera permission required): " + (e.message || e);
      }
    });
  };
})();
