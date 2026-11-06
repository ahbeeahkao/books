import fs from 'fs';
import os from 'os';
import path from 'path';
import test from 'tape';
import { getDefaultMetaFieldValueMap } from '../../helpers';
import patches from '../../patches';
import backfillItemBarcodes from '../../patches/backfillItemBarcodes';
import { getRandomString } from 'utils';
import { Version } from 'utils/version';
import DatabaseCore from '../core';
import { DatabaseManager } from '../manager';
import { getBuiltTestSchemaMap } from './helpers';

test('CP2 backfill patch is versioned above 0.37.0', (t) => {
  const patch = patches.find((p) => p.name === 'backfillItemBarcodes');
  t.ok(patch, 'backfill patch is registered');
  t.ok(
    Version.gt(patch!.version, '0.37.0'),
    'patch version is above the current app version'
  );
  t.ok(
    Version.lte('0.37.0', patch!.version),
    'existing 0.37.0 databases select the patch'
  );
  t.notOk(
    patch!.patch.beforeMigrate,
    'backfill runs after the child table is created'
  );
  t.end();
});

test('CP2 migration creates ItemBarcode and backfills legacy barcodes', async (t) => {
  const db = new DatabaseCore();
  await db.connect();
  db.setSchemaMap(getBuiltTestSchemaMap(false, false, true));
  await db.migrate();

  const columns = (await db.knex!.raw('PRAGMA table_info(ItemBarcode)')) as {
    name: string;
  }[];
  t.ok(
    columns.some((column) => column.name === 'barcode'),
    'ItemBarcode table has the barcode column'
  );
  t.ok(
    columns.some((column) => column.name === 'parent'),
    'ItemBarcode table has the child parent column'
  );

  const defaults = getDefaultMetaFieldValueMap();
  await db.insert('UOM', { name: 'Unit', ...defaults });
  await db.insert('Item', {
    name: 'Apple',
    barcode: 'ABC123',
    unit: 'Unit',
    ...defaults,
  });
  await db.insert('Item', { name: 'No Barcode', ...defaults });

  await backfillItemBarcodes.execute({ db } as unknown as DatabaseManager);
  const rows = await db.getAll('ItemBarcode', {
    fields: [
      'name',
      'parent',
      'parentSchemaName',
      'parentFieldname',
      'idx',
      'barcode',
      'barcodeType',
      'uom',
    ],
  });

  t.equal(rows.length, 1, 'one child row is created for the legacy barcode');
  t.equal(rows[0]?.parent, 'Apple', 'child row is linked to the item');
  t.equal(rows[0]?.parentSchemaName, 'Item', 'parent schema is recorded');
  t.equal(rows[0]?.parentFieldname, 'barcodes', 'parent field is recorded');
  t.equal(rows[0]?.barcode, 'ABC123', 'legacy barcode is backfilled');
  t.equal(rows[0]?.barcodeType, 'Custom', 'schema default type is used');
  t.equal(rows[0]?.uom, 'Unit', 'item unit is copied as a UOM hint');
  t.equal(rows[0]?.idx, 0, 'child row index is set');

  const apple = await db.get('Item', 'Apple');
  t.equal(apple.barcode, 'ABC123', 'legacy Item.barcode data is preserved');

  await backfillItemBarcodes.execute({ db } as unknown as DatabaseManager);
  const rowsAfter = await db.getAll('ItemBarcode', { fields: ['name'] });
  t.equal(rowsAfter.length, 1, 'backfill patch is idempotent');

  await db.close();
  t.end();
});

test('DatabaseManager runs the CP2 backfill patch and records PatchRun', async (t) => {
  const dbPath = path.join(
    os.tmpdir(),
    `cp2-item-barcodes-${getRandomString()}.db`
  );
  const dm = new DatabaseManager();

  try {
    await dm.createNewDatabase(dbPath, '-');
    const patchRuns = (await dm.db!.knex!('PatchRun')
      .where({ name: 'backfillItemBarcodes' })
      .select()) as { failed?: boolean }[];

    t.equal(patchRuns.length, 1, 'backfill patch is recorded in PatchRun');
    t.notOk(patchRuns[0]?.failed, 'backfill patch completes without failure');
    t.ok(
      await dm.db!.knex!.schema.hasTable('ItemBarcode'),
      'ItemBarcode table is created through DatabaseManager migration'
    );
  } finally {
    await dm.db?.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  }

  t.end();
});
