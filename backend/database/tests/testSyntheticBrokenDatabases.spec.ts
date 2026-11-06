import { cloneDeep } from 'lodash';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Field, SchemaMap } from 'schemas/types';
import test from 'tape';
import { getDefaultMetaFieldValueMap } from '../../helpers';
import DatabaseCore from '../core';
import { FieldValueMap } from '../types';
import {
  assertDoesNotThrow,
  assertThrows,
  getBuiltTestSchemaMap,
} from './helpers';

/**
 * Synthetic broken-DB reproduction for the P0 DB-open/migration reports.
 *
 * These are NOT real user `.db` files. Each test writes a small SQLite file
 * with a deliberately older/corrupt schema shape, then runs the same
 * `DatabaseCore.migrate()` path the app uses. The goal is to cover migration
 * states that the in-memory `testMigration.spec.ts` cannot produce.
 */

const CUSTOMER_NAME = 'John Whoe';
const INVOICE_NAME = 'SINV-1001';
const ITEM_NAME = 'SINV-ITEM-1';

type SingleValueMode = 'normal' | 'legacy' | 'missing';

type LegacyOptions = {
  customerExtraColumn?: boolean;
  customerHasPhone?: boolean;
  invoiceExtraColumn?: boolean;
  invoiceHasForeignKey?: boolean;
  invoiceHasCustomer?: boolean;
  singleValueMode?: SingleValueMode;
  addLoyaltyPointsField?: boolean;
};

type LegacyDb = {
  dbPath: string;
  cleanup: () => void;
};

function defaults(options: LegacyOptions): Required<LegacyOptions> {
  return {
    customerExtraColumn: options.customerExtraColumn ?? false,
    customerHasPhone: options.customerHasPhone ?? true,
    invoiceExtraColumn: options.invoiceExtraColumn ?? false,
    invoiceHasForeignKey: options.invoiceHasForeignKey ?? true,
    invoiceHasCustomer: options.invoiceHasCustomer ?? true,
    singleValueMode: options.singleValueMode ?? 'normal',
    addLoyaltyPointsField: options.addLoyaltyPointsField ?? false,
  };
}

function buildCustomerSql(options: Required<LegacyOptions>) {
  const columns = [
    '`name` text not null',
    '`email` text',
    options.customerHasPhone ? '`phone` text' : null,
    options.customerExtraColumn ? '`legacy_email` text' : null,
    '`createdBy` text not null',
    '`modifiedBy` text not null',
    '`created` datetime not null',
    '`modified` datetime not null',
    'primary key (`name`)',
  ].filter(Boolean);
  return `CREATE TABLE Customer (${columns.join(', ')})`;
}

function buildSalesInvoiceSql(options: Required<LegacyOptions>) {
  const columns = [
    '`name` text not null',
    '`date` date',
    options.invoiceHasCustomer ? '`customer` text not null' : null,
    '`account` text not null',
    '`grandTotal` text',
    options.invoiceExtraColumn ? '`legacy_note` text' : null,
    '`createdBy` text not null',
    '`modifiedBy` text not null',
    '`created` datetime not null',
    '`modified` datetime not null',
    '`submitted` boolean not null',
    '`cancelled` boolean not null',
    options.invoiceHasCustomer && options.invoiceHasForeignKey
      ? 'foreign key(`customer`) references `Customer`(`name`) on delete RESTRICT on update CASCADE'
      : null,
    'primary key (`name`)',
  ].filter(Boolean);
  return `CREATE TABLE SalesInvoice (${columns.join(', ')})`;
}

const SALES_INVOICE_ITEM_SQL = `
  CREATE TABLE SalesInvoiceItem (
    \`name\` text not null,
    \`item\` text not null,
    \`quantity\` float not null default '1',
    \`rate\` float not null,
    \`amount\` float,
    \`idx\` integer not null,
    \`parent\` text not null,
    \`parentSchemaName\` text not null,
    \`parentFieldname\` text not null,
    primary key (\`name\`)
  )
`;

const SINGLE_VALUE_SQL = `
  CREATE TABLE SingleValue (
    \`name\` text not null,
    \`parent\` text not null,
    \`fieldname\` text not null,
    \`value\` text not null,
    \`createdBy\` text not null,
    \`modifiedBy\` text not null,
    \`created\` datetime not null,
    \`modified\` datetime not null,
    primary key (\`name\`)
  )
`;

const SINGLE_VALUE_LEGACY_SQL = `
  CREATE TABLE SingleValue (
    \`name\` text not null,
    \`parent\` text not null,
    \`fieldname\` text not null,
    \`legacy_note\` text,
    \`createdBy\` text not null,
    \`modifiedBy\` text not null,
    \`created\` datetime not null,
    \`modified\` datetime not null,
    primary key (\`name\`)
  )
`;

function buildSchemaMap(options: Required<LegacyOptions>): SchemaMap {
  const schemaMap = cloneDeep(getBuiltTestSchemaMap(true));
  if (options.addLoyaltyPointsField) {
    schemaMap.Customer!.fields.push({
      fieldname: 'loyaltyPoints',
      label: 'Loyalty Points',
      fieldtype: 'Int',
      default: 0,
      required: true,
    } as Field);
  }
  return schemaMap;
}

async function createLegacyDb(options: LegacyOptions): Promise<LegacyDb> {
  const opts = defaults(options);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'books-synthetic-'));
  const dbPath = path.join(dir, 'legacy.db');
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });

  const db = new DatabaseCore(dbPath);
  try {
    await db.connect();
    await db.knex!.raw(buildCustomerSql(opts));
    await db.knex!.raw(buildSalesInvoiceSql(opts));
    await db.knex!.raw(SALES_INVOICE_ITEM_SQL);

    if (opts.singleValueMode === 'normal') {
      await db.knex!.raw(SINGLE_VALUE_SQL);
    } else if (opts.singleValueMode === 'legacy') {
      await db.knex!.raw(SINGLE_VALUE_LEGACY_SQL);
    }

    const meta = getDefaultMetaFieldValueMap();
    const customer: FieldValueMap = {
      name: CUSTOMER_NAME,
      email: 'john@whoe.com',
      ...(opts.customerHasPhone ? { phone: '9999999999' } : {}),
      ...(opts.customerExtraColumn ? { legacy_email: 'old@whoe.com' } : {}),
      ...meta,
    };
    await db.knex!('Customer').insert(customer);

    const invoice: FieldValueMap = {
      name: INVOICE_NAME,
      date: '2022-01-21',
      ...(opts.invoiceHasCustomer ? { customer: CUSTOMER_NAME } : {}),
      account: 'Debtors',
      grandTotal: 0,
      ...(opts.invoiceExtraColumn ? { legacy_note: 'legacy note' } : {}),
      submitted: false,
      cancelled: false,
      ...meta,
    };
    await db.knex!('SalesInvoice').insert(invoice);

    await db.knex!('SalesInvoiceItem').insert({
      name: ITEM_NAME,
      item: 'Widget',
      quantity: 1,
      rate: 100,
      amount: 100,
      idx: 0,
      parent: INVOICE_NAME,
      parentSchemaName: 'SalesInvoice',
      parentFieldname: 'items',
    });

    if (opts.singleValueMode === 'normal') {
      await db.knex!('SingleValue').insert({
        name: 'sv-locale',
        parent: 'SystemSettings',
        fieldname: 'locale',
        value: 'en-IN',
        ...meta,
      });
    } else if (opts.singleValueMode === 'legacy') {
      await db.knex!('SingleValue').insert({
        name: 'sv-locale',
        parent: 'SystemSettings',
        fieldname: 'locale',
        legacy_note: 'keep',
        ...meta,
      });
    }
  } catch (error) {
    cleanup();
    throw error;
  } finally {
    await db.close();
  }

  return { dbPath, cleanup };
}

async function withLegacyDb(
  options: LegacyOptions,
  callback: (db: DatabaseCore) => Promise<void>
) {
  const { dbPath, cleanup } = await createLegacyDb(options);
  const db = new DatabaseCore(dbPath);
  try {
    await db.connect();
    db.setSchemaMap(buildSchemaMap(defaults(options)));
    await callback(db);
  } finally {
    if (db.knex) {
      await db.close();
    }
    cleanup();
  }
}

async function getColumns(db: DatabaseCore, table: string): Promise<string[]> {
  const rows = (await db.knex!.raw(`PRAGMA table_info(${table})`)) as {
    name: string;
  }[];
  return rows.map((row) => row.name);
}

async function getForeignKeyFields(
  db: DatabaseCore,
  table: string
): Promise<string[]> {
  const rows = (await db.knex!.raw(`PRAGMA foreign_key_list(${table})`)) as {
    from: string;
  }[];
  return rows.map((row) => row.from);
}

async function getTempTables(db: DatabaseCore): Promise<string[]> {
  const rows = (await db.knex!.raw(
    "select name from sqlite_schema where type='table' and name GLOB '__*'"
  )) as { name: string }[];
  return rows.map((row) => row.name);
}

async function getForeignKeysPragma(db: DatabaseCore): Promise<number> {
  const rows = (await db.knex!.raw('PRAGMA foreign_keys')) as {
    foreign_keys?: number;
  }[];
  return Number(rows[0]?.foreign_keys ?? 0);
}

async function getForeignKeyViolations(db: DatabaseCore): Promise<unknown[]> {
  return (await db.knex!.raw('PRAGMA foreign_key_check')) as unknown[];
}

async function getIntegrityCheck(db: DatabaseCore): Promise<string> {
  const rows = (await db.knex!.raw('PRAGMA integrity_check')) as {
    integrity_check: string;
  }[];
  return rows[0]?.integrity_check ?? '';
}

async function assertHealthyMigration(
  t: Parameters<Parameters<typeof test>[1]>[0],
  db: DatabaseCore,
  label: string
) {
  t.equal(await getForeignKeysPragma(db), 1, `${label}: FK enforcement is on`);
  t.deepEqual(
    await getForeignKeyViolations(db),
    [],
    `${label}: foreign_key_check is clean`
  );
  t.equal(await getIntegrityCheck(db), 'ok', `${label}: integrity_check is ok`);
  t.deepEqual(await getTempTables(db), [], `${label}: no temp tables remain`);
}

test('synthetic legacy DB with removed columns and enforced FKs migrates cleanly', async (t) => {
  await withLegacyDb(
    {
      customerExtraColumn: true,
      invoiceExtraColumn: true,
      invoiceHasForeignKey: true,
      singleValueMode: 'normal',
    },
    async (db) => {
      await assertDoesNotThrow(
        async () => await db.migrate(),
        'legacy DB with removed columns should migrate'
      );

      const customerColumns = await getColumns(db, 'Customer');
      t.notOk(
        customerColumns.includes('legacy_email'),
        'legacy Customer column is dropped'
      );
      const invoiceColumns = await getColumns(db, 'SalesInvoice');
      t.notOk(
        invoiceColumns.includes('legacy_note'),
        'legacy SalesInvoice column is dropped'
      );

      const customer = await db.get('Customer', CUSTOMER_NAME);
      t.equal(customer.email, 'john@whoe.com', 'customer email is preserved');
      t.equal(customer.phone, '9999999999', 'customer phone is preserved');
      t.notOk(
        'legacy_email' in customer,
        'removed customer column is not read'
      );

      const invoice = await db.get('SalesInvoice', INVOICE_NAME);
      t.equal(invoice.customer, CUSTOMER_NAME, 'invoice link is preserved');
      t.equal(invoice.account, 'Debtors', 'invoice account is preserved');
      t.equal(
        (invoice.items as FieldValueMap[]).length,
        1,
        'child rows are preserved'
      );
      t.notOk('legacy_note' in invoice, 'removed invoice column is not read');

      t.ok(
        (await getForeignKeyFields(db, 'SalesInvoice')).includes('customer'),
        'SalesInvoice foreign key is present'
      );
      await assertThrows(
        async () => await db.delete('Customer', CUSTOMER_NAME),
        'FK enforcement is restored'
      );
      await assertHealthyMigration(t, db, 'removed columns');
    }
  );
  t.end();
});

test('synthetic legacy DB without a Link FK gains the FK on migration', async (t) => {
  await withLegacyDb(
    {
      invoiceExtraColumn: true,
      invoiceHasForeignKey: false,
      singleValueMode: 'normal',
    },
    async (db) => {
      t.deepEqual(
        await getForeignKeyFields(db, 'SalesInvoice'),
        [],
        'legacy table starts without the FK'
      );

      await assertDoesNotThrow(
        async () => await db.migrate(),
        'adding a missing FK should rebuild the table'
      );

      t.ok(
        (await getForeignKeyFields(db, 'SalesInvoice')).includes('customer'),
        'missing FK is added'
      );
      t.notOk(
        (await getColumns(db, 'SalesInvoice')).includes('legacy_note'),
        'combined rebuild drops the legacy column'
      );

      const invoice = await db.get('SalesInvoice', INVOICE_NAME);
      t.equal(invoice.customer, CUSTOMER_NAME, 'invoice row is preserved');
      t.equal(
        (invoice.items as FieldValueMap[]).length,
        1,
        'child rows are preserved after FK rebuild'
      );

      await assertThrows(
        async () => await db.delete('Customer', CUSTOMER_NAME),
        'newly added FK is enforced'
      );
      await assertHealthyMigration(t, db, 'new FK');
    }
  );
  t.end();
});

test('synthetic legacy DB with a new required default column migrates without rebuild', async (t) => {
  await withLegacyDb(
    {
      addLoyaltyPointsField: true,
      customerExtraColumn: false,
      invoiceExtraColumn: false,
      singleValueMode: 'normal',
    },
    async (db) => {
      t.notOk(
        (await getColumns(db, 'Customer')).includes('loyaltyPoints'),
        'legacy Customer starts without the new column'
      );

      await assertDoesNotThrow(
        async () => await db.migrate(),
        'adding a default column should not fail'
      );

      t.ok(
        (await getColumns(db, 'Customer')).includes('loyaltyPoints'),
        'new column is added'
      );
      const customer = await db.get('Customer', CUSTOMER_NAME);
      t.equal(
        Number(customer.loyaltyPoints),
        0,
        'existing row receives the schema default'
      );

      await assertThrows(
        async () => await db.delete('Customer', CUSTOMER_NAME),
        'FK enforcement survives an additive migration'
      );
      await assertHealthyMigration(t, db, 'added column');
    }
  );
  t.end();
});

test('synthetic DB with a missing SingleValue table recreates it and accepts openCount writes', async (t) => {
  await withLegacyDb(
    {
      singleValueMode: 'missing',
    },
    async (db) => {
      t.notOk(
        (await getColumns(db, 'SingleValue')).length,
        'SingleValue table starts absent'
      );

      await assertDoesNotThrow(
        async () => await db.migrate(),
        'missing SingleValue table should be created'
      );

      const columns = await getColumns(db, 'SingleValue');
      t.ok(columns.includes('value'), 'SingleValue.value exists');
      t.ok(columns.includes('name'), 'SingleValue.name exists');

      await assertDoesNotThrow(
        async () => await db.insert('Misc', { openCount: 1 }),
        'writing Misc.openCount should not fail'
      );

      const singleValue = await db.knex!('SingleValue')
        .where({ parent: 'Misc', fieldname: 'openCount' })
        .first();
      t.equal(Number(singleValue?.value), 1, 'openCount is stored');

      const misc = await db.get('Misc');
      t.equal(Number(misc.openCount), 1, 'openCount is readable');
      t.ok('useFullWidth' in misc, 'Misc default is initialized');

      const settings = await db.get('SystemSettings');
      t.equal(
        settings.locale,
        'en-IN',
        'SystemSettings locale default is initialized'
      );
      t.equal(
        settings.dateFormat,
        'dd/MM/yyyy',
        'SystemSettings dateFormat default is initialized'
      );

      await assertHealthyMigration(t, db, 'missing SingleValue');
    }
  );
  t.end();
});

test('synthetic legacy SingleValue table is rebuilt and still accepts openCount writes', async (t) => {
  await withLegacyDb(
    {
      singleValueMode: 'legacy',
    },
    async (db) => {
      const before = await getColumns(db, 'SingleValue');
      t.notOk(
        before.includes('value'),
        'legacy SingleValue has no value column'
      );
      t.ok(
        before.includes('legacy_note'),
        'legacy SingleValue has extra column'
      );

      await assertDoesNotThrow(
        async () => await db.migrate(),
        'malformed SingleValue table should rebuild'
      );

      const after = await getColumns(db, 'SingleValue');
      t.ok(after.includes('value'), 'value column is restored');
      t.notOk(after.includes('legacy_note'), 'legacy column is dropped');

      const preserved = await db.knex!('SingleValue')
        .where({ parent: 'SystemSettings', fieldname: 'locale' })
        .first();
      t.equal(
        preserved?.value,
        '',
        'preserved row receives a required-column fallback'
      );

      const dateFormat = await db.knex!('SingleValue')
        .where({ parent: 'SystemSettings', fieldname: 'dateFormat' })
        .first();
      t.equal(dateFormat?.value, 'dd/MM/yyyy', 'missing default is inserted');

      await assertDoesNotThrow(
        async () => await db.insert('Misc', { openCount: 1 }),
        'openCount write works after SingleValue rebuild'
      );
      const misc = await db.get('Misc');
      t.equal(Number(misc.openCount), 1, 'openCount is readable');
      t.ok('useFullWidth' in misc, 'Misc default is initialized');

      await assertHealthyMigration(t, db, 'legacy SingleValue');
    }
  );
  t.end();
});

test('synthetic DB with an orphaned required Link fails loudly instead of losing data', async (t) => {
  await withLegacyDb(
    {
      invoiceHasCustomer: false,
      invoiceHasForeignKey: false,
      singleValueMode: 'normal',
    },
    async (db) => {
      let error: Error | undefined;
      try {
        await db.migrate();
      } catch (err) {
        error = err as Error;
      }

      t.ok(error, 'migration fails on an orphaned FK');
      t.ok(
        error?.message.includes('foreign key check failed'),
        'failure is a clear foreign_key_check error'
      );
      t.equal(
        await getForeignKeysPragma(db),
        1,
        'FK enforcement is restored even after failure'
      );
      t.deepEqual(
        await getTempTables(db),
        [],
        'no temp table is left behind after failure'
      );
      t.equal(await getIntegrityCheck(db), 'ok', 'database is still readable');
    }
  );
  t.end();
});
