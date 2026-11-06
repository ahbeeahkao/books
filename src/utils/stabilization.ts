import type { Money } from 'pesa';

export const UTF8_BOM = '\uFEFF';

type MoneyMaker = (value: number) => Money;

export function stripUtf8Bom(text: string): string {
  return text.startsWith(UTF8_BOM) ? text.slice(UTF8_BOM.length) : text;
}

export function withExcelBom(csv: string): string {
  return UTF8_BOM + stripUtf8Bom(csv);
}

export function sanitizeFiniteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

export function getCurrencyFractionDigits(currency: string): number {
  try {
    const options = new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
    }).resolvedOptions();

    return options.maximumFractionDigits;
  } catch {
    return 2;
  }
}

export function isZeroDecimalCurrency(currency: string): boolean {
  return getCurrencyFractionDigits(currency) === 0;
}

export function getCurrencyDisplayPrecision(
  currency: string,
  configuredPrecision: number
): number {
  const digits = getCurrencyFractionDigits(currency);
  return Math.max(0, Math.min(configuredPrecision, digits));
}

export function truncateMoneyForCurrency(
  amount: Money,
  currency: string,
  moneyMaker: MoneyMaker
): Money {
  if (!isZeroDecimalCurrency(currency)) {
    return amount;
  }

  return moneyMaker(Math.trunc(amount.float));
}

export function clampMoney(value: Money, zero: Money, maximum: Money): Money {
  if (value.lt(zero)) {
    return zero;
  }

  const cap = maximum.abs();
  if (value.gt(cap)) {
    return cap;
  }

  return value;
}

export function getLineItemDiscountAmount(
  discount: Money,
  amount: Money,
  moneyMaker: MoneyMaker
): Money {
  return clampMoney(discount.abs(), moneyMaker(0), amount.abs());
}

export function getWriteOffLedgerAmounts(
  amount: Money,
  writeoff: Money,
  paymentType: 'Receive' | 'Pay'
) {
  const absoluteWriteOff = writeoff.abs();
  return {
    cash: amount,
    account: amount.add(absoluteWriteOff),
    writeOff: absoluteWriteOff,
    writeOffIsDebit: paymentType === 'Receive',
  };
}

export function normalizeTransactionDate(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const parsed = new Date(value);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function getFiscalDateParts(value: Date | string): {
  month: number;
  day: number;
} {
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) {
      return { month: Number(match[2]), day: Number(match[3]) };
    }
  }

  const date = value instanceof Date ? value : new Date(String(value));
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function getCanonicalImportFieldKey(
  schemaName: string,
  fieldname: string
): string {
  return `${schemaName}.${fieldname}`;
}
