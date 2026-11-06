import fs from 'fs';
import os from 'os';
import path from 'path';
import { Knex } from 'knex';
import { getSchemas } from 'schemas';
import test from 'tape';
import { DatabaseManager } from '../manager';

/**
 * Synthetic issue-step reproduction, checkpoint 1.
 *
 * These are NOT real user `.db` files. Each test builds a small SQLite company
 * database from the shapes described in upstream #1536, #1351, #1291 and
 * #1546, then opens it through the public DatabaseManager.connectToDatabase()
 * path. A future app version is recorded in SingleValue so the fixture isolates
 * schema migration from historical data patches; all patch outcomes are already
 * present because the fixture starts from a fully migrated company DB.
 */

const FUTURE_APP_VERSION = '99.0.0';
const COMPANY_NAME = 'Synthetic Issue-Step Company';
const INVOICE_NAME = 'SINV-1001';
const CUSTOMER_NAME = 'John Whoe';

process.env.IS_TEST = 'true';

type Fixture = {
  dir: string;
  dbPath: string;
  cleanup: () => void;
};

type TestAssert = Parameters<Parameters<typeof test>[1]>[0];

function getMeta() {
  const now = new Date().toISOString();
  return {
    createdBy: 'Administrator',
    modifiedBy: 'Administrator',
    created: now,
    modified: now,
  };
}

async function ensureRow(
  knex: Knex,
  table: string,
  name: string,
  values: Record<string, unknown>
) {
  const existing = await knex(table).where({ name }).first();
  if (!existing) {
    await knex(table).insert({ name, ...values, ...getMeta() });
  }
}

async function createBaseline(label: string): Promise<Fixture> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `books-${label}-`));
  const dbPath = path.join(dir, 'company.books.db');
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  const dm = new DatabaseManager();

  try {
    await dm.createNewDatabase(dbPath, '-');
    const knex = dm.db!.knex!;

    await ensureRow(knex, 'NumberSeries', 'SINV-', {
      referenceType: 'SalesInvoice',
      current: 1000,
    });
    await ensureRow(knex, 'Party', CUSTOMER_NAME, { role: 'Customer' });
    await ensureRow(knex, 'Account', 'Debtors', {
      rootType: 'Asset',
      lft: 1,
      rgt: 2,
    });
    await ensureRow(knex, 'Account', 'Sales', {
      rootType: 'Income',
      lft: 3,
      rgt: 4,
    });
    await ensureRow(knex, 'Account', 'Cost of Goods Sold', {
      rootType: 'Expense',
      lft: 5,
      rgt: 6,
    });
    await ensureRow(knex, 'UOM', 'Unit', {});
    await ensureRow(knex, 'Location', 'Main', {});
    await ensureRow(knex, 'Item', 'Widget', {
      for: 'Both',
      incomeAccount: 'Sales',
      expenseAccount: 'Cost of Goods Sold',
    });

    await knex('SalesInvoice').insert({
      name: INVOICE_NAME,
      numberSeries: 'SINV-',
      party: CUSTOMER_NAME,
      account: 'Debtors',
      date: '2025-05-05',
      grandTotal: '50000.00',
      submitted: 1,
      cancelled: 0,
      ...getMeta(),
    });
    await knex('SalesInvoiceItem').insert({
      name: 'SINV-ITEM-1',
      item: 'Widget',
      rate: '50000.00',
      quantity: 1,
      account: 'Debtors',
      idx: 0,
      parent: INVOICE_NAME,
      parentSchemaName: 'SalesInvoice',
      parentFieldname: 'items',
    });
    await knex('PurchaseReceiptItem').insert({
      name: 'PREC-ITEM-1',
      item: 'Widget',
      location: 'Main',
      rate: '10.00',
      quantity: 1,
      idx: 0,
      parent: 'PREC-1001',
      parentSchemaName: 'PurchaseReceipt',
      parentFieldname: 'items',
    });
    await knex('ShipmentItem').insert({
      name: 'SHPM-ITEM-1',
      item: 'Widget',
      location: 'Main',
      rate: '10.00',
      quantity: 1,
      idx: 0,
      parent: 'SHPM-1001',
      parentSchemaName: 'Shipment',
      parentFieldname: 'items',
    });

    await knex('SingleValue')
      .where({ parent: 'SystemSettings', fieldname: 'version' })
      .update({ value: FUTURE_APP_VERSION });
    await dm.db!.update('AccountingSettings', {
      companyName: COMPANY_NAME,
      fullname: 'Synthetic Administrator',
      bankName: 'Synthetic Bank',
      country: 'India',
      email: 'admin@example.com',
      fiscalYearStart: '2025-04-01',
      fiscalYearEnd: '2026-03-31',
    });
  } catch (error) {
    cleanup();
    throw error;
  } finally {
    await dm.db?.close();
  }

  return { dir, dbPath, cleanup };
}

async function getColumns(knex: Knex, table: string): Promise<string[]> {
  const rows = (await knex.raw(`PRAGMA table_info(${table})`)) as {
    name: string;
  }[];
  return rows.map((row) => row.name);
}

async function getForeignKeyFields(
  knex: Knex,
  table: string
): Promise<string[]> {
  const rows = (await knex.raw(`PRAGMA foreign_key_list(${table})`)) as {
    from: string;
  }[];
  return rows.map((row) => row.from);
}

async function getTempTables(knex: Knex): Promise<string[]> {
  const rows = (await knex.raw(
    "select name from sqlite_schema where type='table' and name GLOB '__*'"
  )) as { name: string }[];
  return rows.map((row) => row.name);
}

async function getForeignKeyViolations(knex: Knex): Promise<unknown[]> {
  return (await knex.raw('PRAGMA foreign_key_check')) as unknown[];
}

async function getIntegrityCheck(knex: Knex): Promise<string> {
  const rows = (await knex.raw('PRAGMA integrity_check')) as {
    integrity_check: string;
  }[];
  return rows[0]?.integrity_check ?? '';
}

async function assertHealthyMigration(
  t: TestAssert,
  knex: Knex,
  label: string
) {
  const pragma = (await knex.raw('PRAGMA foreign_keys')) as {
    foreign_keys?: number;
  }[];
  t.equal(Number(pragma[0]?.foreign_keys ?? 0), 1, `${label}: FKs are on`);
  t.deepEqual(
    await getForeignKeyViolations(knex),
    [],
    `${label}: foreign_key_check is clean`
  );
  t.equal(
    await getIntegrityCheck(knex),
    'ok',
    `${label}: integrity_check is ok`
  );
  t.deepEqual(
    await getTempTables(knex),
    [],
    `${label}: no migration temp table remains`
  );
}

async function assertCompanyScope(t: TestAssert, dm: DatabaseManager) {
  const accountingSettings = await dm.db!.get('AccountingSettings');
  t.equal(
    accountingSettings.companyName,
    COMPANY_NAME,
    'one company remains scoped to this DB'
  );
  t.notOk(
    Object.prototype.hasOwnProperty.call(getSchemas('-', []), 'Company'),
    'one-company-per-DB has no Company DocType'
  );
}

async function dropColumns(
  knex: Knex,
  removals: Record<string, string[]>
): Promise<string[]> {
  const dropped: string[] = [];
  for (const [table, columns] of Object.entries(removals)) {
    const existing = await getColumns(knex, table);
    for (const column of columns) {
      if (!existing.includes(column)) {
        continue;
      }

      await knex.raw(`ALTER TABLE ${table} DROP COLUMN ${column}`);
      dropped.push(`${table}.${column}`);
    }
  }

  return dropped;
}

async function removeForeignKeys(knex: Knex, table: string) {
  const row = (await knex('sqlite_master')
    .where({ type: 'table', name: table })
    .first()) as { sql?: string } | undefined;
  const sql = row?.sql ?? '';
  const withoutForeignKeys = sql.replace(
    /,\s*foreign key\(`[^`]+`\) references `[^`]+`\(`[^`]+`\)(?: on delete [A-Z]+)?(?: on update [A-Z]+)?/g,
    ''
  );
  const tempTable = `__no_fk_${table}`;
  const createSql = withoutForeignKeys.replace(
    /^CREATE TABLE [`"]?SalesInvoice[`"]?/,
    `CREATE TABLE \`${tempTable}\``
  );

  if (!createSql.startsWith(`CREATE TABLE \`${tempTable}\``)) {
    throw new Error(`unexpected ${table} DDL shape: ${sql}`);
  }

  await knex.raw('PRAGMA foreign_keys=OFF');
  try {
    await knex.raw(createSql);
    await knex.raw(`INSERT INTO \`${tempTable}\` SELECT * FROM \`${table}\``);
    await knex.raw(`DROP TABLE \`${table}\``);
    await knex.raw(`ALTER TABLE \`${tempTable}\` RENAME TO \`${table}\``);
  } finally {
    await knex.raw('PRAGMA foreign_keys=ON');
  }
}

async function mutateBaseline(
  label: string,
  mutate: (knex: Knex) => Promise<void>
): Promise<Fixture> {
  const fixture = await createBaseline(label);
  const dm = new DatabaseManager();
  try {
    await dm._connect(fixture.dbPath, '-');
    await mutate(dm.db!.knex!);
  } catch (error) {
    fixture.cleanup();
    throw error;
  } finally {
    await dm.db?.close();
  }
  return fixture;
}

test('synthetic #1351: copied old DB without SalesInvoice FKs opens and migrates', async (t) => {
  const fixture = await mutateBaseline('issue-1351', async (knex) => {
    await removeForeignKeys(knex, 'SalesInvoice');
    await knex.raw('ALTER TABLE SalesInvoice ADD COLUMN legacy_note text');
    await knex('SalesInvoice').where({ name: INVOICE_NAME }).update({
      legacy_note: 'copied from an older laptop',
    });
    t.deepEqual(
      await getForeignKeyFields(knex, 'SalesInvoice'),
      [],
      'copied DB starts without SalesInvoice FKs'
    );
  });
  const dm = new DatabaseManager();

  try {
    await dm.connectToDatabase(fixture.dbPath, '-');
    const knex = dm.db!.knex!;
    t.ok(
      (await getForeignKeyFields(knex, 'SalesInvoice')).includes('party'),
      'missing SalesInvoice party FK is restored through DatabaseManager'
    );
    t.notOk(
      (await getColumns(knex, 'SalesInvoice')).includes('legacy_note'),
      'legacy column is dropped without losing the invoice'
    );
    const invoice = await dm.db!.get('SalesInvoice', INVOICE_NAME);
    t.equal(invoice.party, CUSTOMER_NAME, 'invoice party is preserved');
    t.equal(
      (invoice.items as Record<string, unknown>[]).length,
      1,
      'invoice child rows are preserved'
    );
    await assertCompanyScope(t, dm);
    await assertHealthyMigration(t, knex, '#1351');
  } finally {
    await dm.db?.close();
    fixture.cleanup();
  }
  t.end();
});

test('synthetic #1536: dangling FK fails loudly instead of silently losing data', async (t) => {
  const fixture = await mutateBaseline('issue-1536', async (knex) => {
    await knex.raw('ALTER TABLE SalesInvoice ADD COLUMN legacy_note text');
    await knex.raw('PRAGMA foreign_keys=OFF');
    await knex('Party').where({ name: CUSTOMER_NAME }).delete();
    await knex.raw('PRAGMA foreign_keys=ON');
  });
  const dm = new DatabaseManager();
  let error: Error | undefined;

  try {
    await dm.connectToDatabase(fixture.dbPath, '-');
  } catch (caught) {
    error = caught as Error;
  }

  t.ok(error, 'DatabaseManager rejects the dangling FK');
  t.ok(
    error?.message.includes('foreign key check failed'),
    'error identifies foreign_key_check, not a generic open failure'
  );

  const inspect = new DatabaseManager();
  try {
    await inspect._connect(fixture.dbPath, '-');
    const knex = inspect.db!.knex!;
    const invoice = (await knex('SalesInvoice')
      .where({ name: INVOICE_NAME })
      .first()) as { party?: string } | undefined;
    t.equal(
      invoice?.party,
      CUSTOMER_NAME,
      'the corrupt invoice row is preserved for manual recovery'
    );
    t.equal(
      await getIntegrityCheck(knex),
      'ok',
      'the original SQLite file remains readable'
    );
    t.deepEqual(
      await getTempTables(knex),
      [],
      'failed rebuild leaves no temp table'
    );
  } finally {
    await inspect.db?.close();
    await dm.db?.close();
    fixture.cleanup();
  }
  t.end();
});

test('synthetic #1291: post-update DB missing newer columns migrates through DatabaseManager', async (t) => {
  const removals: Record<string, string[]> = {
    SalesInvoice: ['isFullyReturned', 'isSyncedWithErp'],
    SalesQuote: ['isFullyReturned', 'isSyncedWithErp'],
    PurchaseInvoice: ['isFullyReturned', 'isSyncedWithErp'],
    SalesInvoiceItem: ['itemCode'],
    PurchaseInvoiceItem: ['itemCode'],
    SalesQuoteItem: ['itemCode'],
    PurchaseReceiptItem: ['itemDiscountAmount', 'itemDiscountPercent'],
    ShipmentItem: ['itemDiscountAmount', 'itemDiscountPercent'],
  };
  let droppedCount = 0;
  const fixture = await mutateBaseline('issue-1291', async (knex) => {
    const dropped = await dropColumns(knex, removals);
    droppedCount = dropped.length;
    t.ok(droppedCount >= 10, 'documented newer columns start absent');
  });
  const dm = new DatabaseManager();

  try {
    await dm.connectToDatabase(fixture.dbPath, '-');
    const knex = dm.db!.knex!;
    for (const [table, columns] of Object.entries(removals)) {
      const existing = await getColumns(knex, table);
      for (const column of columns) {
        t.ok(
          existing.includes(column),
          `${table}.${column} is restored on open`
        );
      }
    }

    const invoice = (await knex('SalesInvoice')
      .where({ name: INVOICE_NAME })
      .first()) as
      | { isFullyReturned?: number; isSyncedWithErp?: number }
      | undefined;
    t.equal(invoice?.isFullyReturned, 0, 'new check column default is safe');
    t.equal(invoice?.isSyncedWithErp, 0, 'new sync column default is safe');
    t.equal(
      (await knex('SalesInvoiceItem').where({ parent: INVOICE_NAME })).length,
      1,
      'child rows survive additive migration'
    );
    await assertCompanyScope(t, dm);
    await assertHealthyMigration(t, knex, '#1291');
  } finally {
    await dm.db?.close();
    fixture.cleanup();
  }
  t.end();
});

test('synthetic #1546: openCount write needs a writable DB directory', async (t) => {
  const source = await createBaseline('issue-1546');
  const readOnlyDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'books-readonly-1546-')
  );
  const writableDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'books-writable-1546-')
  );
  const readOnlyDb = path.join(readOnlyDir, 'company.books.db');
  const writableDb = path.join(writableDir, 'company.books.db');
  const cleanup = () => {
    try {
      fs.chmodSync(readOnlyDir, 0o700);
    } catch {}
    fs.rmSync(readOnlyDir, { recursive: true, force: true });
    fs.rmSync(writableDir, { recursive: true, force: true });
    source.cleanup();
  };

  fs.copyFileSync(source.dbPath, readOnlyDb);
  fs.copyFileSync(source.dbPath, writableDb);

  try {
    if (process.platform === 'win32') {
      t.pass('directory permission reproduction is skipped on Windows');
    } else {
      fs.chmodSync(readOnlyDir, 0o500);
      const blocked = new DatabaseManager();
      let error: Error | undefined;
      try {
        await blocked.connectToDatabase(readOnlyDb, '-');
        await blocked.db!.update('Misc', { openCount: 21 });
      } catch (caught) {
        error = caught as Error;
      } finally {
        await blocked.db?.close();
      }
      t.ok(
        error,
        'openCount write fails when the DB directory cannot hold a journal'
      );
      fs.chmodSync(readOnlyDir, 0o700);
    }

    const writable = new DatabaseManager();
    try {
      await writable.connectToDatabase(writableDb, '-');
      await writable.db!.update('Misc', { openCount: 21 });
      const misc = await writable.db!.get('Misc');
      t.equal(Number(misc.openCount), 21, 'openCount is readable after write');
      const row = (await writable.db!.knex!('SingleValue')
        .where({ parent: 'Misc', fieldname: 'openCount' })
        .first()) as { value?: string } | undefined;
      t.equal(Number(row?.value), 21, 'SingleValue.openCount is stored');
      await assertCompanyScope(t, writable);
      await assertHealthyMigration(t, writable.db!.knex!, '#1546');
    } finally {
      await writable.db?.close();
    }
  } finally {
    cleanup();
  }
  t.end();
});
