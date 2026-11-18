# Frappe Books — Complete Self-Learning Guide

## 1. First-Time Setup
1. Launch **Frappe Books** and click **New File** (or **Open File** to load an existing `.db`).
2. Complete the **Setup Wizard**: enter your Company Name, Country, Base Currency, and Fiscal Year.
3. Your data is stored locally in a single SQLite `.db` file. Before opening any existing `.db`, Frappe Books automatically creates a timestamped backup in the `backups/` folder next to your `.db` file (keeping the latest 10 backups).

---

## 2. Core Accounting & Invoicing
- **Chart of Accounts:** Manage Asset, Liability, Income, Expense, and Equity accounts under **Chart of Accounts**.
- **Parties (Customers & Suppliers):** Add customers and suppliers before creating invoices.
- **Sales & Purchase Invoices:**
  1. Create a **Sales Invoice** (or **Purchase Invoice**), select the Party, add Items, and review taxes/totals.
  2. Click **Submit** to post entries to the General Ledger.
  3. Click **Make Payment** to record cash, bank, or card payments against the invoice.
- **Journal Entries:** Use **Journal Entry** for manual adjustments, opening balances, or transfers.

---

## 3. Inventory, POS, Barcodes, Batches & Serial Numbers
- **Units of Measure (UOMs) & Barcodes:**
  - On an **Item**, define UOM conversions (e.g., `Pack` → `Box = 36 Packs` → `Case = 6 Boxes`, or `Tablet` → `Strip = 10 Tablets`).
  - Map each UOM's barcode in the **Barcodes** table so scanning with a USB barcode scanner bills the exact quantity and price.
- **Batch & Expiry Tracking (e.g., Pharmacy):**
  - Enable **Has Batch** on the Item. Record Batch No. and Expiry Date on **Purchase Invoices**, and pick the batch at checkout in **POS**.
- **Serial Numbers (e.g., Graded Collectibles / Electronics):**
  - Enable **Has Serial Number** on the Item to track individual unit IDs from purchase to sale.
- **POS Shifts:**
  - Open and close **POS Shifts** daily. If no cash denominations are configured in **Defaults**, type your opening and closing cash amounts directly.

![POS View](https://github.com/user-attachments/assets/f75116b4-cf5f-45ee-9927-ba380fa56a46)
- **80mm Thermal Receipt Printing:**
  - Open any **Sales Invoice** and click **Actions → Print 80mm Thermal Receipt** to print a narrow-width receipt. You can also customize print layouts in **Template Builder**.

---

## 4. Reports & Custom Report Builder
- **Built-in Reports:** Open **General Ledger**, **Profit And Loss**, **Balance Sheet**, **Trial Balance**, and **Stock** reports from **Reports** in the sidebar.

![General Ledger](https://github.com/user-attachments/assets/58d8bcdf-1576-4008-b010-7054fb64a12d)
- **Custom Report Builder:**
  1. Go to **Reports → Custom Report Builder**.
  2. Choose a **Base Document** (`SalesInvoice`, `PurchaseInvoice`, `Payment`, `JournalEntry`, `Account`, `Item`, `Party`).
  3. Check the columns you want to display.
  4. Add filter rules (`=`, `!=`, `contains`, `>`, `<`, `>=`, `<=`) or use **This Month** / **This Year** date presets.
  5. Click **Run Report** to preview, or **Save** to store it (reopen anytime from **Load Saved Report**).

---

## 5. Malaysia e-Invoice (MyInvois)
1. Go to **Settings → Malaysia e-Invoice**.
2. Toggle **Enable Malaysia e-Invoice (MyInvois)** on (or off to disable).
3. Enter your **Supplier TIN**, **BRN / NRIC**, **MSIC Code**, **Business Activity Description**, **Environment** (`Sandbox` or `Production`), and **MyInvois Client ID / Client Secret**.
4. **Manual Export / Submit:** Open any **Sales Invoice** and use **Actions → Export Malaysia e-Invoice (UBL)** (copies UBL 2.1 JSON) or **Actions → Submit Malaysia e-Invoice (MyInvois)** (submits and saves the UUID + QR validation link).
5. **Auto-Submit:** Enable **Auto-submit on Invoice Submit** in Settings to submit automatically whenever a Sales Invoice is submitted.
6. **QR Code on Print:** Submitted invoices display the scannable MyInvois QR code and validation URL in **Print View** and on **80mm Thermal Receipts**.

---

## 6. Troubleshooting & Support
- **Export Support Logs:** Go to **Settings → System** and click **Export Support Logs** to download a JSON diagnostic snapshot (platform, version, log folder path `%APPDATA%\frappe-books\logs\`, and anonymized usage/timing stats).
- **Uninstalling on Windows:** Running the Windows uninstaller removes the app binaries while preserving your `.db` files and `%APPDATA%\frappe-books\` settings/backups.
