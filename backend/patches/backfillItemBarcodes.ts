import { getDefaultMetaFieldValueMap } from 'backend/helpers';
import { ModelNameEnum } from 'models/types';
import { getRandomString } from 'utils';
import { DatabaseManager } from '../database/manager';
import { FieldValueMap } from '../database/types';

/**
 * CP2 introduces the ItemBarcode child table. Existing databases keep their
 * legacy Item.barcode column; this post-migration patch creates one child row
 * per non-empty legacy barcode. The schema default supplies `Custom` as the
 * barcode type and a per-barcode UOM hint is copied when its UOM still exists.
 */
async function execute(dm: DatabaseManager) {
  const db = dm.db;
  if (!db?.knex || !db.schemaMap[ModelNameEnum.ItemBarcode]) {
    return;
  }

  if (!(await db.knex.schema.hasTable(ModelNameEnum.ItemBarcode))) {
    return;
  }

  const items = await db.getAll(ModelNameEnum.Item, {
    fields: ['name', 'barcode', 'unit'],
  });
  const existing = await db.getAll(ModelNameEnum.ItemBarcode, {
    fields: ['name', 'parent', 'barcode'],
  });

  const existingKeys = new Set<string>();
  const existingBarcodes = new Set<string>();
  for (const row of existing) {
    const parent = asString(row.parent);
    const barcode = asString(row.barcode);
    if (barcode) {
      existingBarcodes.add(barcode.toLocaleLowerCase());
    }

    if (parent && barcode) {
      existingKeys.add(`${parent}::${barcode.toLocaleLowerCase()}`);
    }
  }

  const defaults = getDefaultMetaFieldValueMap();
  let idx = 0;
  for (const item of items) {
    const parent = asString(item.name);
    const barcode = asString(item.barcode);
    if (!parent || !barcode) {
      continue;
    }

    const normalizedBarcode = barcode.toLocaleLowerCase();
    const key = `${parent}::${normalizedBarcode}`;
    if (existingKeys.has(key) || existingBarcodes.has(normalizedBarcode)) {
      continue;
    }

    const uom = await getExistingUom(db, item.unit);
    const row: FieldValueMap = {
      name: getRandomString(),
      parent,
      parentSchemaName: ModelNameEnum.Item,
      parentFieldname: 'barcodes',
      idx: idx++,
      barcode,
      barcodeType: 'Custom',
      uom,
      ...defaults,
    };

    await db.insert(ModelNameEnum.ItemBarcode, row);
    existingKeys.add(key);
    existingBarcodes.add(normalizedBarcode);
  }
}

async function getExistingUom(
  db: NonNullable<DatabaseManager['db']>,
  value: FieldValueMap[string]
): Promise<string | undefined> {
  const uom = asString(value);
  if (!uom) {
    return undefined;
  }

  try {
    return (await db.exists(ModelNameEnum.UOM, uom)) ? uom : undefined;
  } catch {
    return undefined;
  }
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.trim() || undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
}

export default { execute };
