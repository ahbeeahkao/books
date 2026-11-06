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
 * Regression coverage for upstream #1536 / #1351 / #1291: removing a column
 * while foreign keys are enforced must rebuild the table rather than issuing
 * SQLite DDL that breaks the schema.
 */
test('migration rebuilds tables with removed columns without breaking foreign keys', async (t) => {
  const db = new DatabaseCore();
  await db.connect();
  db.setSchemaMap(getBuiltTestSchemaMap());
  await db.migrate();

  const customer: FieldValueMap = {
    name: 'John Whoe',
    email: 'john@whoe.com',
    phone: '9999999999',
    ...getDefaultMetaFieldValueMap(),
  };

  const invoice: FieldValueMap = {
    name: 'SINV-1001',
    date: '2022-01-21',
    customer: customer.name,
    account: 'Debtors',
    grandTotal: 0,
    items: [],
    submitted: false,
    cancelled: false,
    ...getDefaultMetaFieldValueMap(),
  };

  await db.insert('Customer', customer);
  await db.insert('SalesInvoice', invoice);

  await assertThrows(
    async () => await db.delete('Customer', customer.name as string),
    'foreign key should be enforced before migration'
  );

  const migratedSchemaMap = getBuiltTestSchemaMap();
  const customerSchema = migratedSchemaMap.Customer!;
  customerSchema.fields = customerSchema.fields.filter(
    (field) => field.fieldname !== 'email'
  );
  db.setSchemaMap(migratedSchemaMap);

  await assertDoesNotThrow(
    async () => await db.migrate(),
    'migration with a removed column should not fail'
  );

  const migratedCustomer = await db.get('Customer', customer.name as string);
  t.equal(migratedCustomer.name, 'John Whoe', 'customer row is preserved');
  t.equal(migratedCustomer.phone, '9999999999', 'customer data is preserved');
  t.notOk('email' in migratedCustomer, 'removed column is not returned');

  const columns = (await db.knex!.raw('PRAGMA table_info(Customer)')) as {
    name: string;
  }[];
  t.notOk(
    columns.some((column) => column.name === 'email'),
    'removed column is dropped'
  );

  const migratedInvoice = await db.get('SalesInvoice', invoice.name as string);
  t.equal(migratedInvoice.customer, 'John Whoe', 'dependent row is preserved');

  await assertThrows(
    async () => await db.delete('Customer', customer.name as string),
    'foreign key enforcement is restored after migration'
  );

  await db.close();
  t.end();
});

test('migration persists the CP1 itemWeightDigits default for an existing POS Settings single', async (t) => {
  const db = new DatabaseCore();
  await db.connect();

  const legacySchemaMap = getBuiltTestSchemaMap(false, true);
  const legacyPOSSettings = legacySchemaMap.POSSettings!;
  legacyPOSSettings.fields = legacyPOSSettings.fields.filter(
    (field) => field.fieldname !== 'itemWeightDigits'
  );
  db.setSchemaMap(legacySchemaMap);
  await db.migrate();

  const before = await db.get('POSSettings');
  t.notOk(
    Object.prototype.hasOwnProperty.call(before, 'itemWeightDigits'),
    'legacy single has no itemWeightDigits value'
  );

  db.setSchemaMap(getBuiltTestSchemaMap(false, true));
  await assertDoesNotThrow(
    async () => await db.migrate(),
    'adding the CP1 field to an existing single should not fail'
  );

  const after = await db.get('POSSettings');
  t.equal(
    Number(after.itemWeightDigits),
    0,
    'the schema default is persisted for the existing single'
  );

  await db.close();
  t.end();
});
