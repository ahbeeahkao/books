import fs from 'fs';
import os from 'os';
import path from 'path';
import test from 'tape';
import { createDatabaseBackup } from '../src/utils/autoBackup';
import { sanitizeFtsQuery } from '../src/utils/ftsSearch';
import { buildThermalReceiptHtml } from '../src/utils/thermalReceipt';

test('createDatabaseBackup creates timestamped backup and prunes old backups', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'books-backup-'));
  const dbPath = path.join(tmpDir, 'company.db');
  const backupDir = path.join(tmpDir, 'backups');
  fs.writeFileSync(dbPath, 'sqlite-dummy');

  // Seed 2 older backups
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, 'company.backup-2026-01-01.db'), '1');
  fs.writeFileSync(path.join(backupDir, 'company.backup-2026-01-02.db'), '2');

  const res = createDatabaseBackup(dbPath, backupDir, 2);
  t.ok(fs.existsSync(res.backupPath), 'new backup file exists');
  t.equal(res.prunedPaths.length, 1, 'pruned oldest backup beyond maxBackups=2');

  fs.rmSync(tmpDir, { recursive: true, force: true });
  t.end();
});

test('sanitizeFtsQuery strips special chars and appends prefix wildcard', (t) => {
  t.equal(
    sanitizeFtsQuery('  charizard "151"  '),
    'charizard* 151*',
    'formats FTS5 prefix query'
  );
  t.equal(sanitizeFtsQuery('   '), '', 'returns empty string for blank query');
  t.end();
});

test('buildThermalReceiptHtml generates 80mm receipt with MyInvois URL', (t) => {
  const html = buildThermalReceiptHtml({
    companyName: 'PokeMart Sdn Bhd',
    invoiceName: 'SINV-0042',
    date: '2026-11-18',
    items: [{ name: 'Booster Pack', qty: 2, rate: 20, amount: 40 }],
    netTotal: 40,
    grandTotal: 40,
    eInvoiceValidationUrl: 'https://myinvois.hasil.gov.my/uuid/share/longId',
  });

  t.ok(html.includes('width:80mm'), 'uses 80mm width');
  t.ok(html.includes('Booster Pack x2'), 'includes line item');
  t.ok(html.includes('MyInvois Validation:'), 'includes MyInvois validation');
  t.end();
});
