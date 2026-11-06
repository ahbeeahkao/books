import type { Fyo } from 'fyo';
import { ModelNameEnum } from 'models/types';

/**
 * Shared barcode scanning logic.
 *
 * The successor repo resolves a scan as: weight barcode → barcode → item
 * code/name. This module mirrors that order for the archived desktop app while
 * keeping the legacy single `Item.barcode` field working. It intentionally does
 * not add a second POS input or a new route.
 */

export type BarcodeSettings = {
  weightEnabledBarcode?: boolean;
  checkDigits?: number | string | null;
  itemCodeDigits?: number | string | null;
  itemWeightDigits?: number | string | null;
};

export type WeightBarcode = {
  checkDigits: string;
  itemCode: string;
  itemCodeDigits: number;
  itemWeightDigits: number;
  weightPart: string;
  weightValue: number;
};

export type BarcodeItem = {
  name: string;
  barcode?: string | null;
  itemCode?: string | null;
  unit?: string | null;
  barcodes: string[];
  barcodeUnits?: Record<string, string | null>;
};

export type BarcodeUnit = {
  name?: string | null;
  isWhole?: boolean;
  conversionFactor?: number;
};

export type ScannedItem<T extends BarcodeItem = BarcodeItem> = {
  item: T;
  quantity: number;
  isWeightBarcode: boolean;
};

export type ItemBarcodeRow = {
  name?: unknown;
  parent?: unknown;
  barcode?: unknown;
  barcodeType?: unknown;
  uom?: unknown;
};

export type ExistingItemBarcodeRow = {
  parent?: unknown;
  barcode?: unknown;
};

export type ItemBarcodeValidationIssue =
  | { type: 'missing' }
  | { type: 'within'; barcode: string }
  | { type: 'existing'; barcode: string; item: string };

interface BarcodeDatabaseRow {
  name?: unknown;
  barcode?: unknown;
  itemCode?: unknown;
  unit?: unknown;
}

interface BarcodeChildRow {
  parent?: unknown;
  barcode?: unknown;
  uom?: unknown;
}

export function asBarcodeString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

export function isBarcodeValue(value: string): boolean {
  return /^[A-Za-z0-9]+$/.test(value.trim());
}

function toPositiveInteger(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0;
}

export type WeightBarcodeField =
  | 'checkDigits'
  | 'itemCodeDigits'
  | 'itemWeightDigits';

export function getMissingWeightBarcodeFields(
  settings?: BarcodeSettings
): WeightBarcodeField[] {
  if (!settings?.weightEnabledBarcode) {
    return [];
  }

  const checkDigits = asBarcodeString(settings.checkDigits);
  const missing: WeightBarcodeField[] = [];
  if (!checkDigits || !/^\d+$/.test(checkDigits) || checkDigits === '0') {
    missing.push('checkDigits');
  }

  if (!toPositiveInteger(settings.itemCodeDigits)) {
    missing.push('itemCodeDigits');
  }

  if (!toPositiveInteger(settings.itemWeightDigits)) {
    missing.push('itemWeightDigits');
  }

  return missing;
}

export function getBarcodeSettings(fyo: Fyo): BarcodeSettings {
  const settings = fyo.singles.POSSettings;
  return {
    weightEnabledBarcode: !!settings?.weightEnabledBarcode,
    checkDigits: settings?.checkDigits ?? 0,
    itemCodeDigits: settings?.itemCodeDigits ?? 0,
    itemWeightDigits: settings?.itemWeightDigits ?? 0,
  };
}

export function parseWeightBarcode(
  code: string,
  settings?: BarcodeSettings
): WeightBarcode | undefined {
  const scannedCode = code.trim();
  if (!scannedCode || !settings?.weightEnabledBarcode) {
    return;
  }

  if (getMissingWeightBarcodeFields(settings).length) {
    return;
  }

  const itemCodeDigits = toPositiveInteger(settings.itemCodeDigits);
  const itemWeightDigits = toPositiveInteger(settings.itemWeightDigits);
  const checkDigits = asBarcodeString(settings.checkDigits) ?? '';
  const itemCodeStart = checkDigits.length;
  const itemCodeEnd = itemCodeStart + itemCodeDigits;
  const expectedLength = itemCodeEnd + itemWeightDigits;

  if (
    scannedCode.length !== expectedLength ||
    !scannedCode.startsWith(checkDigits)
  ) {
    return;
  }

  const itemCode = scannedCode.slice(itemCodeStart, itemCodeEnd);
  const weightPart = scannedCode.slice(itemCodeEnd);
  if (!/^\d+$/.test(weightPart)) {
    return;
  }

  const weightValue = parseInt(weightPart, 10);
  if (!Number.isFinite(weightValue)) {
    return;
  }

  return {
    checkDigits,
    itemCode,
    itemCodeDigits,
    itemWeightDigits,
    weightPart,
    weightValue,
  };
}

export function getWeightBarcodeQuantity(
  weight: WeightBarcode,
  unit?: BarcodeUnit | string | null
): number {
  const unitName = typeof unit === 'string' ? unit : unit?.name ?? '';
  const normalizedUnit = unitName.trim().toLocaleLowerCase();
  const isWhole =
    typeof unit === 'object' && unit !== null ? !!unit.isWhole : false;

  let quantity = weight.weightValue;
  if (normalizedUnit === 'kg') {
    quantity /= 1000;
  }

  if (isWhole) {
    quantity = Math.round(quantity);
  }

  return quantity > 0 ? quantity : 0;
}

export function getItemBarcodeValidationIssue(
  rows: ItemBarcodeRow[],
  existingRows: ExistingItemBarcodeRow[] = [],
  currentItemName?: unknown
): ItemBarcodeValidationIssue | undefined {
  const currentName = asBarcodeString(currentItemName);
  const seen = new Set<string>();

  for (const row of rows) {
    const barcode = asBarcodeString(row.barcode);
    if (!barcode) {
      return { type: 'missing' };
    }

    const key = barcode.toLocaleLowerCase();
    if (seen.has(key)) {
      return { type: 'within', barcode };
    }

    seen.add(key);
  }

  for (const row of existingRows) {
    const barcode = asBarcodeString(row.barcode);
    const parent = asBarcodeString(row.parent);
    if (!barcode || parent === currentName) {
      continue;
    }

    if (seen.has(barcode.toLocaleLowerCase())) {
      return { type: 'existing', barcode, item: parent ?? '' };
    }
  }

  return undefined;
}

type BarcodeMatch<T extends BarcodeItem> = { item: T; barcode?: string };

function findByChildBarcodes<T extends BarcodeItem>(
  items: T[],
  code: string
): BarcodeMatch<T> | undefined {
  for (const item of items) {
    if ((item.barcodes ?? []).includes(code)) {
      return { item, barcode: code };
    }
  }

  return undefined;
}

function findByLegacyBarcode<T extends BarcodeItem>(
  items: T[],
  code: string
): BarcodeMatch<T> | undefined {
  const item = items.find((candidate) => candidate.barcode === code);
  return item ? { item } : undefined;
}

function findByItemCode<T extends BarcodeItem>(
  items: T[],
  code: string
): BarcodeMatch<T> | undefined {
  const item = items.find((candidate) => candidate.itemCode === code);
  return item ? { item } : undefined;
}

function findByName<T extends BarcodeItem>(
  items: T[],
  code: string
): BarcodeMatch<T> | undefined {
  const item = items.find((candidate) => candidate.name === code);
  return item ? { item } : undefined;
}

function findByNormalScan<T extends BarcodeItem>(
  items: T[],
  code: string
): BarcodeMatch<T> | undefined {
  return (
    findByChildBarcodes(items, code) ??
    findByLegacyBarcode(items, code) ??
    findByItemCode(items, code) ??
    findByName(items, code)
  );
}

function findByWeightItemCode<T extends BarcodeItem>(
  items: T[],
  code: string
): BarcodeMatch<T> | undefined {
  return (
    findByItemCode(items, code) ??
    findByName(items, code) ??
    findByLegacyBarcode(items, code) ??
    findByChildBarcodes(items, code)
  );
}

export function findScannedItem<T extends BarcodeItem>(
  items: T[],
  code: string,
  settings?: BarcodeSettings
): ScannedItem<T> | undefined {
  const scannedCode = code.trim();
  if (!scannedCode) {
    return;
  }

  const weight = parseWeightBarcode(scannedCode, settings);
  const match = weight
    ? findByChildBarcodes(items, scannedCode) ??
      findByLegacyBarcode(items, scannedCode) ??
      findByWeightItemCode(items, weight.itemCode)
    : findByNormalScan(items, scannedCode);

  if (!match) {
    return;
  }

  if (!weight) {
    return { item: match.item, quantity: 1, isWeightBarcode: false };
  }

  const unit = match.barcode
    ? match.item.barcodeUnits?.[match.barcode] ?? match.item.unit
    : match.item.unit;

  return {
    item: match.item,
    quantity: getWeightBarcodeQuantity(weight, unit),
    isWeightBarcode: true,
  };
}

async function getChildBarcodeRows(fyo: Fyo): Promise<BarcodeChildRow[]> {
  if (!fyo.schemaMap?.[ModelNameEnum.ItemBarcode]) {
    return [];
  }

  try {
    return (await fyo.db.getAll(ModelNameEnum.ItemBarcode, {
      fields: ['parent', 'barcode', 'uom'],
    })) as unknown as BarcodeChildRow[];
  } catch {
    return [];
  }
}

export async function getBarcodeRows(fyo: Fyo): Promise<BarcodeItem[]> {
  const itemRows = (await fyo.db.getAll(ModelNameEnum.Item, {
    fields: ['name', 'barcode', 'itemCode', 'unit'],
  })) as unknown as BarcodeDatabaseRow[];

  const childBarcodes = new Map<string, string[]>();
  const barcodeUnits = new Map<string, Record<string, string | null>>();
  for (const row of await getChildBarcodeRows(fyo)) {
    const parent = asBarcodeString(row.parent);
    const barcode = asBarcodeString(row.barcode);
    if (!parent || !barcode) {
      continue;
    }

    const barcodes = childBarcodes.get(parent) ?? [];
    if (!barcodes.includes(barcode)) {
      barcodes.push(barcode);
    }
    childBarcodes.set(parent, barcodes);

    const units = barcodeUnits.get(parent) ?? {};
    units[barcode] = asBarcodeString(row.uom);
    barcodeUnits.set(parent, units);
  }

  return itemRows.flatMap((row) => {
    const name = asBarcodeString(row.name);
    if (!name) {
      return [];
    }

    return [
      {
        name,
        barcode: asBarcodeString(row.barcode),
        itemCode: asBarcodeString(row.itemCode),
        unit: asBarcodeString(row.unit),
        barcodes: [...(childBarcodes.get(name) ?? [])],
        barcodeUnits: barcodeUnits.get(name),
      },
    ];
  });
}

export async function getScannedItem(
  fyo: Fyo,
  code: string,
  settings?: BarcodeSettings
): Promise<ScannedItem | undefined> {
  const barcodeSettings = settings ?? getBarcodeSettings(fyo);
  return findScannedItem(await getBarcodeRows(fyo), code, barcodeSettings);
}
