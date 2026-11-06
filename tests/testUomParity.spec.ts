import { t as translate } from 'fyo';
import { Item } from 'models/baseModels/Item/Item';
import { SalesInvoiceItem } from 'models/baseModels/SalesInvoiceItem/SalesInvoiceItem';
import { StockMovementItem } from 'models/inventory/StockMovementItem';
import { ShipmentItem } from 'models/inventory/ShipmentItem';
import { UOM } from 'models/baseModels/UOM/UOM';
import type { Fyo } from 'fyo';
import type { Schema } from 'schemas/types';
import { getSchemas } from 'schemas';
import {
  BarcodeSettings,
  getScannedItem,
  getWeightBarcodeQuantity,
  getBarcodeRows,
  parseWeightBarcode,
} from 'src/utils/barcodes';
import {
  assertWholeNumberQuantity,
  assertWholeNumberQuantityForUnit,
  getConfiguredUomFactor,
  getLegacyWeightConversionFactor,
  getUomConversionFactorMap,
  getUomConversionValidationIssue,
  getUomDetailsForUnit,
  getUomFieldConfig,
  getUomWeightConversionFactor,
  getUomWholeNumberFlag,
  getUomWholeNumberMapping,
  getWholeNumberQuantityError,
  UomConversionRow,
  UomDetails,
} from 'src/utils/uom';
import ItemSchema from 'schemas/app/Item.json';
import UOMSchema from 'schemas/app/UOM.json';
import UOMConversionItemSchema from 'schemas/app/inventory/UOMConversionItem.json';
import test from 'tape';

const weightSettings: BarcodeSettings = {
  weightEnabledBarcode: true,
  checkDigits: 21,
  itemCodeDigits: 4,
  itemWeightDigits: 5,
};

type FakeFyoOptions = {
  enabled?: boolean;
  itemRows?: Record<string, unknown>[];
  uomRows?: Record<string, unknown>[];
  conversionRows?: Record<string, unknown>[];
  childRows?: Record<string, unknown>[];
  schemaMap?: Record<string, unknown>;
  unit?: string;
  whole?: boolean;
};

function makeFyo(options: FakeFyoOptions = {}): Fyo {
  return {
    t: translate,
    models: {},
    singles: {
      InventorySettings: {
        enableUomConversions: options.enabled ?? false,
      },
      POSSettings: weightSettings,
    },
    schemaMap: {
      Item: {},
      UOM: {},
      UOMConversionItem: {},
      ItemBarcode: {},
      ...(options.schemaMap ?? {}),
    },
    pesa: (value: number) => value,
    doc: {
      getTemporaryName: () => 'TMP',
      getNewDoc: (_schemaName: string, data: Record<string, unknown>) => ({
        ...data,
      }),
    },
    db: {
      getAll: async (schemaName: string) => {
        switch (schemaName) {
          case 'Item':
            return options.itemRows ?? [];
          case 'UOM':
            return options.uomRows ?? [];
          case 'UOMConversionItem':
            return options.conversionRows ?? [];
          case 'ItemBarcode':
            return options.childRows ?? [];
          default:
            return [];
        }
      },
    },
    getValue: async (schemaName: string, _name: string, fieldname?: string) => {
      if (schemaName === 'Item' && fieldname === 'unit') {
        return options.unit ?? 'Unit';
      }
      if (schemaName === 'UOM' && fieldname === 'isWhole') {
        return options.whole ?? false;
      }
      if (schemaName === 'UOM' && fieldname === 'mustBeWholeNumber') {
        return options.whole ?? false;
      }
      return undefined;
    },
  } as unknown as Fyo;
}

async function expectError(
  t: Parameters<Parameters<typeof test>[1]>[0],
  fn: () => Promise<void>,
  pattern: RegExp,
  message: string
): Promise<void> {
  try {
    await fn();
    t.fail(`${message}: expected an error`);
  } catch (error) {
    t.ok(pattern.test((error as Error).message), message);
  }
}

test('UOM schema keeps the name PK and adds a computed parity alias', (t) => {
  const fields = (UOMSchema as unknown as Schema).fields;
  const name = fields.find((field) => field.fieldname === 'name');
  const isWhole = fields.find((field) => field.fieldname === 'isWhole');
  const alias = fields.find(
    (field) => field.fieldname === 'mustBeWholeNumber'
  ) as Record<string, unknown> | undefined;

  t.ok(name?.required, 'name remains the required primary key');
  t.ok(isWhole, 'the legacy isWhole boolean is preserved');
  t.ok(alias, 'mustBeWholeNumber parity field exists');
  t.equal(alias?.computed, true, 'parity alias is not stored in the database');
  t.equal(alias?.hidden, true, 'parity alias does not add a visible control');
  t.ok(
    String(alias?.description ?? '').includes('Is Whole'),
    'alias documents the isWhole mapping'
  );
  t.ok(
    String(isWhole?.description ?? '').includes('Must Be Whole Number'),
    'isWhole documents the ERPNext mapping'
  );
  t.ok(
    (UOMSchema.quickEditFields ?? []).includes('mustBeWholeNumber'),
    'parity alias is exposed in quick-edit metadata'
  );
  t.end();
});

test('UOM model maps isWhole to mustBeWholeNumber', async (t) => {
  const fyo = makeFyo({ enabled: true });
  const uom = new UOM(
    UOMSchema as unknown as Schema,
    { name: 'Piece', isWhole: true },
    fyo
  );

  await uom._setComputedValuesFromFormulas();

  t.equal(uom.mustBeWholeNumber, true, 'computed alias mirrors isWhole');
  t.equal(
    getUomWholeNumberMapping(false),
    false,
    'mapping is false by default'
  );
  t.end();
});

test('UOM conversion schema documents positive and unique factors', (t) => {
  const fields = (UOMConversionItemSchema as unknown as Schema).fields;
  const factor = fields.find(
    (field) => field.fieldname === 'conversionFactor'
  ) as Record<string, unknown> | undefined;
  const uom = fields.find((field) => field.fieldname === 'uom') as
    | Record<string, unknown>
    | undefined;

  t.ok(
    Number(factor?.minvalue) > 0,
    'conversion factor has a positive lower bound'
  );
  t.ok(
    String(factor?.description ?? '').includes('greater than zero'),
    'positive factor requirement is documented'
  );
  t.ok(
    String(uom?.description ?? '').includes('One conversion row'),
    'one row per UOM requirement is documented'
  );

  const itemFields = (ItemSchema as unknown as Schema).fields;
  const unit = itemFields.find((field) => field.fieldname === 'unit');
  const conversions = itemFields.find(
    (field) => field.fieldname === 'uomConversions'
  );
  t.ok(
    String(unit?.description ?? '').includes('required when UOM conversions'),
    'Item.unit documents the feature gate'
  );
  t.ok(
    String(conversions?.description ?? '').includes('one row per UOM'),
    'Item.uomConversions documents the validation rule'
  );
  t.ok(
    (ItemSchema.quickEditFields ?? []).includes('uomConversions') &&
      !(ItemSchema.quickEditFields ?? []).includes('uom'),
    'invalid quick-edit uom field is replaced by uomConversions'
  );
  t.end();
});

test('UOM conversion validation rejects missing, duplicate and nonpositive rows', (t) => {
  const valid: UomConversionRow[] = [
    { uom: 'Box', conversionFactor: 12 },
    { uom: 'Pack', conversionFactor: '0.5' },
  ];

  t.equal(
    getUomConversionValidationIssue(valid),
    undefined,
    'positive unique factors are valid'
  );
  t.deepEqual(
    getUomConversionValidationIssue([{ conversionFactor: 1 }]),
    { type: 'missing-uom', index: 0 },
    'missing UOM is rejected'
  );
  t.deepEqual(
    getUomConversionValidationIssue([
      { uom: 'Box', conversionFactor: 12 },
      { uom: 'box', conversionFactor: 6 },
    ]),
    { type: 'duplicate', index: 1, uom: 'box' },
    'case-insensitive duplicate UOM is rejected'
  );
  t.deepEqual(
    getUomConversionValidationIssue([{ uom: 'Box', conversionFactor: 0 }]),
    { type: 'nonpositive', index: 0, uom: 'Box', conversionFactor: 0 },
    'zero factor is rejected'
  );
  t.deepEqual(
    getUomConversionValidationIssue([{ uom: 'Box', conversionFactor: -2 }]),
    { type: 'nonpositive', index: 0, uom: 'Box', conversionFactor: -2 },
    'negative factor is rejected'
  );
  t.deepEqual(
    getUomConversionFactorMap([
      { uom: 'Box', conversionFactor: 12 },
      { uom: 'Bad', conversionFactor: 0 },
    ]),
    { Box: 12 },
    'only positive factors enter the lookup map'
  );
  t.equal(
    getConfiguredUomFactor({ Pack: 0.0003 }, 'pack'),
    0.0003,
    'configured factors are matched case-insensitively'
  );
  t.end();
});

test('Item hidden and required maps follow enableUomConversions', (t) => {
  const off = new Item(
    ItemSchema as unknown as Schema,
    { name: 'Apple', unit: 'Unit' },
    makeFyo({ enabled: false })
  );
  const on = new Item(
    ItemSchema as unknown as Schema,
    { name: 'Apple', unit: 'Unit' },
    makeFyo({ enabled: true })
  );

  t.equal(off.hidden.unit?.(), true, 'unit is hidden when feature is off');
  t.equal(
    off.hidden.uomConversions?.(),
    true,
    'conversions are hidden when feature is off'
  );
  t.equal(off.required?.unit?.(), false, 'unit is not required when off');
  t.equal(
    getUomFieldConfig(makeFyo({ enabled: false })).hidden,
    true,
    'field config hides UOM fields when off'
  );

  t.equal(on.hidden.unit?.(), false, 'unit is visible when feature is on');
  t.equal(
    on.hidden.uomConversions?.(),
    false,
    'conversions are visible when feature is on'
  );
  t.equal(on.required?.unit?.(), true, 'unit is required when feature is on');
  t.equal(
    on.required?.uomConversions?.(),
    false,
    'an empty conversion table is not forced'
  );
  on.uomConversions = [{ name: 'row', uom: 'Box', conversionFactor: 12 }];
  t.equal(
    on.required?.uomConversions?.(),
    true,
    'existing conversion rows are feature-gated'
  );
  t.end();
});

test('Item.validate rejects disabled, duplicate and nonpositive conversions', async (t) => {
  const enabled = makeFyo({ enabled: true, schemaMap: {} });
  const item = new Item(
    ItemSchema as unknown as Schema,
    { name: 'Apple', unit: 'Unit' },
    enabled
  );

  item.uomConversions = [{ name: 'row-1', uom: 'Box', conversionFactor: 12 }];
  await item.validate();
  t.pass('one positive unique conversion row is accepted');

  item.uomConversions = [
    { name: 'row-1', uom: 'Box', conversionFactor: 12 },
    { name: 'row-2', uom: 'box', conversionFactor: 6 },
  ];
  await expectError(
    t,
    () => item.validate(),
    /Each unit can have only one conversion factor/,
    'duplicate conversion UOM is rejected'
  );

  item.uomConversions = [{ name: 'row-1', uom: 'Box', conversionFactor: 0 }];
  await expectError(
    t,
    () => item.validate(),
    /Conversion factors must be greater than zero/,
    'nonpositive conversion factor is rejected'
  );

  const disabled = makeFyo({ enabled: false, schemaMap: {} });
  const disabledItem = new Item(
    ItemSchema as unknown as Schema,
    { name: 'Apple', unit: 'Unit' },
    disabled
  );
  disabledItem.uomConversions = [
    { name: 'row-1', uom: 'Box', conversionFactor: 12 },
  ];
  await expectError(
    t,
    () => disabledItem.validate(),
    /turned off in Inventory Settings/,
    'conversion rows are rejected when the feature is off'
  );

  t.end();
});

test('whole-number UOMs reject fractional quantities', async (t) => {
  const whole: UomDetails = { name: 'Piece', isWhole: true };
  const parityWhole: UomDetails = {
    name: 'Piece',
    mustBeWholeNumber: true,
  };

  t.ok(
    getWholeNumberQuantityError(2.5, whole),
    'fractional quantity is rejected for isWhole UOM'
  );
  t.equal(
    getWholeNumberQuantityError(2, whole),
    undefined,
    'whole quantity is allowed'
  );
  t.ok(
    getWholeNumberQuantityError(2.5, parityWhole),
    'mustBeWholeNumber parity alias rejects fractions'
  );
  t.ok(
    getWholeNumberQuantityError(2.5, 'Unit'),
    'legacy Unit string is treated as whole'
  );
  t.equal(
    getWholeNumberQuantityError(2.5, 'Kg'),
    undefined,
    'legacy Kg allows fractions'
  );
  t.equal(
    getUomWholeNumberFlag({ must_be_whole_number: true }),
    true,
    'ERPNext snake_case flag is mapped'
  );
  t.ok(
    getWholeNumberQuantityError(2.5, { must_be_whole_number: true }),
    'ERPNext snake_case flag rejects fractions'
  );

  const fyo = makeFyo({ enabled: true, unit: 'Unit', whole: true });
  await assertWholeNumberQuantity(fyo, 'Apple', 3);
  t.pass('whole quantity passes the model assertion');
  await expectError(
    t,
    () => assertWholeNumberQuantity(fyo, 'Apple', 3.5),
    /Quantity must be a whole number for Unit/,
    'fractional quantity fails the model assertion'
  );

  const legacyUnit = await getUomDetailsForUnit(
    makeFyo({ enabled: false }),
    'Unit'
  );
  t.equal(
    legacyUnit?.isWhole,
    true,
    'legacy Unit remains whole when the UOM row is missing'
  );
  await expectError(
    t,
    () => assertWholeNumberQuantityForUnit(fyo, 'Box', 0.5),
    /Quantity must be a whole number for Box/,
    'fractional derived stock quantity is rejected for a whole transfer unit'
  );
  t.end();
});

test('transaction rows validate stock and transfer quantities', async (t) => {
  const fyo = makeFyo({ enabled: true, unit: 'Unit', whole: true });
  const builtSchemas = getSchemas('-', []);
  const rows = [
    new SalesInvoiceItem(
      builtSchemas.SalesInvoiceItem as Schema,
      {
        item: 'Apple',
        unit: 'Unit',
        transferUnit: 'Box',
        quantity: 2,
        transferQuantity: 1,
      },
      fyo
    ),
    new StockMovementItem(
      builtSchemas.StockMovementItem as Schema,
      {
        item: 'Apple',
        unit: 'Unit',
        transferUnit: 'Box',
        quantity: 2,
        transferQuantity: 1,
      },
      fyo
    ),
    new ShipmentItem(
      builtSchemas.ShipmentItem as Schema,
      {
        item: 'Apple',
        unit: 'Unit',
        transferUnit: 'Box',
        quantity: 2,
        transferQuantity: 1,
      },
      fyo
    ),
  ];

  for (const [index, row] of rows.entries()) {
    const validations = row.validations as Record<
      string,
      ((value: unknown) => Promise<void>) | undefined
    >;
    await expectError(
      t,
      async () => {
        await validations.quantity?.(2.5);
      },
      /Quantity must be a whole number for Unit/,
      `row ${index} rejects a fractional stock quantity`
    );
    await expectError(
      t,
      async () => {
        await validations.transferQuantity?.(0.5);
      },
      /Quantity must be a whole number for Box/,
      `row ${index} rejects a fractional transfer quantity`
    );
  }
  t.end();
});

test('weight quantity uses configured UOM factors and preserves Kg/Gram', (t) => {
  const weight = parseWeightBarcode('21123412500', weightSettings)!;

  t.equal(
    getWeightBarcodeQuantity(weight, 'Kg'),
    12.5,
    'legacy Kg still divides encoded grams by 1000'
  );
  t.equal(
    getWeightBarcodeQuantity(weight, 'Gram'),
    12500,
    'legacy Gram is unchanged'
  );
  t.equal(
    getLegacyWeightConversionFactor('Kg'),
    0.001,
    'legacy kilogram factor is 0.001'
  );
  t.equal(
    getWeightBarcodeQuantity(weight, { name: 'Kg', conversionFactor: 1 }),
    12.5,
    'a default factor of one does not override legacy Kg'
  );
  t.equal(
    getWeightBarcodeQuantity(weight, {
      name: 'Pack',
      conversionFactor: 0.002,
    }),
    25,
    'configured UOM factor converts the encoded weight'
  );
  t.equal(
    getWeightBarcodeQuantity(weight, { name: 'Pack' }, { Pack: 0.002 }),
    25,
    'conversion-factor map supplies the configured UOM'
  );
  t.equal(
    getWeightBarcodeQuantity(weight, {
      name: 'Whole Pack',
      isWhole: true,
      conversionFactor: 0.0003,
    }),
    4,
    'whole-number configured UOM rounds the converted quantity'
  );
  t.equal(
    getUomWeightConversionFactor({ name: 'Pack', conversionFactor: 0.002 }),
    0.002,
    'shared helper resolves the configured factor'
  );
  t.end();
});

test('getScannedItem reads UOM docs, conversion factors and unit overrides', async (t) => {
  const fyo = makeFyo({
    enabled: true,
    itemRows: [{ name: 'Apple', itemCode: '1234', unit: 'Kg' }],
    uomRows: [
      { name: 'Kg', isWhole: false },
      { name: 'Pack', isWhole: true },
    ],
    conversionRows: [
      { parent: 'Apple', uom: 'Pack', conversionFactor: 0.0003 },
    ],
  });

  const rows = await getBarcodeRows(fyo);
  const apple = rows.find((row) => row.name === 'Apple');
  t.equal(
    apple?.uomDetails?.Kg?.isWhole,
    false,
    'UOM whole-number flag is loaded'
  );
  t.equal(
    apple?.uomDetails?.Pack?.isWhole,
    true,
    'configured UOM whole-number flag is loaded'
  );
  t.equal(
    apple?.conversionFactors?.Pack,
    0.0003,
    'item conversion factor is loaded'
  );

  const stockUnit = await getScannedItem(fyo, '21123412500', weightSettings);
  t.equal(stockUnit?.item.name, 'Apple', 'weight scan resolves the item');
  t.equal(
    stockUnit?.quantity,
    12.5,
    'stock UOM still applies the legacy kilogram factor'
  );

  const overrideString = await getScannedItem(
    fyo,
    '21123412500',
    weightSettings,
    'Pack'
  );
  t.equal(
    overrideString?.quantity,
    4,
    'string UOM override uses the configured factor and rounds'
  );

  const overrideObject = await getScannedItem(
    fyo,
    '21123412500',
    weightSettings,
    { name: 'Pack', isWhole: true, conversionFactor: 0.0003 }
  );
  t.equal(
    overrideObject?.quantity,
    4,
    'object UOM override uses the configured factor and rounds'
  );
  t.end();
});
