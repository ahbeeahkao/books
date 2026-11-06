import { t } from 'fyo';
import { ValidationError } from 'fyo/utils/errors';
import type { ItemQtyMap } from 'src/components/POS/types';

/**
 * Shared POS stock validation.
 *
 * The validator is deliberately pure: callers supply the location-aware
 * `ItemQtyMap` produced by `getItemQtyMap()` and the item flags they already
 * know. Scan/search, add-item, keyboard quantity edits, and final invoice
 * validation all use the same messages and the same over-quantity rule.
 */

export type StockItemLike = {
  name?: unknown;
  item?: unknown;
  batch?: unknown;
  hasBatch?: unknown;
  quantity?: unknown;
  isFreeItem?: unknown;
};

export type StockValidationOptions = {
  trackItem?: boolean;
  hasBatch?: boolean;
  isReturn?: boolean;
};

type StockTotal = {
  itemName: string;
  batch?: string;
  requestedQty: number;
};

function asStockString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

function toQuantity(value: unknown): number {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? quantity : 0;
}

export function getStockItemName(item?: StockItemLike | null): string {
  if (!item) {
    return '';
  }

  return asStockString(item.item) ?? asStockString(item.name) ?? '';
}

export function getStockItemBatch(
  item?: StockItemLike | null
): string | undefined {
  return asStockString(item?.batch) ?? undefined;
}

export function getAvailableQty(
  itemQtyMap: ItemQtyMap,
  itemName: string,
  batch?: string
): number {
  const entry = itemQtyMap[itemName];
  if (!entry) {
    return 0;
  }

  const value = batch ? entry[batch] : entry.availableQty;
  const availableQty = Number(value);
  return Number.isFinite(availableQty) && availableQty > 0 ? availableQty : 0;
}

export function getInvalidQuantityMessage(itemName: string): string {
  return t`Invalid Quantity for Item ${itemName}`;
}

export function getInsufficientQuantityMessage(
  itemName: string,
  availableQty: number,
  requestedQty: number,
  batch?: string
): string {
  if (batch) {
    return t`Insufficient Quantity. Item ${itemName} has only ${availableQty} quantities available in batch ${batch}. you selected ${requestedQty}`;
  }

  return t`Insufficient Quantity. Item ${itemName} has only ${availableQty} quantities available. you selected ${requestedQty}`;
}

function sumExistingQuantity<T extends StockItemLike>(
  existingItems: T[],
  itemName: string,
  batch?: string
): number {
  let total = 0;
  for (const row of existingItems) {
    if (row.isFreeItem || getStockItemName(row) !== itemName) {
      continue;
    }

    const rowBatch = getStockItemBatch(row);
    if (batch && rowBatch !== batch) {
      continue;
    }

    total += toQuantity(row.quantity);
  }

  return total;
}

export function assertSufficientQuantity(
  itemQtyMap: ItemQtyMap,
  itemName: string,
  batch: string | undefined,
  requestedQty: number,
  options: StockValidationOptions = {}
): void {
  if (options.isReturn || options.trackItem === false || !itemName) {
    return;
  }

  if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
    return;
  }

  const availableQty = getAvailableQty(itemQtyMap, itemName, batch);
  if (requestedQty <= availableQty) {
    return;
  }

  throw new ValidationError(
    getInsufficientQuantityMessage(itemName, availableQty, requestedQty, batch)
  );
}

export function validateAddItemQty<T extends StockItemLike>(
  itemQtyMap: ItemQtyMap,
  item: StockItemLike | null | undefined,
  quantity: unknown,
  existingItems: T[] = [],
  options: StockValidationOptions = {}
): void {
  if (!item) {
    return;
  }

  const itemName = getStockItemName(item);
  if (!itemName) {
    return;
  }

  const batch = getStockItemBatch(item);
  if (options.hasBatch && !batch) {
    throw new ValidationError(t`Please select a batch first`);
  }

  if (options.isReturn || options.trackItem === false) {
    return;
  }

  const addQty = toQuantity(quantity);
  if (addQty <= 0) {
    throw new ValidationError(getInvalidQuantityMessage(itemName));
  }

  const requestedQty =
    addQty + sumExistingQuantity(existingItems, itemName, batch);
  assertSufficientQuantity(itemQtyMap, itemName, batch, requestedQty, options);
}

export function validateInvoiceQty<T extends StockItemLike>(
  itemQtyMap: ItemQtyMap,
  items: T[],
  isReturn = false,
  trackItemMap: Record<string, boolean> = {}
): void {
  if (isReturn) {
    return;
  }

  const totals = new Map<string, StockTotal>();
  for (const item of items) {
    if (item.isFreeItem) {
      continue;
    }

    const itemName = getStockItemName(item);
    if (!itemName || trackItemMap[itemName] === false) {
      continue;
    }

    const quantity = toQuantity(item.quantity);
    if (quantity <= 0) {
      throw new ValidationError(getInvalidQuantityMessage(itemName));
    }

    const batch = getStockItemBatch(item);
    const key = `${itemName}\u0000${batch ?? ''}`;
    const total = totals.get(key) ?? { itemName, batch, requestedQty: 0 };
    total.requestedQty += quantity;
    totals.set(key, total);
  }

  for (const total of totals.values()) {
    assertSufficientQuantity(
      itemQtyMap,
      total.itemName,
      total.batch,
      total.requestedQty,
      { trackItem: true }
    );
  }
}
