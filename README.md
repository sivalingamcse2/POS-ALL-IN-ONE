# SIVARA POS v2.0 — Advanced Restaurant & Supermarket POS Software

An enterprise, dual-concept Point of Sale (POS) and inventory management system designed for **Supermarkets, Grocery Stores, Convenience Retail** and **Restaurants, Cafes, and Dining Hospitality**.

Built with an **Offline-First Hybrid Architecture**, offering both **100% Standalone Local Storage** and **Multi-Terminal Cloud Storage Synchronization**.

---

## 🌟 Key Capabilities

### 1. 🛒 Supermarket & Grocery Retail POS (`/supermarket-pos`)
- **Hardware USB Barcode Scanner Support**: Instant auto-focus, keystroke barcode scanner gun listener with Web Audio sound confirmation.
- **Weighing Scale & Price-Embedded Barcodes**: Built-in produce scale mode for fruits, vegetables, deli, and meat sold by weight (`kg`, `g`, `lb`). Auto-parses GS1/EAN-13 price-embedded scale barcodes (prefix `20`/`02`).
- **High-Speed Cashier Keypad & Multipliers**: Multiplier syntax (e.g. `5*Barcode`), quick quantity adjustments, rapid cash tender keys (`$5`, `$10`, `$20`, `$50`, `$100`, `Exact Cash`).
- **Dynamic Change Due Calculator**: Real-time display of exact change owed to customer.
- **Multi-Cart Hold & Recall (Park Carts)**: Park customer carts (e.g. customer stepped away) and recall with 1 click to serve the next customer without delay.
- **Price Check / Barcode Lookup (F3)**: Check item price and stock on hand without adding to active ticket.
- **Customer Loyalty & Points**: Scan customer barcode, accumulate points on purchases, and redeem points for cash discounts.
- **80mm & 58mm Thermal Receipts**: Itemized customer receipts with barcodes, tax/VAT details, cashier info, and return policy.
- **Keyboard Shortcuts**: `F1` (Clear), `F2` (Scan), `F3` (Price Check), `F7` (Hold Cart), `F8` (Recall), `F9` (Customer), `F10` (Pay), `F12` (Drawer), `Esc` (Cancel).

---

### 2. 🍽️ Restaurant & Hospitality POS (`/pos`)
- **Interactive Floor Map & Table Service**: Table status indicators (`available`, `occupied`, `billed`).
- **Kitchen Display System (KDS)**: Real-time kitchen tickets with preparation status (`New`, `In Progress`, `Ready`, `Served`).
- **Dine-In, Takeaway, & Delivery**: Split bills, course timing, item modifiers, and table transfers.
- **Guest QR Code Ordering**: Guests can scan QR codes to browse the menu and order directly from their phone.

---

### 3. 💼 Cash Drawer & Shift Management (X-Report / Z-Report)
- **Opening Float**: Set initial starting cash for the shift.
- **Pay In / Pay Out**: Record petty cash payouts or float top-ups with audit reasons.
- **Mid-Shift X-Report**: Print or inspect non-clearing interim financial summaries.
- **End-of-Day Z-Report**: Cashier cash count reconciliation, calculates over/short discrepancies, prints official fiscal audit slip, and closes drawer session.

---

### 4. 📦 Advanced Inventory & Expiry Control (`/inventory`)
- **Supermarket Catalog**: Barcodes (EAN-13 / UPC), SKUs, Departments/Aisles, Units of measure (`pcs`, `kg`, `g`, `pack`, `box`, `bottle`, `can`), Cost price, Markup, and Retail price.
- **Batch / Lot & Expiry Date Tracking**: Automatic expiry warning tags (🔴 Expired, 🟠 <7 Days, 🟡 <30 Days, 🟢 Fresh).
- **Printable Shelf Price Tags & Barcodes**: Generate and print formatted aisle shelf tags with barcodes, unit prices, and product names.
- **AI Smart Auto-Reorder**: 1-click automatic stock replenishment for critical low-stock items.

---

### 5. ☁️ Cloud & Local Storage Architecture (`/storage`)
- **⚡ Hybrid Auto-Sync (Recommended)**:
  - Centralized Cloud primary database with automatic local offline fallback.
  - Transactions continue processing seamlessly even if internet disconnects.
  - Offline queue auto-syncs to cloud once connectivity resumes.
- **💾 Local Storage Only (Air-Gapped / Offline)**:
  - 100% standalone execution on this PC. Zero internet connection required. Complete privacy and maximum speed.
- **☁️ Cloud Storage Only**:
  - Direct live cloud operations for multi-counter chains and remote branch aggregation.
- **1-Click System Backup & Restore**:
  - 📥 **Export Backup (.json)**: Full download of products, orders, categories, customers, and shifts.
  - 📤 **Restore from Backup**: Safe file restoration with data validation.

---

## 🚀 Quick Start Guide

### 1-Click Launch (Windows)
Double-click **`run-pos.bat`** in this folder to start both the server and client simultaneously!

### Manual Launch

#### Step 1: Start Backend API
```bash
cd server
npm run dev
```
*API runs on `http://localhost:5000/api`*

#### Step 2: Start Frontend Web App
```bash
cd client
npm run dev
```
*Web App opens on `http://localhost:8080`*

---

## Employee access and activation

Employee accounts are managed through the authenticated API and PostgreSQL. Before using the database-backed User & Security Center, apply migrations `001_initial_schema.sql`, `002_hotel_schema.sql`, and `003_user_access_security.sql` to the configured database. New employees receive a single-use password-setup token that expires after 24 hours; copy the generated setup link and deliver it to the employee through a trusted channel. Passwords are hashed with bcrypt and are never returned by the API.

The Settings > Branches page manages server-backed restaurant branches and supermarket stores. For PostgreSQL, also apply `004_multi_store_types.sql` before using store type selection. Existing restaurant rows are classified as restaurant branches by default; supermarket catalog and POS data are filtered by the active store.

For first-time administrator setup, apply the migrations and run `node scripts/bootstrap-admin.js --username admin --confirm` from `server`. This disables the legacy admin password and prints a one-time activation link (24-hour expiry). Set `APP_URL` to the HTTPS frontend origin before running it outside localhost. Store/share that link securely. Do not use a hard-coded default password. For an intentionally single-machine local JSON deployment, add `--local` and restart the backend afterward so it reloads the local data file; this is not suitable for multi-server production use.

The JSON local-storage fallback is intended for POS data continuity, not for production identity management. Use PostgreSQL for persistent employee access control. MFA and automated email delivery are not included yet. Login throttling is currently process-local; deployments with multiple API instances should use a shared rate-limit store.
