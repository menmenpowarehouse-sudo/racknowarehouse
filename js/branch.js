/**
 * MBS Point-Bin WMS — Frontend Configuration & Seed Accounts (No Frontend Security)
 *
 * 1. Fill in FIREBASE_CONFIG from Firebase Console -> Project Settings -> Web App.
 * 2. Fill in GAS_WEBAPP_URL after deploying google_apps_script/Code.gs as Web App.
 * 3. Leave empty to test immediately in Built-in Local Demo Mode (localStorage).
 * 4. Admin page (restock.html) can also add/edit branches & staff live in Firebase
 *    and export an updated copy of this branch.js file anytime.
 */

window.MBS_CONFIG = {
  // LIVE Firebase Web App config (Project: racknowarehouse)
  FIREBASE_CONFIG: {
    apiKey: "AIzaSyB9YIxjrSZmPKU4ELFZ1nFYQ_xSaj9-56s",
    authDomain: "racknowarehouse.firebaseapp.com",
    projectId: "racknowarehouse",
    storageBucket: "racknowarehouse.firebasestorage.app",
    messagingSenderId: "685110285750",
    appId: "1:685110285750:web:49eb03f0ab17c1a7d91d17"
  },

  // LIVE Google Apps Script Web App URL (Item_Master 200k + PO_History + Drive Photo)
  GAS_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbyULEqnD974idAoq5W75zaGK-RZ-SVSARQ5o616iBr_5Rn9y0SUBYsEqLsnARhbOs0E/exec",

  // Operational Tuning
  SCAN_CONFIRM_COUNT: 3,        // Require 3 consecutive identical scans
  RACK_REMINDER_MINUTES: 5,     // Ask to confirm/change rack code every 5 minutes
  MAX_PICK_LOGS: 1000,          // Keep latest 1000 picking logs in Firebase
  MAX_PO_HISTORY_PER_ITEM: 100  // Keep latest 100 orders per (branch + item) in Google Sheet
};

/**
 * Default / Seed Branches & Staff (branch name, staff name, password, role)
 * Roles: "BRANCH" | "PICKER" | "PUTAWAY" | "ADMIN"
 * Note: At runtime, Firebase `branches_staff` overrides/extends this list automatically.
 */
window.MBS_BRANCH_STAFF = [
  // Admin / Warehouse HQ
  { branch: "HQ WAREHOUSE", staff: "Admin IT", password: "123", role: "ADMIN" },
  { branch: "HQ WAREHOUSE", staff: "Ali (Putaway)", password: "123", role: "PUTAWAY" },
  { branch: "HQ WAREHOUSE", staff: "Siti (Picker)", password: "123", role: "PICKER" },
  { branch: "HQ WAREHOUSE", staff: "Ah Chong (Picker)", password: "123", role: "PICKER" },

  // Sample Branches (add all 26 branches here or inside restock.html Admin page)
  { branch: "MBS WORLD", staff: "Farah", password: "123", role: "BRANCH" },
  { branch: "MBS KUANTAN", staff: "Hafiz", password: "123", role: "BRANCH" },
  { branch: "MBS KEMAMAN", staff: "Mei Ling", password: "123", role: "BRANCH" },
  { branch: "MBS TEMERLOH", staff: "Kumar", password: "123", role: "BRANCH" },
  { branch: "MBS INDERA MAHKOTA", staff: "Nurul", password: "123", role: "BRANCH" },
  { branch: "MBS BENTONG", staff: "Jason", password: "123", role: "BRANCH" }
];
