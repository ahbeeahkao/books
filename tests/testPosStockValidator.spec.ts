import test from 'tape';
import type { ItemQtyMap } from 'src/components/POS/types';
import {
  BarcodeSettings,
  getWeightBarcodeQuantity,
  parseWeightBarcode,
} from 'src/utils/barcodes';
import {
  getAvailableQty,
  getInsufficientQuantityMessage,
  validateAddItemQty,
  validateInvoiceQty,
} from 'src/utils/posStock';

type Test = Parameters<Parameters<typeof test>[1]>[0];

const weightSettings: BarcodeSettings = {
  weightEnabledBarcode: true,
  checkDigits: 21,
  itemCodeDigits: 4,
  itemWeightDigits: 5,
};

const itemQtyMap: ItemQtyMap = {
  Apple: { availableQty: 10, B1: 4, B2: 6 },
  Empty: { availableQty: 0 },
};

function captureError(fn: () => void): string | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    return (error as Error).message;
  }
}

function expectError(
  t: Test,
  fn: () => void,
  pattern: RegExp,
  message: string
): void {
  const error = captureError(fn);
  if (!error) {
    t.fail(`${message}: expected an error`);
    return;
  }

  t.ok(pattern.test(error), `${message}: ${error}`);
}

function expectNoError(t: Test, fn: () => void, message: string): void {
  const error = captureError(fn);
  if (error) {
    t.fail(`${message}: unexpected error ${error}`);
    return;
  }

  t.pass(message);
}

test('getAvailableQty resolves total, batch and missing stock', (t) => {
  t.equal(getAvailableQty(itemQtyMap, 'Apple'), 10, 'total available quantity');
  t.equal(getAvailableQty(itemQtyMap, 'Apple', 'B1'), 4, 'batch B1 quantity');
  t.equal(getAvailableQty(itemQtyMap, 'Apple', 'B2'), 6, 'batch B2 quantity');
  t.equal(
    getAvailableQty(itemQtyMap, 'Apple', 'Missing'),
    0,
    'missing batch has zero quantity'
  );
  t.equal(
    getAvailableQty(itemQtyMap, 'Missing'),
    0,
    'missing item has zero quantity'
  );
  t.equal(
    getAvailableQty({ Apple: { availableQty: -3 } }, 'Apple'),
    0,
    'negative stock is clamped to zero'
  );
  t.end();
});

test('add-item validation rejects zero and over-quantity stock', (t) => {
  expectError(
    t,
    () =>
      validateAddItemQty(
        { Empty: itemQtyMap.Empty },
        { item: 'Empty' },
        1,
        [],
        { trackItem: true }
      ),
    /has only 0 quantities available\. you selected 1/,
    'zero stock is rejected'
  );

  const expected = getInsufficientQuantityMessage('Apple', 10, 11);
  const error = captureError(() =>
    validateAddItemQty(
      itemQtyMap,
      { item: 'Apple' },
      5,
      [{ item: 'Apple', quantity: 6 }],
      { trackItem: true }
    )
  );
  t.equal(
    error,
    expected,
    'adding to existing rows uses the canonical message'
  );

  expectNoError(
    t,
    () =>
      validateAddItemQty(
        itemQtyMap,
        { item: 'Apple' },
        4,
        [{ item: 'Apple', quantity: 6 }],
        { trackItem: true }
      ),
    'quantity equal to stock is accepted'
  );

  expectError(
    t,
    () =>
      validateAddItemQty(itemQtyMap, { item: 'Apple' }, 0, [], {
        trackItem: true,
      }),
    /Invalid Quantity for Item Apple/,
    'zero add quantity is rejected'
  );

  expectError(
    t,
    () =>
      validateAddItemQty(itemQtyMap, { item: 'Apple', hasBatch: true }, 1, [], {
        trackItem: true,
        hasBatch: true,
      }),
    /Please select a batch first/,
    'batch items require a batch'
  );
  t.end();
});

test('add-item validation respects batch-specific stock', (t) => {
  const expected = getInsufficientQuantityMessage('Apple', 4, 5, 'B1');
  const error = captureError(() =>
    validateAddItemQty(
      itemQtyMap,
      { item: 'Apple', batch: 'B1' },
      3,
      [{ item: 'Apple', batch: 'B1', quantity: 2 }],
      { trackItem: true, hasBatch: true }
    )
  );
  t.equal(error, expected, 'batch over-quantity uses the batch message');

  expectNoError(
    t,
    () =>
      validateAddItemQty(
        itemQtyMap,
        { item: 'Apple', batch: 'B1' },
        2,
        [{ item: 'Apple', batch: 'B1', quantity: 2 }],
        { trackItem: true, hasBatch: true }
      ),
    'batch quantity equal to stock is accepted'
  );

  expectNoError(
    t,
    () =>
      validateAddItemQty(itemQtyMap, { item: 'Apple', batch: 'B2' }, 6, [], {
        trackItem: true,
        hasBatch: true,
      }),
    'another batch uses its own stock balance'
  );
  t.end();
});

test('final invoice validation aggregates rows and uses the same message', (t) => {
  const expected = getInsufficientQuantityMessage('Apple', 10, 11);
  const error = captureError(() =>
    validateInvoiceQty(
      itemQtyMap,
      [
        { item: 'Apple', quantity: 7 },
        { item: 'Apple', quantity: 4 },
      ],
      false,
      { Apple: true }
    )
  );
  t.equal(error, expected, 'aggregated invoice rows use the canonical message');

  expectError(
    t,
    () =>
      validateInvoiceQty(
        itemQtyMap,
        [
          { item: 'Apple', batch: 'B1', quantity: 5 },
          { item: 'Apple', batch: 'B2', quantity: 6 },
        ],
        false,
        { Apple: true }
      ),
    /in batch B1\. you selected 5/,
    'batch-specific invoice quantities are respected'
  );

  expectNoError(
    t,
    () =>
      validateInvoiceQty(
        itemQtyMap,
        [
          { item: 'Apple', batch: 'B1', quantity: 4 },
          { item: 'Apple', batch: 'B2', quantity: 6 },
        ],
        false,
        { Apple: true }
      ),
    'valid split batch quantities are accepted'
  );

  expectError(
    t,
    () =>
      validateInvoiceQty(itemQtyMap, [{ item: 'Apple', quantity: 0 }], false, {
        Apple: true,
      }),
    /Invalid Quantity for Item Apple/,
    'invalid invoice quantity is rejected'
  );
  t.end();
});

test('returns, non-inventory items and free items bypass stock checks', (t) => {
  expectNoError(
    t,
    () =>
      validateInvoiceQty(itemQtyMap, [{ item: 'Apple', quantity: 99 }], true, {
        Apple: true,
      }),
    'return invoices bypass stock checks'
  );

  expectNoError(
    t,
    () =>
      validateInvoiceQty(
        itemQtyMap,
        [{ item: 'Service', quantity: 99 }],
        false,
        { Service: false }
      ),
    'non-inventory invoice items bypass stock checks'
  );

  expectNoError(
    t,
    () =>
      validateAddItemQty(
        { Empty: itemQtyMap.Empty },
        { item: 'Empty' },
        99,
        [],
        { trackItem: false }
      ),
    'non-inventory add-item bypasses stock checks'
  );

  expectNoError(
    t,
    () =>
      validateAddItemQty(
        { Empty: itemQtyMap.Empty },
        { item: 'Empty' },
        99,
        [],
        { trackItem: true, isReturn: true }
      ),
    'return add-item bypasses stock checks'
  );

  expectNoError(
    t,
    () =>
      validateInvoiceQty(
        itemQtyMap,
        [{ item: 'Empty', quantity: 99, isFreeItem: true }],
        false,
        { Empty: true }
      ),
    'free items are not stock-validated'
  );
  t.end();
});

test('weight-barcode quantities are validated as ordinary quantities', (t) => {
  const weight = parseWeightBarcode('21123412500', weightSettings)!;
  const scannedQty = getWeightBarcodeQuantity(weight, 'Kg');
  t.equal(scannedQty, 12.5, 'weight barcode resolves 12.5 Kg');

  expectError(
    t,
    () =>
      validateAddItemQty(
        { Apple: { availableQty: 10 } },
        { item: 'Apple' },
        scannedQty,
        [],
        { trackItem: true }
      ),
    /you selected 12\.5/,
    'over-quantity weight scan is rejected'
  );

  expectNoError(
    t,
    () =>
      validateAddItemQty(
        { Apple: { availableQty: 20 } },
        { item: 'Apple' },
        scannedQty,
        [],
        { trackItem: true }
      ),
    'in-stock weight scan is accepted'
  );
  t.end();
});
