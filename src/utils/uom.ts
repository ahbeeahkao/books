import type { Fyo } from 'fyo';
import { ValidationError } from 'fyo/utils/errors';
import { ModelNameEnum } from 'models/types';

export type UomDetails = {
  name?: string | null;
  isWhole?: boolean;
  mustBeWholeNumber?: boolean;
  must_be_whole_number?: boolean;
  conversionFactor?: number;
};

export type UomConversionRow = {
  uom?: unknown;
  conversionFactor?: unknown;
};

export type UomConversionValidationIssue =
  | { type: 'missing-uom'; index: number }
  | { type: 'duplicate'; index: number; uom: string }
  | {
      type: 'nonpositive';
      index: number;
      uom: string;
      conversionFactor: number;
    };

const LEGACY_WHOLE_UOMS = new Set([
  'unit',
  'nos',
  'piece',
  'pieces',
  'box',
  'boxes',
]);

export function asUomName(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

export function getUomName(unit?: UomDetails | string | null): string {
  if (typeof unit === 'string') {
    return unit.trim();
  }

  if (unit && typeof unit === 'object') {
    return asUomName(unit.name) ?? '';
  }

  return '';
}

export function getUomWholeNumberMapping(isWhole?: boolean): boolean {
  return !!isWhole;
}

export function getUomWholeNumberFlag(
  unit?: UomDetails | string | null
): boolean {
  if (typeof unit === 'string') {
    return LEGACY_WHOLE_UOMS.has(unit.trim().toLocaleLowerCase());
  }

  if (!unit || typeof unit !== 'object') {
    return false;
  }

  return !!(
    unit.isWhole ||
    unit.mustBeWholeNumber ||
    unit.must_be_whole_number
  );
}

function getPositiveNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

export function getUomConversionValidationIssue(
  rows: UomConversionRow[]
): UomConversionValidationIssue | undefined {
  const names: string[] = [];
  for (let index = 0; index < rows.length; index++) {
    const uom = asUomName(rows[index].uom);
    if (!uom) {
      return { type: 'missing-uom', index };
    }

    names.push(uom);
  }

  const seen = new Set<string>();
  for (let index = 0; index < names.length; index++) {
    const key = names[index].toLocaleLowerCase();
    if (seen.has(key)) {
      return { type: 'duplicate', index, uom: names[index] };
    }

    seen.add(key);
  }

  for (let index = 0; index < rows.length; index++) {
    const factor = getPositiveNumber(rows[index].conversionFactor);
    if (factor === undefined) {
      return {
        type: 'nonpositive',
        index,
        uom: names[index],
        conversionFactor: Number(rows[index].conversionFactor),
      };
    }
  }

  return undefined;
}

export function getUomConversionFactorMap(
  rows: UomConversionRow[]
): Record<string, number> {
  const factors: Record<string, number> = {};
  for (const row of rows) {
    const uom = asUomName(row.uom);
    const factor = getPositiveNumber(row.conversionFactor);
    if (!uom || factor === undefined) {
      continue;
    }

    factors[uom] = factor;
  }

  return factors;
}

export function getConfiguredUomFactor(
  conversionFactors: Record<string, number> | undefined,
  unitName: string
): number | undefined {
  const normalized = unitName.trim().toLocaleLowerCase();
  if (!normalized || !conversionFactors) {
    return undefined;
  }

  for (const [key, value] of Object.entries(conversionFactors)) {
    if (key.trim().toLocaleLowerCase() !== normalized) {
      continue;
    }

    return getPositiveNumber(value);
  }

  return undefined;
}

export function getLegacyWeightConversionFactor(unitName: string): number {
  const normalized = unitName.trim().toLocaleLowerCase();
  if (
    normalized === 'kg' ||
    normalized === 'kilogram' ||
    normalized === 'kilograms'
  ) {
    return 0.001;
  }

  return 1;
}

export function getUomWeightConversionFactor(
  unit?: UomDetails | string | null,
  conversionFactors?: Record<string, number>
): number {
  const unitName = getUomName(unit);
  const legacy = getLegacyWeightConversionFactor(unitName);
  const objectFactor =
    unit && typeof unit === 'object'
      ? getPositiveNumber(unit.conversionFactor)
      : undefined;
  const configuredFactor = getConfiguredUomFactor(conversionFactors, unitName);

  const explicitFactor = objectFactor ?? configuredFactor;
  if (explicitFactor !== undefined && explicitFactor !== 1) {
    return explicitFactor;
  }

  return legacy;
}

export function getWholeNumberQuantityError(
  quantity: unknown,
  unit?: UomDetails | string | null
): string | undefined {
  if (!getUomWholeNumberFlag(unit)) {
    return undefined;
  }

  const number = Number(quantity);
  if (!Number.isFinite(number)) {
    return undefined;
  }

  if (Math.abs(number - Math.round(number)) < 1e-9) {
    return undefined;
  }

  const unitName = getUomName(unit) || 'the selected UOM';
  return `Quantity must be a whole number for ${unitName}.`;
}

export function isUomConversionsEnabled(fyo: Fyo): boolean {
  return !!fyo.singles?.InventorySettings?.enableUomConversions;
}

export function getUomFieldConfig(fyo: Fyo): {
  hidden: boolean;
  required: boolean;
} {
  const enabled = isUomConversionsEnabled(fyo);
  return { hidden: !enabled, required: enabled };
}

export async function getUomDetailsForUnit(
  fyo: Fyo,
  unit?: UomDetails | string | null
): Promise<UomDetails | undefined> {
  const unitName = getUomName(unit);
  if (!unitName) {
    return undefined;
  }

  const legacy = getUomWholeNumberFlag(unitName);
  if (unit && typeof unit === 'object') {
    return {
      ...unit,
      name: unitName,
      isWhole: unit.isWhole ?? unit.mustBeWholeNumber ?? legacy,
      mustBeWholeNumber:
        unit.mustBeWholeNumber ??
        unit.isWhole ??
        unit.must_be_whole_number ??
        legacy,
    };
  }

  const isWhole = await fyo.getValue(ModelNameEnum.UOM, unitName, 'isWhole');
  const mustBeWholeNumber = await fyo.getValue(
    ModelNameEnum.UOM,
    unitName,
    'mustBeWholeNumber'
  );

  return {
    name: unitName,
    isWhole: !!isWhole || !!mustBeWholeNumber || legacy,
    mustBeWholeNumber: !!mustBeWholeNumber || !!isWhole || legacy,
  };
}

export async function getUomDetailsForItem(
  fyo: Fyo,
  itemName?: unknown
): Promise<UomDetails | undefined> {
  const name = asUomName(itemName);
  if (!name) {
    return undefined;
  }

  const unitName = asUomName(
    await fyo.getValue(ModelNameEnum.Item, name, 'unit')
  );
  if (!unitName) {
    return undefined;
  }

  return getUomDetailsForUnit(fyo, unitName);
}

export async function assertWholeNumberQuantity(
  fyo: Fyo,
  itemName: unknown,
  quantity: unknown
): Promise<void> {
  const unit = await getUomDetailsForItem(fyo, itemName);
  const message = getWholeNumberQuantityError(quantity, unit);
  if (!message) {
    return;
  }

  throw new ValidationError(fyo.t`${message}`);
}

export async function assertWholeNumberQuantityForUnit(
  fyo: Fyo,
  unit: UomDetails | string | null | undefined,
  quantity: unknown
): Promise<void> {
  const details = await getUomDetailsForUnit(fyo, unit);
  const message = getWholeNumberQuantityError(quantity, details);
  if (!message) {
    return;
  }

  throw new ValidationError(fyo.t`${message}`);
}
