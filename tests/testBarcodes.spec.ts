import type { Fyo } from 'fyo';
import {
  BarcodeItem,
  BarcodeSettings,
  findScannedItem,
  getBarcodeRows,
  getBarcodeSettings,
  getItemBarcodeValidationIssue,
  getMissingWeightBarcodeFields,
  getScannedItem,
  getWeightBarcodeQuantity,
  isBarcodeValue,
  parseWeightBarcode,
} from 'src/utils/barcodes';
import test from 'tape';

const weightSettings: BarcodeSettings = {
  weightEnabledBarcode: true,
  checkDigits: 21,
  itemCodeDigits: 4,
  itemWeightDigits: 5,
};

const items: BarcodeItem[] = [
  {
    name: 'Apple',
    barcode: 'ABC123',
    itemCode: '1234',
    unit: 'Kg',
    barcodes: ['ABC123', 'EANAPPLE'],
  },
  {
    name: 'Banana',
    barcode: '999999999999',
    itemCode: '5678',
    unit: 'Unit',
    barcodes: [],
  },
];

function makeFyo(
  settings: BarcodeSettings,
  rows: Record<string, unknown>[],
  childRows: Record<string, unknown>[] = [],
  includeItemBarcode = childRows.length > 0
): Fyo {
  return {
    singles: { POSSettings: settings },
    schemaMap: includeItemBarcode ? { ItemBarcode: {} } : {},
    db: {
      getAll: async (schemaName: string) => {
        if (schemaName === 'Item') {
          return rows;
        }

        if (schemaName === 'ItemBarcode') {
          return childRows;
        }

        return [];
      },
    },
  } as unknown as Fyo;
}

test('barcode values accept arbitrary alphanumeric lengths', (t) => {
  t.ok(isBarcodeValue('ABC123'), 'short alphanumeric barcode is valid');
  t.ok(isBarcodeValue('999999999999'), 'legacy 12-digit barcode is valid');
  t.notOk(isBarcodeValue('ABC-123'), 'punctuation is rejected');
  t.notOk(isBarcodeValue(''), 'empty value is rejected');
  t.end();
});

test('weight barcode parsing uses configured digit lengths', (t) => {
  const weight = parseWeightBarcode('21123412500', weightSettings);
  t.deepEqual(
    weight,
    {
      checkDigits: '21',
      itemCode: '1234',
      itemCodeDigits: 4,
      itemWeightDigits: 5,
      weightPart: '12500',
      weightValue: 12500,
    },
    'prefix, item code and weight are split'
  );

  t.equal(
    parseWeightBarcode('21123412500', {
      ...weightSettings,
      weightEnabledBarcode: false,
    }),
    undefined,
    'disabled weight barcodes are not parsed'
  );
  t.equal(
    parseWeightBarcode('2112341250', weightSettings),
    undefined,
    'invalid length is not parsed'
  );
  t.equal(
    parseWeightBarcode('211234ABCDE', weightSettings),
    undefined,
    'non-numeric weight is not parsed'
  );
  t.equal(
    parseWeightBarcode('21123412500', {
      ...weightSettings,
      itemWeightDigits: 0,
    }),
    undefined,
    'missing weight digit setting does not throw'
  );
  t.end();
});

test('weight quantity respects the stock unit and whole UOMs', (t) => {
  const weight = parseWeightBarcode('21123412500', weightSettings)!;
  t.equal(
    getWeightBarcodeQuantity(weight, 'Kg'),
    12.5,
    'kilograms divide by 1000'
  );
  t.equal(
    getWeightBarcodeQuantity(weight, 'Gram'),
    12500,
    'grams are unchanged'
  );
  t.equal(
    getWeightBarcodeQuantity(weight, 'Unit'),
    12500,
    'generic units are unchanged'
  );
  t.equal(
    getWeightBarcodeQuantity(weight, { name: 'Kg', isWhole: true }),
    13,
    'whole-number UOMs round the quantity'
  );
  t.end();
});

test('missing weight settings are reported without throwing', (t) => {
  t.deepEqual(
    getMissingWeightBarcodeFields({
      weightEnabledBarcode: false,
      checkDigits: 0,
      itemCodeDigits: 0,
      itemWeightDigits: 0,
    }),
    [],
    'disabled weight barcodes require no configuration'
  );
  t.deepEqual(
    getMissingWeightBarcodeFields({
      ...weightSettings,
      checkDigits: 0,
    }),
    ['checkDigits'],
    'missing check digits are reported'
  );
  t.deepEqual(
    getMissingWeightBarcodeFields({
      ...weightSettings,
      itemCodeDigits: 0,
    }),
    ['itemCodeDigits'],
    'missing item code digits are reported'
  );
  t.deepEqual(
    getMissingWeightBarcodeFields({
      ...weightSettings,
      itemWeightDigits: 0,
    }),
    ['itemWeightDigits'],
    'missing item weight digits are reported'
  );
  t.equal(
    parseWeightBarcode('21123412500', {
      ...weightSettings,
      itemWeightDigits: 0,
    }),
    undefined,
    'incomplete settings do not parse or throw a TypeError'
  );
  t.end();
});

test('getScannedItem skips weight parsing when settings are incomplete', async (t) => {
  const fyo = makeFyo({ ...weightSettings, itemWeightDigits: 0 }, [
    { name: 'Apple', barcode: 'ABC123', itemCode: '1234', unit: 'Kg' },
  ]);

  t.equal(
    await getScannedItem(fyo, '21123412500'),
    undefined,
    'weight code is not resolved as a plain barcode'
  );
  t.equal(
    (await getScannedItem(fyo, 'ABC123'))?.item.name,
    'Apple',
    'plain barcode still resolves with incomplete weight settings'
  );
  t.end();
});

test('scan resolution matches barcodes, item codes, names and weight codes', (t) => {
  const plain = findScannedItem(items, 'ABC123');
  t.equal(plain?.item.name, 'Apple', 'arbitrary-length barcode resolves');
  t.equal(plain?.quantity, 1, 'plain barcode adds quantity one');
  t.equal(plain?.isWeightBarcode, false, 'plain barcode is not a weight scan');

  const childBarcode = findScannedItem(items, 'EANAPPLE');
  t.equal(childBarcode?.item.name, 'Apple', 'child-table barcode resolves');

  const legacyBarcode = findScannedItem(items, '999999999999');
  t.equal(
    legacyBarcode?.item.name,
    'Banana',
    'legacy 12-digit barcode resolves'
  );

  const byName = findScannedItem(items, 'Apple');
  t.equal(byName?.item.name, 'Apple', 'item name fallback resolves');

  const weighed = findScannedItem(items, '21123412500', weightSettings);
  t.equal(weighed?.item.name, 'Apple', 'weight barcode item code resolves');
  t.equal(weighed?.quantity, 12.5, 'weight barcode sets kilogram quantity');
  t.equal(weighed?.isWeightBarcode, true, 'weight barcode is flagged');

  t.equal(
    findScannedItem(items, '9999999999999'),
    undefined,
    'unknown code resolves to nothing'
  );
  t.end();
});

test('child barcodes take priority over legacy and item code matches', (t) => {
  const priorityItems: BarcodeItem[] = [
    { name: 'Child Match', barcodes: ['ABC123'] },
    { name: 'Legacy Match', barcode: 'ABC123', barcodes: [] },
    { name: 'Code Match', itemCode: 'ABC123', barcodes: [] },
  ];

  t.equal(
    findScannedItem(priorityItems, 'ABC123')?.item.name,
    'Child Match',
    'ItemBarcode rows resolve first'
  );

  const legacyItems: BarcodeItem[] = [
    { name: 'Legacy Match', barcode: 'ABC123', barcodes: [] },
    { name: 'Code Match', itemCode: 'ABC123', barcodes: [] },
  ];
  t.equal(
    findScannedItem(legacyItems, 'ABC123')?.item.name,
    'Legacy Match',
    'legacy Item.barcode resolves before itemCode'
  );
  t.end();
});

test('child barcode unit hints are used for weight quantity', (t) => {
  const itemsWithHint: BarcodeItem[] = [
    {
      name: 'Apple',
      itemCode: '1234',
      unit: 'Kg',
      barcodes: ['21123412500'],
      barcodeUnits: { '21123412500': 'Gram' },
    },
  ];

  const scanned = findScannedItem(itemsWithHint, '21123412500', weightSettings);
  t.equal(scanned?.item.name, 'Apple', 'weight scan resolves the item');
  t.equal(scanned?.quantity, 12500, 'per-barcode Gram hint overrides Kg');
  t.equal(scanned?.isWeightBarcode, true, 'weight scan is flagged');
  t.end();
});

test('getBarcodeRows reads optional ItemBarcode rows and unit hints', async (t) => {
  const fyo = makeFyo(
    weightSettings,
    [
      { name: 'Apple', barcode: 'ABC123', itemCode: '1234', unit: 'Kg' },
      {
        name: 'Banana',
        barcode: '999999999999',
        itemCode: '5678',
        unit: 'Unit',
      },
    ],
    [
      { parent: 'Apple', barcode: 'EANAPPLE', uom: 'Kg' },
      { parent: 'Apple', barcode: 'UPCAPPLE', uom: 'Gram' },
    ]
  );

  const rows = await getBarcodeRows(fyo);
  const apple = rows.find((row) => row.name === 'Apple');
  t.deepEqual(
    apple?.barcodes,
    ['EANAPPLE', 'UPCAPPLE'],
    'child rows are added without the legacy barcode column'
  );
  t.equal(apple?.barcode, 'ABC123', 'legacy barcode remains available');
  t.equal(apple?.barcodeUnits?.EANAPPLE, 'Kg', 'EAN unit hint is read');
  t.equal(apple?.barcodeUnits?.UPCAPPLE, 'Gram', 'UPC unit hint is read');

  const childScan = await getScannedItem(fyo, 'EANAPPLE');
  t.equal(childScan?.item.name, 'Apple', 'POS scan resolves a child barcode');
  t.equal(childScan?.quantity, 1, 'plain child scan adds one');

  const legacyScan = await getScannedItem(fyo, '999999999999');
  t.equal(legacyScan?.item.name, 'Banana', 'legacy barcode still resolves');
  t.end();
});

test('getScannedItem reads POS settings and legacy item rows', async (t) => {
  const fyo = makeFyo(weightSettings, [
    { name: 'Apple', barcode: 'ABC123', itemCode: '1234', unit: 'Kg' },
  ]);

  t.deepEqual(
    getBarcodeSettings(fyo),
    {
      weightEnabledBarcode: true,
      checkDigits: 21,
      itemCodeDigits: 4,
      itemWeightDigits: 5,
    },
    'settings are read from POSSettings'
  );

  const scanned = await getScannedItem(fyo, '21123412500');
  t.equal(scanned?.item.name, 'Apple', 'item is found from the database');
  t.equal(scanned?.quantity, 12.5, 'quantity is derived from the scan');
  t.equal(scanned?.isWeightBarcode, true, 'weight scan is detected');

  const plain = await getScannedItem(fyo, 'ABC123');
  t.equal(
    plain?.item.name,
    'Apple',
    'plain barcode is found from the database'
  );
  t.equal(plain?.quantity, 1, 'plain scan adds one');
  t.end();
});

test('item barcode validation catches missing, repeated and cross-item duplicates', (t) => {
  t.equal(
    getItemBarcodeValidationIssue([{ barcode: 'ABC123' }]),
    undefined,
    'one configured barcode is valid'
  );
  t.deepEqual(
    getItemBarcodeValidationIssue([{ barcode: '   ' }]),
    { type: 'missing' },
    'blank child barcode is rejected'
  );
  t.deepEqual(
    getItemBarcodeValidationIssue([
      { barcode: 'ABC123' },
      { barcode: 'abc123' },
    ]),
    { type: 'within', barcode: 'abc123' },
    'case-insensitive duplicates within one item are rejected'
  );
  t.deepEqual(
    getItemBarcodeValidationIssue(
      [{ barcode: 'EANAPPLE' }],
      [{ parent: 'Banana', barcode: 'EANAPPLE' }],
      'Apple'
    ),
    { type: 'existing', barcode: 'EANAPPLE', item: 'Banana' },
    'duplicates on another item are rejected'
  );
  t.equal(
    getItemBarcodeValidationIssue(
      [{ barcode: 'EANAPPLE' }],
      [{ parent: 'Apple', barcode: 'EANAPPLE' }],
      'Apple'
    ),
    undefined,
    'existing rows on the same item are allowed'
  );
  t.end();
});
