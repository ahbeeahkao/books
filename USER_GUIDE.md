# Frappe Books User Guide

## 1. Getting Started

- **Setup Wizard:** Create or open a company database (`.db`), set your base currency, fiscal year, and Chart of Accounts.
- **Invoicing & Payments:** Create **Sales Invoices** and **Purchase Invoices** from the sidebar, submit them to post to the General Ledger, and record **Payments** against them.

## 2. Inventory, POS, Barcodes & Batches

- **Items & UOMs:** Configure multiple Units of Measure (e.g., Pack → Box → Case, or Tablet → Strip → Box) and map each UOM's barcode in the **Barcodes** table.
- **Batches & Serial Numbers:** Enable **Has Batch** (for expiry/lot tracking, such as pharmacy products) or **Has Serial Number** (for unique items, such as graded collectibles).
- **POS Shifts:** Open and close **POS Shifts** daily. If no cash denominations are configured, type the opening/closing cash amount directly.

## 3. Reports & Custom Report Builder

- **Built-in Reports:** Open **General Ledger**, **Profit And Loss**, **Balance Sheet**, **Trial Balance**, and **Stock** reports from **Reports** in the sidebar.
- **Custom Report Builder:**
  1. Go to **Reports → Custom Report Builder**.
  2. Choose a **Base Document** (e.g., `SalesInvoice`, `PurchaseInvoice`, `Payment`, `Item`, `Party`).
  3. Select the columns you want and add filter rules (`=`, `!=`, `contains`, `>`, `<`, `>=`, `<=`).
  4. Click **Run Report** to preview results, or **Save** to store the report definition.

## 4. Malaysia e-Invoice (MyInvois)

1. Go to **Settings → Malaysia e-Invoice**.
2. Toggle **Enable Malaysia e-Invoice (MyInvois)** on (or off to disable).
3. Enter your **Supplier TIN**, **BRN / NRIC**, **MSIC Code**, **Business Activity Description**, and **Sandbox / Production** environment (plus optional MyInvois Client ID/Secret).
4. Open any **Sales Invoice** and click **Actions → Export Malaysia e-Invoice (UBL)** to generate and copy the UBL 2.1 JSON payload.
