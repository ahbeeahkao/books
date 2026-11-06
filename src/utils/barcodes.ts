import type { Fyo } from 'fyo';
import { ModelNameEnum } from 'models/types';
import {
  getConfiguredUomFactor,
  getUomConversionFactorMap,
  getUomWeightConversionFactor,
  getUomWholeNumberFlag,
} from 'src/utils/uom';
import type { UomDetails } from 'src/utils/uom';

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
  uomDetails?: Record<string, BarcodeUnit>;
  conversionFactors?: Record<string, number>;
};

export type BarcodeUnit = UomDetails;

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

interface UomDatabaseRow {
  name?: unknown;
  isWhole?: unknown;
  mustBeWholeNumber?: unknown;
  must_be_whole_number?: unknown;
}

interface UomConversionDatabaseRow {
  parent?: unknown;
  uom?: unknown;
  conversionFactor?: unknown;
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
  unit?: BarcodeUnit | string | null,
  conversionFactors?: Record<string, number>
): number {
  const factor = getUomWeightConversionFactor(unit, conversionFactors);
  const isWhole = getUomWholeNumberFlag(unit);

  let quantity = weight.weightValue * factor;
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

function getResolvedBarcodeUnit<T extends BarcodeItem>(
  item: T,
  unitName?: string | null
): BarcodeUnit | string | null {
  const name = asBarcodeString(unitName);
  if (!name) {
    return null;
  }

  const normalized = name.toLocaleLowerCase();
  let details: BarcodeUnit | undefined;
  for (const [key, value] of Object.entries(item.uomDetails ?? {})) {
    if (key.trim().toLocaleLowerCase() === normalized) {
      details = value;
      break;
    }
  }

  const factor = getConfiguredUomFactor(item.conversionFactors, name);
  if (!details && factor === undefined) {
    return name;
  }

  return {
    ...(details ?? {}),
    name,
    conversionFactor: details?.conversionFactor ?? factor,
  };
}

export function findScannedItem<T extends BarcodeItem>(
  items: T[],
  code: string,
  settings?: BarcodeSettings,
  unitOverride?: BarcodeUnit | string | null
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

  const override =
    unitOverride && typeof unitOverride === 'object'
      ? unitOverride
      : asBarcodeString(unitOverride);

  const unitName = override
    ? typeof override === 'string'
      ? override
      : override.name
    : match.barcode
    ? match.item.barcodeUnits?.[match.barcode] ?? match.item.unit
    : match.item.unit;

  const unit = override
    ? typeof override === 'string'
      ? getResolvedBarcodeUnit(match.item, override)
      : override
    : getResolvedBarcodeUnit(match.item, asBarcodeString(unitName));

  return {
    item: match.item,
    quantity: getWeightBarcodeQuantity(
      weight,
      unit,
      match.item.conversionFactors
    ),
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

async function getUomRows(fyo: Fyo): Promise<UomDatabaseRow[]> {
  if (!fyo.schemaMap?.[ModelNameEnum.UOM]) {
    return [];
  }

  try {
    return (await fyo.db.getAll(ModelNameEnum.UOM, {
      fields: ['name', 'isWhole'],
    })) as unknown as UomDatabaseRow[];
  } catch {
    return [];
  }
}

async function getUomConversionRows(
  fyo: Fyo
): Promise<UomConversionDatabaseRow[]> {
  if (!fyo.schemaMap?.[ModelNameEnum.UOMConversionItem]) {
    return [];
  }

  try {
    return (await fyo.db.getAll(ModelNameEnum.UOMConversionItem, {
      fields: ['parent', 'uom', 'conversionFactor'],
    })) as unknown as UomConversionDatabaseRow[];
  } catch {
    return [];
  }
}

export async function getBarcodeRows(fyo: Fyo): Promise<BarcodeItem[]> {
  const itemRows = (await fyo.db.getAll(ModelNameEnum.Item, {
    fields: ['name', 'barcode', 'itemCode', 'unit'],
  })) as unknown as BarcodeDatabaseRow[];

  const uomDetails = new Map<string, BarcodeUnit>();
  for (const row of await getUomRows(fyo)) {
    const name = asBarcodeString(row.name);
    if (!name) {
      continue;
    }

    const whole = getUomWholeNumberFlag({
      name,
      isWhole: row.isWhole as boolean | undefined,
      mustBeWholeNumber: row.mustBeWholeNumber as boolean | undefined,
      must_be_whole_number: row.must_be_whole_number as boolean | undefined,
    });
    uomDetails.set(name, {
      name,
      isWhole: whole,
      mustBeWholeNumber: whole,
    });
  }

  const conversionFactors = new Map<string, Record<string, number>>();
  for (const row of await getUomConversionRows(fyo)) {
    const parent = asBarcodeString(row.parent);
    if (!parent) {
      continue;
    }

    const factors = getUomConversionFactorMap([row]);
    if (!Object.keys(factors).length) {
      continue;
    }

    conversionFactors.set(parent, {
      ...(conversionFactors.get(parent) ?? {}),
      ...factors,
    });
  }

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
        uomDetails: Object.fromEntries(uomDetails),
        conversionFactors: conversionFactors.get(name),
      },
    ];
  });
}

export async function getScannedItem(
  fyo: Fyo,
  code: string,
  settings?: BarcodeSettings,
  unitOverride?: BarcodeUnit | string | null
): Promise<ScannedItem | undefined> {
  const barcodeSettings = settings ?? getBarcodeSettings(fyo);
  return findScannedItem(
    await getBarcodeRows(fyo),
    code,
    barcodeSettings,
    unitOverride
  );
}
