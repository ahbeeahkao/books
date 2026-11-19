<div align="center" markdown="1">
<br/>

<img src="https://frappe.io/files/books.png" alt="Frappe Books logo" width="80"/>

<br/>

<h1>Frappe Books (Windows-First Fork)</h1>

**Modern Offline-First Desktop Accounting & POS**

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/ahbeeahkao/books)](https://github.com/ahbeeahkao/books/releases)
![Platform](https://img.shields.io/badge/platform-windows%20x64-blue)
[![Build](https://github.com/ahbeeahkao/books/actions/workflows/build.yml/badge.svg)](https://github.com/ahbeeahkao/books/actions/workflows/build.yml)

</div>

<div align="center">
<img src="https://user-images.githubusercontent.com/29507195/207267857-4ae48890-3fb2-4046-80cf-3256b46c72a0.png" alt="Frappe Books Preview"/>
</div>

## Overview

**Frappe Books** (`ahbeeahkao/books`) is an actively maintained, offline-first desktop accounting and POS application built on Electron 45 and SQLite, tailored for SMEs, retail shops, pharmacies, and collectibles stores.

### Key Fork Enhancements
- **Malaysia e-Invoice (MyInvois):** Built-in Settings toggle, merchant TIN/BRN/MSIC configuration, UBL 2.1 JSON export, live MyInvois submission, auto-submit on invoice submit, and scannable QR validation on printouts.
- **Custom Report Builder:** Create, filter, preview, and save custom reports on any core document (`SalesInvoice`, `PurchaseInvoice`, `Payment`, `Item`, `Party`, etc.).
- **POS & Inventory:** Multi-UOM barcode scanning, batch/expiry tracking, serial numbers, typed-cash POS shift fallback (when no denominations are configured), and 80mm thermal receipt printing.
- **Reliability & Data Safety:** Automatic timestamped `.db` backups before opening, FTS5 search support, support diagnostics export, and an optional complete-uninstall prompt on Windows.

## Documentation

- **[Complete Self-Learning User Guide](USER_GUIDE.md)** — step-by-step instructions with screenshots for setup, invoicing, POS, Custom Reports, and Malaysia e-Invoice.
- **[Glossary](GLOSSARY.md)** — key accounting and POS terms.
- **[Release Policy](RELEASE_POLICY.md)** — fork versioning (`v0.37.0-fork.N`) and release gates.

## License

AGPL-3.0-only (forked from `frappe/books`).
