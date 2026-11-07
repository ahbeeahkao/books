import { getMoneyMaker } from 'pesa';
import test from 'tape';
import { generateCSV, parseCSV } from 'utils/csvParser';
import {
  clampMoney,
  getCanonicalImportFieldKey,
  getCurrencyDisplayPrecision,
  getFiscalDateParts,
  getLineItemDiscountAmount,
  getWriteOffLedgerAmounts,
  isZeroDecimalCurrency,
  normalizeTransactionDate,
  truncateMoneyForCurrency,
  withExcelBom,
} from 'src/utils/stabilization';

const pesa = getMoneyMaker({ currency: 'USD', precision: 11, display: 2 });

test('stabilization: UTF-8 BOM export is accepted by the CSV parser', (t) => {
  const csv = withExcelBom(generateCSV([['Name'], ['张三']]));
  t.equal(csv.charCodeAt(0), 0xfeff, 'CSV export starts with Excel BOM');
  t.deepEqual(
    parseCSV(csv),
    [['Name'], ['张三']],
    'BOM is stripped before header parsing'
  );
  t.equal(csv.charCodeAt(1), 'N'.charCodeAt(0), 'only one BOM is prepended');
  t.end();
});

test('stabilization: canonical import keys match export keys', (t) => {
  t.equal(
    getCanonicalImportFieldKey('SalesInvoice', 'party'),
    'SalesInvoice.party'
  );
  t.equal(
    getCanonicalImportFieldKey('SalesInvoiceItem', 'item'),
    'SalesInvoiceItem.item'
  );
  t.end();
});

test('stabilization: zero-decimal currencies use whole-unit display/truncation', (t) => {
  t.ok(isZeroDecimalCurrency('JPY'), 'JPY has no minor unit');
  t.notOk(isZeroDecimalCurrency('USD'), 'USD has a minor unit');
  t.equal(getCurrencyDisplayPrecision('JPY', 2), 0);
  t.equal(getCurrencyDisplayPrecision('USD', 2), 2);
  t.equal(
    truncateMoneyForCurrency(pesa(123.99), 'JPY', pesa).float,
    123,
    'fractional JPY tax is truncated, not rounded up'
  );
  t.equal(
    truncateMoneyForCurrency(pesa(123.99), 'USD', pesa).float,
    123.99,
    'decimal currencies keep fractional precision'
  );
  t.end();
});

test('stabilization: line discount is clamped to the line amount', (t) => {
  t.equal(
    getLineItemDiscountAmount(pesa(6800), pesa(9.5), pesa).float,
    9.5,
    'excess discount cannot make the line amount negative'
  );
  t.equal(
    getLineItemDiscountAmount(pesa(-3), pesa(100), pesa).float,
    3,
    'negative discount is normalized'
  );
  t.equal(clampMoney(pesa(-1), pesa(0), pesa(100)).float, 0);
  t.end();
});

test('stabilization: write-off postings settle the full receivable/payable', (t) => {
  const receive = getWriteOffLedgerAmounts(pesa(155), pesa(2.5), 'Receive');
  t.equal(receive.cash.float, 155, 'cash received is unchanged');
  t.equal(
    receive.account.float,
    157.5,
    'debtor is credited by cash plus write-off'
  );
  t.equal(receive.writeOff.float, 2.5);
  t.ok(receive.writeOffIsDebit, 'receive write-off is a debit');

  const pay = getWriteOffLedgerAmounts(pesa(155), pesa(2.5), 'Pay');
  t.equal(
    pay.account.float,
    157.5,
    'creditor is debited by cash plus write-off'
  );
  t.notOk(pay.writeOffIsDebit, 'pay write-off is a credit');
  t.end();
});

test('stabilization: transaction dates are normalized without UTC day drift', (t) => {
  const fromString = normalizeTransactionDate('2024-01-01T23:30:00.000Z');
  t.equal(fromString.getFullYear(), 2024);
  t.equal(fromString.getMonth(), 0);
  t.equal(fromString.getDate(), 1);
  t.equal(fromString.getHours(), 0);

  const fromDate = normalizeTransactionDate(new Date(2023, 11, 31, 18, 45));
  t.equal(fromDate.getFullYear(), 2023);
  t.equal(fromDate.getMonth(), 11);
  t.equal(fromDate.getDate(), 31);
  t.equal(fromDate.getHours(), 0);
  t.end();
});

test('stabilization: fiscal endpoints use stored UTC date parts', (t) => {
  t.deepEqual(getFiscalDateParts(new Date('2025-04-01T00:00:00.000Z')), {
    month: 4,
    day: 1,
  });
  t.deepEqual(getFiscalDateParts('2026-03-31T00:00:00.000Z'), {
    month: 3,
    day: 31,
  });
  t.end();
});
