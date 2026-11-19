# Frappe Books — Complete Self-Learning User Guide

This guide is a self-contained manual for end users on Windows. No external documentation website is required.

---

## Table of Contents
1. [Installation & First-Time Setup](#1-installation--first-time-setup)
2. [Dashboard & Navigation](#2-dashboard--navigation)
3. [Chart of Accounts & Parties](#3-chart-of-accounts--parties)
4. [Items, Barcodes, UOMs, Batches & Serial Numbers](#4-items-barcodes-uoms-batches--serial-numbers)
5. [Sales Invoices, Purchase Invoices & Payments](#5-sales-invoices-purchase-invoices--payments)
6. [Point of Sale (POS), Shifts & 80mm Thermal Receipts](#6-point-of-sale-pos-shifts--80mm-thermal-receipts)
7. [Built-in Financial Reports](#7-built-in-financial-reports)
8. [Custom Report Builder](#8-custom-report-builder)
9. [Malaysia e-Invoice (MyInvois) & QR Validation](#9-malaysia-e-invoice-myinvois--qr-validation)
10. [Backups, Support Logs & Uninstalling](#10-backups-support-logs--uninstalling)

---

## 1. Installation & First-Time Setup
1. Run the Windows installer (`Frappe Books Setup *.exe`) and follow the installation wizard.
2. Launch **Frappe Books** and click **New File** (or **Open File** to open an existing `.db` file).
3. Complete the **Setup Wizard**:
   - Enter your **Company Name**, **Country**, **Base Currency** (e.g., `MYR`), and **Fiscal Year** start/end dates.
   - Choose your Chart of Accounts template.
4. **Automatic Backups:** Your entire accounting database is stored in a single `.db` file. Every time you open an existing `.db`, a timestamped backup is automatically saved in the `backups/` folder next to your `.db` file (keeping the latest 10 backups).

---

## 2. Dashboard & Navigation
- Use the **left sidebar** to switch between **Get Started**, **Dashboard**, **Sales**, **Purchases**, **Inventory**, **POS**, **Reports**, and **Settings**.
- If the sidebar is collapsed, click **Show Sidebar** at the top-left to expand it again.
- Use `Ctrl +` / `Ctrl -` / `Ctrl 0` to zoom in, zoom out, or reset zoom.

![Frappe Books Dashboard](https://user-images.githubusercontent.com/29507195/207267857-4ae48890-3fb2-4046-80cf-3256b46c72a0.png)

---

## 3. Chart of Accounts & Parties
- **Chart of Accounts:** Go to **Accounting → Chart of Accounts** to view or add Asset, Liability, Income, Expense, and Equity accounts.
- **Parties (Customers & Suppliers):**
  1. Go to **Sales → Customers** (or **Purchases → Suppliers**).
  2. Click **New** and enter the Party Name, Email/Phone, Billing Address, and Tax ID / TIN (if applicable for e-Invoice).

---

## 4. Items, Barcodes, UOMs, Batches & Serial Numbers
- **Creating an Item:** Go to **Inventory → Items → New**, enter Item Name, Rate, and Default Unit of Measure (UOM).
- **Multi-UOM & Barcodes (Retail / Trading Cards / Pharmacy):**
  1. In the **UOMs** table, add conversion factors (e.g., `Pack = 1`, `Box = 36 Packs`, or `Tablet = 1`, `Strip = 10 Tablets`).
  2. In the **Barcodes** table, map each barcode to its corresponding **UOM** so scanning a box or strip bills the exact quantity.
- **Batch & Expiry Tracking (Pharmacy / Perishables):**
  - Check **Has Batch** on the Item. Record Batch No. and Expiry Date on **Purchase Invoices**, and select the batch during **POS** checkout.
- **Serial Numbers (Graded Collectibles / Electronics):**
  - Check **Has Serial Number** on the Item to track individual unit IDs from purchase to sale.

---

## 5. Sales Invoices, Purchase Invoices & Payments
1. Go to **Sales → Sales Invoices → New** (or **Purchases → Purchase Invoices → New**).
2. Select the **Party**, **Date**, and add **Items** (or scan barcodes).
3. Review **Taxes**, **Discounts**, and **Grand Total**, then click **Save** and **Submit** to post to the General Ledger.
4. Click **Make Payment** on a submitted invoice to record Cash, Bank, or Card payments.
5. For manual adjustments or opening balances, use **Accounting → Journal Entries**.

---

## 6. Point of Sale (POS), Shifts & 80mm Thermal Receipts
1. Enable **Point of Sale** in **Settings → Inventory** and configure **Settings → POS Settings** (Cash Account, Payment Methods).
2. **Open POS Shift:** Open **POS** and enter your opening cash. If no cash denominations are configured in **Settings → Defaults**, type the opening cash amount directly.
3. **Checkout:** Scan barcodes or click items, select batches if prompted, and complete payment.
4. **Close POS Shift:** At the end of the day, close the shift by counting denominations or typing the closing cash amount.
5. **80mm Thermal Receipt:** On any **Sales Invoice**, click **Actions → Print 80mm Thermal Receipt** to print a narrow-width receipt. You can also customize print layouts in **Template Builder**.

![POS View](https://github.com/user-attachments/assets/f75116b4-cf5f-45ee-9927-ba380fa56a46)

---

## 7. Built-in Financial Reports
Open **Reports** in the sidebar to view:
- **General Ledger:** Full transaction history with running and carry-forward opening balances.
- **Profit And Loss:** Income vs. Expenses for any date range.
- **Balance Sheet:** Assets, Liabilities, and Equity snapshot.
- **Trial Balance & Stock Reports:** Account balances, Stock Ledger, and Stock Balance.

![General Ledger](https://github.com/user-attachments/assets/58d8bcdf-1576-4008-b010-7054fb64a12d)

![Profit and Loss](https://github.com/user-attachments/assets/11bd67d1-d808-496b-ac4d-ef68c18b9419)

---

## 8. Custom Report Builder
1. Go to **Reports → Custom Report Builder**.
2. Choose a **Base Document** (`SalesInvoice`, `PurchaseInvoice`, `Payment`, `JournalEntry`, `Account`, `Item`, `Party`).
3. Check the **Columns** you want to include.
4. Add **Filters** (`=`, `!=`, `contains`, `>`, `<`, `>=`, `<=`) or click **This Month** / **This Year** for quick date ranges.
5. Click **Run Report** to preview results, or **Save** to store the report (reopen anytime via **Load Saved Report**).

---

## 9. Malaysia e-Invoice (MyInvois) & QR Validation
1. Go to **Settings → Malaysia e-Invoice**.
2. Toggle **Enable Malaysia e-Invoice (MyInvois)** on (or off to disable).
3. Enter your **Supplier TIN**, **BRN / NRIC**, **MSIC Code**, **Business Activity Description**, **Environment** (`Sandbox` or `Production`), and **MyInvois Client ID / Client Secret**.
4. **Manual Export / Submit:** Open any **Sales Invoice** and click:
   - **Actions → Export Malaysia e-Invoice (UBL)** to copy the UBL 2.1 JSON payload.
   - **Actions → Submit Malaysia e-Invoice (MyInvois)** to submit directly and save the UUID and validation URL.
5. **Auto-Submit:** Enable **Auto-submit on Invoice Submit** in Settings to submit automatically whenever a Sales Invoice is submitted.
6. **QR Code on Print:** Submitted invoices display the scannable MyInvois QR code and validation URL in **Print View** and on **80mm Thermal Receipts**.

---

## 10. Backups, Support Logs & Uninstalling
- **Export Support Logs:** Go to **Settings → System** and click **Export Support Logs** to download a JSON diagnostic file (app version, platform, `%APPDATA%\frappe-books\logs\` path, and anonymized usage/timing stats).
- **Uninstalling on Windows:** Run **Uninstall Frappe Books** from Windows Settings. You will be prompted whether you also want to remove AppData/logs (**Complete Uninstall**). Your `.db` accounting files saved in Documents or other folders are never deleted by the uninstaller.
