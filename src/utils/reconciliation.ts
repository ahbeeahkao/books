import { normalizeTransactionDate } from './stabilization';

/**
 * Helpers for the later-phase synthetic reconciliation fixtures.
 *
 * These functions operate on small, deterministic datasets generated from
 * documented issue steps. They are not a replacement for real customer CSVs,
 * ledger exports, or packaged database samples.
 */

export type ReconciliationEntry = {
  date?: Date | string | null;
  debit?: number | null;
  credit?: number | null;
};

export type LedgerReconciliation<T> = {
  opening: number;
  transactions: number;
  closing: number;
  openingEntries: T[];
  rangeEntries: T[];
};

export function getNetLedgerMovement<T extends ReconciliationEntry>(
  entries: T[]
): number {
  return entries.reduce((total, entry) => {
    return total + (entry.debit ?? 0) - (entry.credit ?? 0);
  }, 0);
}

export function getLedgerReconciliation<T extends ReconciliationEntry>(
  entries: T[],
  fromDate?: string | Date,
  toDate?: string | Date
): LedgerReconciliation<T> {
  const from = fromDate
    ? normalizeTransactionDate(fromDate).valueOf()
    : -Infinity;
  const to = toDate ? normalizeTransactionDate(toDate).valueOf() : Infinity;
  const openingEntries: T[] = [];
  const rangeEntries: T[] = [];

  for (const entry of entries) {
    const entryDate = entry.date
      ? normalizeTransactionDate(entry.date).valueOf()
      : 0;

    if (entryDate < from) {
      openingEntries.push(entry);
    } else if (entryDate <= to) {
      rangeEntries.push(entry);
    }
  }

  const opening = getNetLedgerMovement(openingEntries);
  const transactions = getNetLedgerMovement(rangeEntries);
  return {
    opening,
    transactions,
    closing: opening + transactions,
    openingEntries,
    rangeEntries,
  };
}

export function getOpeningBalanceByGroup<T extends ReconciliationEntry>(
  entries: T[],
  groupBy: string,
  allKey = 'all'
): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const entry of entries) {
    const key =
      groupBy === 'all'
        ? allKey
        : String(
            (entry as unknown as Record<string, unknown>)[groupBy] ?? allKey
          );
    const movement = (entry.debit ?? 0) - (entry.credit ?? 0);
    balances[key] = (balances[key] ?? 0) + movement;
  }

  return balances;
}

export function isRootAccountRecreatable(options: {
  setupComplete: boolean;
  rootType?: string;
  isGroup: boolean;
  parentAccount?: string | null;
}): boolean {
  return (
    options.setupComplete &&
    options.isGroup &&
    !!options.rootType &&
    !options.parentAccount
  );
}

export type PricingRuleItemCandidate = {
  name: string;
  for?: string;
  disabled?: boolean;
};

export function getPricingRuleItemCandidates<
  T extends PricingRuleItemCandidate
>(items: T[], direction: 'Sales' | 'Purchase' = 'Sales'): string[] {
  return items
    .filter((item) => {
      if (item.disabled) {
        return false;
      }

      return !item.for || item.for === 'Both' || item.for === direction;
    })
    .map((item) => item.name);
}
