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

interface BarcodeDatabaseRow {
  name?: unknown;
  barcode?: unknown;
  itemCode?: unknown;
  unit?: unknown;
}

interface BarcodeChildRow {
  parent?: unknown;
  barcode?: unknown;
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

function getBarcodes(item: BarcodeItem): string[] {
  if (item.barcodes.length) {
    return item.barcodes;
  }

  return item.barcode ? [item.barcode] : [];
}

function itemMatchesCode(item: BarcodeItem, code: string): boolean {
  if (item.name === code || item.itemCode === code) {
    return true;
  }

  return getBarcodes(item).includes(code);
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
  const lookupCode = weight?.itemCode ?? scannedCode;
  const item =
    items.find((candidate) => itemMatchesCode(candidate, lookupCode)) ??
    items.find((candidate) => itemMatchesCode(candidate, scannedCode));

  if (!item) {
    return;
  }

  if (!weight) {
    return { item, quantity: 1, isWeightBarcode: false };
  }

  return {
    item,
    quantity: getWeightBarcodeQuantity(weight, {
      name: item.unit ?? undefined,
    }),
    isWeightBarcode: true,
  };
}

async function getChildBarcodeRows(fyo: Fyo): Promise<BarcodeChildRow[]> {
  if (!fyo.schemaMap?.['ItemBarcode']) {
    return [];
  }

  try {
    return (await fyo.db.getAll('ItemBarcode', {
      fields: ['parent', 'barcode'],
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
  }

  return itemRows.flatMap((row) => {
    const name = asBarcodeString(row.name);
    if (!name) {
      return [];
    }

    const legacyBarcode = asBarcodeString(row.barcode);
    const barcodes: string[] = [];
    if (legacyBarcode && !barcodes.includes(legacyBarcode)) {
      barcodes.push(legacyBarcode);
    }

    for (const barcode of childBarcodes.get(name) ?? []) {
      if (!barcodes.includes(barcode)) {
        barcodes.push(barcode);
      }
    }

    return [
      {
        name,
        barcode: legacyBarcode,
        itemCode: asBarcodeString(row.itemCode),
        unit: asBarcodeString(row.unit),
        barcodes,
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
