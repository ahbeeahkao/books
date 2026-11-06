import { Fyo } from 'fyo';
import { DocValue } from 'fyo/core/types';
import { Doc } from 'fyo/model/doc';
import {
  Action,
  FiltersMap,
  FormulaMap,
  HiddenMap,
  ListViewSettings,
  ReadOnlyMap,
  RequiredMap,
  ValidationMap,
} from 'fyo/model/types';
import { ValidationError } from 'fyo/utils/errors';
import { ModelNameEnum } from 'models/types';
import {
  ExistingItemBarcodeRow,
  getItemBarcodeValidationIssue,
  ItemBarcodeRow,
} from 'src/utils/barcodes';
import { Money } from 'pesa';
import {
  getUomConversionValidationIssue,
  getUomFieldConfig,
  isUomConversionsEnabled,
} from 'src/utils/uom';
import { AccountRootTypeEnum, AccountTypeEnum } from '../Account/types';

interface UOMConversionItem {
  name: string;
  uom: string;
  conversionFactor: number;
}

export class Item extends Doc {
  itemCode?: string;
  trackItem?: boolean;
  itemType?: 'Product' | 'Service';
  for?: 'Purchases' | 'Sales' | 'Both';
  hasBatch?: boolean;
  batchSeries?: string;
  itemGroup?: string;
  hsnCode?: number;
  hasSerialNumber?: boolean;
  serialNumberSeries?: string;
  datafromErp?: boolean;
  unit?: string;
  uomConversions: UOMConversionItem[] = [];
  barcodes: ItemBarcodeRow[] = [];

  formulas: FormulaMap = {
    incomeAccount: {
      formula: async () => {
        let accountName = 'Service';
        if (this.itemType === 'Product') {
          accountName = 'Sales';
        }

        const accountExists = await this.fyo.db.exists('Account', accountName);
        return accountExists ? accountName : '';
      },
      dependsOn: ['itemType'],
    },
    expenseAccount: {
      formula: async () => {
        if (this.trackItem) {
          return this.fyo.singles.InventorySettings
            ?.stockReceivedButNotBilled as string;
        }

        const cogs = await this.fyo.db.getAllRaw('Account', {
          filters: {
            accountType: AccountTypeEnum['Cost of Goods Sold'],
          },
        });

        if (cogs.length === 0) {
          return '';
        } else {
          return cogs[0].name as string;
        }
      },
      dependsOn: ['itemType', 'trackItem'],
    },
    hsnCode: {
      formula: async () => {
        if (!this.itemGroup) {
          return '';
        }

        const itemGroupDoc = await this.fyo.doc.getDoc(
          'ItemGroup',
          this.itemGroup
        );
        return itemGroupDoc?.hsnCode as string;
      },
      dependsOn: ['itemGroup'],
    },
  };

  async beforeSync(): Promise<void> {
    await super.beforeSync();

    if (this.serialNumberSeries && this.hasSerialNumber) {
      const series = this.serialNumberSeries.trim();
      if (series && !series.endsWith('-')) {
        this.serialNumberSeries = series + '-';
      }
    }

    if (this.batchSeries && this.hasBatch) {
      const series = this.batchSeries.trim();
      if (series && !series.endsWith('-')) {
        this.batchSeries = series + '-';
      }
    }
  }

  async afterSync(): Promise<void> {
    await super.afterSync();

    if (this.hasSerialNumber && this.serialNumberSeries) {
      const seriesName = this.serialNumberSeries?.trim();

      if (!seriesName) {
        return;
      }

      const exists = await this.fyo.db.exists('SerialNumberSeries', seriesName);

      if (!exists) {
        await this.fyo.doc
          .getNewDoc('SerialNumberSeries', {
            name: seriesName,
            start: 1001,
            padZeros: 4,
            current: 1001,
          })
          .sync();
      }
    }

    if (this.hasBatch && this.batchSeries) {
      const seriesName = this.batchSeries?.trim();

      if (!seriesName) {
        return;
      }

      const exists = await this.fyo.db.exists('BatchSeries', seriesName);

      if (!exists) {
        await this.fyo.doc
          .getNewDoc('BatchSeries', {
            name: seriesName,
            start: 1001,
            padZeros: 4,
            current: 1001,
          })
          .sync();
      }
    }
  }

  async validate(): Promise<void> {
    await super.validate();

    const conversionsEnabled = isUomConversionsEnabled(this.fyo);
    if (!conversionsEnabled && this.uomConversions.length > 0) {
      throw new ValidationError(
        this.fyo.t`UOM conversions are turned off in Inventory Settings.`
      );
    }

    const conversionIssue = getUomConversionValidationIssue(
      this.uomConversions ?? []
    );
    if (conversionIssue) {
      if (conversionIssue.type === 'missing-uom') {
        throw new ValidationError(
          this.fyo.t`UOM is required for every conversion row.`
        );
      }

      if (conversionIssue.type === 'duplicate') {
        throw new ValidationError(
          this.fyo.t`Each unit can have only one conversion factor.`
        );
      }

      throw new ValidationError(
        this.fyo.t`Conversion factors must be greater than zero.`
      );
    }

    if (!this.fyo.schemaMap?.[ModelNameEnum.ItemBarcode]) {
      return;
    }

    const existing = (await this.fyo.db.getAll(ModelNameEnum.ItemBarcode, {
      fields: ['name', 'parent', 'barcode'],
    })) as unknown as ExistingItemBarcodeRow[];
    const issue = getItemBarcodeValidationIssue(
      this.barcodes ?? [],
      existing,
      this.name
    );

    if (!issue) {
      return;
    }

    if (issue.type === 'missing') {
      throw new ValidationError(
        this.fyo.t`Barcode is required for every barcode row.`
      );
    }

    if (issue.type === 'within') {
      throw new ValidationError(
        this.fyo.t`Barcode ${issue.barcode} is repeated in this item.`
      );
    }

    throw new ValidationError(
      this.fyo.t`Barcode ${issue.barcode} is already used by ${issue.item}.`
    );
  }

  static filters: FiltersMap = {
    incomeAccount: () => ({
      isGroup: false,
      rootType: AccountRootTypeEnum.Income,
    }),
    expenseAccount: (doc) => ({
      isGroup: false,
      rootType: doc.trackItem
        ? AccountRootTypeEnum.Liability
        : AccountRootTypeEnum.Expense,
    }),
  };

  validations: ValidationMap = {
    barcode: (value: DocValue) => {
      if (value && !(value as string).match(/^\d{12}$/)) {
        throw new ValidationError(
          this.fyo.t`Barcode must be exactly 12 digits.`
        );
      }
    },
    rate: (value: DocValue) => {
      if ((value as Money).isNegative()) {
        throw new ValidationError(this.fyo.t`Rate can't be negative.`);
      }
    },
    hsnCode: (value: DocValue) => {
      if (value && !(value as string).match(/^\d{4,8}$/)) {
        throw new ValidationError(this.fyo.t`Invalid HSN Code.`);
      }
    },
    serialNumberSeries: (value: DocValue) => {
      if (!value) {
        return;
      }

      const series = (value as string).trim();
      const invalidChars = /[/\=\?\&\%]/;

      if (invalidChars.test(series)) {
        throw new ValidationError(
          this.fyo
            .t`Serial Number Series cannot contain the following characters: /, ?, &, =, %`
        );
      }
    },
    batchSeries: (value: DocValue) => {
      if (!value) {
        return;
      }

      const series = (value as string).trim();
      const invalidChars = /[/\=\?\&\%]/;

      if (invalidChars.test(series)) {
        throw new ValidationError(
          this.fyo
            .t`Batch Series cannot contain the following characters: /, ?, &, =, %`
        );
      }
    },
  };

  static getActions(fyo: Fyo): Action[] {
    return [
      {
        group: fyo.t`Create`,
        label: fyo.t`Sales Invoice`,
        condition: (doc) => !doc.notInserted && doc.for !== 'Purchases',
        action: async (doc, router) => {
          const invoice = fyo.doc.getNewDoc('SalesInvoice');
          await invoice.append('items', {
            item: doc.name as string,
            rate: doc.rate as Money,
            tax: doc.tax as string,
          });
          await router.push(`/edit/SalesInvoice/${invoice.name!}`);
        },
      },
      {
        group: fyo.t`Create`,
        label: fyo.t`Purchase Invoice`,
        condition: (doc) => !doc.notInserted && doc.for !== 'Sales',
        action: async (doc, router) => {
          const invoice = fyo.doc.getNewDoc('PurchaseInvoice');
          await invoice.append('items', {
            item: doc.name as string,
            rate: doc.rate as Money,
            tax: doc.tax as string,
          });
          await router.push(`/edit/PurchaseInvoice/${invoice.name!}`);
        },
      },
    ];
  }

  static getListViewSettings(): ListViewSettings {
    return {
      columns: ['name', 'unit', 'tax', 'rate'],
    };
  }

  hidden: HiddenMap = {
    trackItem: () =>
      !this.fyo.singles.AccountingSettings?.enableInventory ||
      this.itemType !== 'Product' ||
      (this.inserted && !this.trackItem),
    barcode: () => !this.fyo.singles.InventorySettings?.enableBarcodes,
    barcodes: () => !this.fyo.singles.InventorySettings?.enableBarcodes,
    hasBatch: () => !this.fyo.singles.InventorySettings?.enableBatches,
    hasSerialNumber: () =>
      !(
        this.fyo.singles.InventorySettings?.enableSerialNumber && this.trackItem
      ),
    serialNumberSeries: () => !this.hasSerialNumber,
    batchSeries: () => !this.hasBatch,
    unit: () => getUomFieldConfig(this.fyo).hidden,
    uomConversions: () => getUomFieldConfig(this.fyo).hidden,
    itemGroup: () => !this.fyo.singles.AccountingSettings?.enableitemGroup,
  };

  required: RequiredMap = {
    unit: () => getUomFieldConfig(this.fyo).required,
    uomConversions: () =>
      getUomFieldConfig(this.fyo).required &&
      (this.uomConversions?.length ?? 0) > 0,
  };

  readOnly: ReadOnlyMap = {
    unit: () => this.inserted,
    itemType: () => this.inserted,
    trackItem: () => this.inserted,
    hasBatch: () => this.inserted,
    hasSerialNumber: () => this.inserted,
  };
}
