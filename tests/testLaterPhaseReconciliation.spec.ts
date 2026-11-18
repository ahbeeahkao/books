import { Fyo } from 'fyo';
import { DateTime } from 'luxon';
import { AccountRootTypeEnum } from 'models/baseModels/Account/types';
import { StockQueue } from 'models/inventory/stockQueue';
import { getCsvData } from 'reports/commonExporter';
import { GeneralLedger } from 'reports/GeneralLedger/GeneralLedger';
import { getStockBalanceEntries } from 'reports/inventory/helpers';
import { ComputedStockLedgerEntry } from 'reports/inventory/types';
import { ProfitAndLoss } from 'reports/ProfitAndLoss/ProfitAndLoss';
import { Report } from 'reports/Report';
import {
  AccountTreeNode,
  ColumnField,
  ReportCell,
  ValueMap,
} from 'reports/types';
import {
  getLedgerReconciliation,
  getPricingRuleItemCandidates,
  isRootAccountRecreatable,
} from 'src/utils/reconciliation';
import { stripUtf8Bom } from 'src/utils/stabilization';
import test from 'tape';

/**
 * Synthetic reconciliation fixtures for later-phase checkpoint 2.
 *
 * The rows below are generated from documented upstream issue steps, not from
 * real user CSV exports, company databases, or reconciliation files.
 */

type RawLedgerRow = {
  name: string;
  account: string;
  date: string;
  debit: string;
  credit: string;
  referenceType: string;
  referenceName: string;
  party: string;
  reverted: boolean;
  reverts: string;
  created: string;
};

type FakeFyoOptions = {
  ledgerRows?: RawLedgerRow[];
  fiscalYearStart?: string;
  fiscalYearEnd?: string;
};

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function matchesDateFilter(rowDate: string, filter: unknown): boolean {
  if (!Array.isArray(filter)) {
    return true;
  }

  const current = dateOnly(rowDate);
  for (let index = 0; index < filter.length; index += 2) {
    const operator = filter[index] as string;
    const target = filter[index + 1] as string;
    if (operator === '<' && !(current < target)) {
      return false;
    }

    if (operator === '<=' && !(current <= target)) {
      return false;
    }

    if (operator === '>' && !(current > target)) {
      return false;
    }

    if (operator === '>=' && !(current >= target)) {
      return false;
    }
  }

  return true;
}

function getFakeFyo(options: FakeFyoOptions = {}): Fyo {
  const ledgerRows = options.ledgerRows ?? [];
  const fiscalYearStart = options.fiscalYearStart ?? '2025-04-01';
  const fiscalYearEnd = options.fiscalYearEnd ?? '2026-03-31';
  const fiscalValues: Record<string, string> = {
    fiscalYearStart,
    fiscalYearEnd,
  };

  const fake = {
    doc: {
      observer: {
        on: () => undefined,
      },
    },
    db: {
      getAllRaw: async (
        schemaName: string,
        config?: { filters?: Record<string, unknown> }
      ) => {
        const filters = config?.filters ?? {};
        if (schemaName === 'AccountingLedgerEntry') {
          return ledgerRows.filter((row) => {
            if (
              typeof filters.reverted === 'boolean' &&
              row.reverted !== filters.reverted
            ) {
              return false;
            }

            return matchesDateFilter(row.date, filters.date);
          });
        }

        if (schemaName === 'Account') {
          return [
            {
              name: 'Sales',
              rootType: AccountRootTypeEnum.Income,
              isGroup: false,
              parentAccount: null,
            },
          ];
        }

        return [];
      },
      getSingleValues: async () => [],
    },
    getValue: async (schemaName: string, name: string, fieldname?: string) => {
      if (schemaName !== 'AccountingSettings') {
        return undefined;
      }

      return fiscalValues[fieldname ?? name];
    },
    format: (value: unknown) => {
      if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
      }

      if (typeof value === 'number') {
        return value.toFixed(2);
      }

      return String(value);
    },
    schemaMap: {},
    singles: {
      AccountingSettings: { setupComplete: true, enableInventory: false },
      SystemSettings: { displayPrecision: 2 },
    },
    store: { appVersion: '0.37.0' },
    telemetry: { log: () => undefined },
  };

  return fake as unknown as Fyo;
}

function ledgerRow(values: Partial<RawLedgerRow>): RawLedgerRow {
  return {
    name: values.name ?? '1',
    account: values.account ?? 'Bank',
    date: values.date ?? '2025-10-25',
    debit: values.debit ?? '0',
    credit: values.credit ?? '0',
    referenceType: values.referenceType ?? 'JournalEntry',
    referenceName: values.referenceName ?? 'JV-1001',
    party: values.party ?? '',
    reverted: values.reverted ?? false,
    reverts: values.reverts ?? '',
    created: values.created ?? values.date ?? '2025-10-25',
  };
}

function getCell(
  rowIndex: number,
  cellIndex: number,
  rawValue: unknown
): ReportCell {
  return {
    value: typeof rawValue === 'number' ? String(rawValue) : 'display',
    rawValue,
  } as ReportCell;
}

test('synthetic #1394: exported customer balances use numeric raw values', (t) => {
  const fake = getFakeFyo();
  const moneyLike = { float: 50000 };
  const report = {
    fyo: fake,
    columns: [
      { fieldname: 'customer', label: 'Customer', fieldtype: 'Data' },
      { fieldname: 'balance', label: 'Balance', fieldtype: 'Currency' },
    ] as ColumnField[],
    filters: [],
    reportData: [
      {
        cells: [
          { value: 'Customer A', rawValue: 'Customer A' },
          { value: '₹ 50,000.00', rawValue: moneyLike },
        ],
      },
      {
        cells: [
          { value: 'Customer B', rawValue: 'Customer B' },
          { value: '₹ Infinity', rawValue: Infinity },
        ],
      },
    ],
  } as unknown as Report;

  const csv = stripUtf8Bom(getCsvData(report));
  const lines = csv
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim());
  t.equal(lines[0], 'Customer,Balance', 'CSV headers are preserved');
  t.ok(
    lines[1].includes('Customer A') && lines[1].includes(',50000'),
    'Money-like balance is exported'
  );
  t.ok(
    lines[2].includes('Customer B') && lines[2].includes(',0'),
    'non-finite balance is bounded'
  );
  t.notOk(csv.includes('[object Object]'), 'no object marker is exported');
  t.notOk(csv.includes('Infinity'), 'no Infinity string is exported');
  t.end();
});

test('synthetic #1410: ledger carries forward the opening balance', async (t) => {
  const rows = [
    ledgerRow({
      name: '1',
      date: '2025-10-25',
      debit: '50000',
      credit: '0',
      referenceName: 'OPENING-1001',
    }),
    ledgerRow({
      name: '2',
      date: '2025-10-26',
      debit: '0',
      credit: '1000',
      referenceName: 'PAY-1001',
      referenceType: 'Payment',
    }),
  ];

  const reconciliation = getLedgerReconciliation(
    rows.map((row) => ({
      date: row.date,
      debit: Number(row.debit),
      credit: Number(row.credit),
    })),
    '2025-10-26',
    '2025-10-27'
  );
  t.equal(reconciliation.opening, 50000, 'pre-range balance is ₹50,000');
  t.equal(reconciliation.transactions, -1000, 'range movement is −₹1,000');
  t.equal(reconciliation.closing, 49000, 'expected closing is ₹49,000');

  const report = new GeneralLedger(getFakeFyo({ ledgerRows: rows }));
  report.fromDate = '2025-10-26';
  report.toDate = '2025-10-27';
  report.ascending = true;
  report.groupBy = 'none';
  report.referenceType = 'All';
  report.reverted = false;
  report.columns = [
    { fieldname: 'account', label: 'Account', fieldtype: 'Data' },
    { fieldname: 'balance', label: 'Balance', fieldtype: 'Currency' },
  ] as ColumnField[];

  await report.setReportData(undefined, true);
  const balances = report.reportData.map((row) => row.cells[1]?.rawValue);
  t.ok(balances.includes(50000), 'opening row shows ₹50,000');
  t.ok(balances.includes(49000), 'running and closing balance show ₹49,000');
  t.equal(report._openingBalance, 50000, 'report stores the opening balance');
  t.end();
});

test('synthetic #1541: prior fiscal-year income falls inside the P&L range', async (t) => {
  const report = new ProfitAndLoss(
    getFakeFyo({
      fiscalYearStart: '2025-04-01',
      fiscalYearEnd: '2026-03-31',
    })
  );
  report.basedOn = 'Fiscal Year';
  report.fromYear = 2025;
  report.toYear = 2026;
  report.periodicity = 'Yearly';
  report.consolidateColumns = true;

  const endpoints = await report._getFromAndToDates();
  t.equal(endpoints.fromDate, '2025-04-01', 'FY2025-26 start is preserved');
  t.equal(endpoints.toDate, '2026-04-01', 'FY2025-26 exclusive end is correct');

  const filters = await report._getQueryFilters();
  t.deepEqual(
    filters.date,
    ['<', '2026-04-01', '>=', '2025-04-01'],
    'back-dated 5 May 2025 income is included'
  );

  await report._setDateRanges();
  const range = report._dateRanges![0];
  const valueMap: ValueMap = new Map([[range, { balance: 50000 }]]);
  const leaf = {
    name: 'Service Sales',
    rootType: AccountRootTypeEnum.Income,
    isGroup: false,
    parentAccount: 'Sales',
    valueMap,
  } as AccountTreeNode;
  const incomeRoot = {
    name: 'Sales',
    rootType: AccountRootTypeEnum.Income,
    isGroup: true,
    parentAccount: null,
    children: [leaf],
  } as AccountTreeNode;
  const totalRow = report.getRowFromAccountListNode(
    report.getTotalNode([incomeRoot], 'Total Income (Credit)')
  );
  t.equal(
    totalRow.cells[1]?.rawValue,
    50000,
    'P&L total row reconciles ₹50,000 income'
  );

  const invoiceDate = DateTime.fromISO('2025-05-05').toMillis();
  t.ok(
    invoiceDate >= range.fromDate.toMillis() &&
      invoiceDate < range.toDate.toMillis(),
    '5 May 2025 falls inside the selected fiscal-year range'
  );
  t.end();
});

test('synthetic #842: stock reports never receive non-finite valuation values', (t) => {
  const queue = new StockQueue();
  queue.value = 11.997499999999993 - 11.997500000000002;
  queue.quantity = 0;
  t.equal(queue.fifo, 0, 'negative zero quantity produces finite FIFO rate');
  t.equal(queue.inward(Infinity, 1), null, 'Infinity inward rate is rejected');
  t.equal(
    queue.inward(10, Infinity),
    null,
    'Infinity inward quantity is rejected'
  );

  const computed: ComputedStockLedgerEntry = {
    name: 1,
    date: new Date('2023-12-31'),
    item: 'Liquidated Item',
    location: 'Main',
    batch: '',
    serialNumber: '',
    quantity: 1,
    balanceQuantity: 0,
    incomingRate: 0,
    valuationRate: -Infinity,
    balanceValue: Infinity,
    valueChange: -Infinity,
    referenceName: 'SMOV-1001',
    referenceType: 'StockMovement',
  };
  const balances = getStockBalanceEntries([computed], {});
  const entry = balances[0];
  t.equal(entry.valuationRate, 0, 'Infinity valuation rate is bounded to zero');
  t.equal(entry.balanceValue, 0, 'Infinity balance value is bounded to zero');
  t.equal(entry.incomingValue, 0, 'Infinity value change is bounded to zero');
  t.ok(
    Number.isFinite(entry.balanceQuantity),
    'stock balance quantity remains finite'
  );
  t.end();
});

test('synthetic #1431: a sales item is discoverable for a pricing rule', (t) => {
  const items = [
    { name: 'Service Item', for: 'Sales', disabled: false },
    { name: 'Purchase Only', for: 'Purchase', disabled: false },
    { name: 'Disabled Item', for: 'Both', disabled: true },
  ];
  t.deepEqual(
    getPricingRuleItemCandidates(items),
    ['Service Item'],
    'one eligible sales item is offered for discount selection'
  );
  t.deepEqual(
    getPricingRuleItemCandidates(items, 'Purchase'),
    ['Purchase Only'],
    'direction-specific lookup does not fall back to another item'
  );
  t.end();
});

test('synthetic #1535: root groups can be recreated without weakening child constraints', (t) => {
  t.ok(
    isRootAccountRecreatable({
      setupComplete: true,
      rootType: 'Asset',
      isGroup: true,
      parentAccount: undefined,
    }),
    'explicit root group with a rootType can be recreated after setup'
  );
  t.notOk(
    isRootAccountRecreatable({
      setupComplete: true,
      rootType: 'Asset',
      isGroup: false,
      parentAccount: undefined,
    }),
    'non-group account still needs a parent'
  );
  t.notOk(
    isRootAccountRecreatable({
      setupComplete: true,
      rootType: 'Asset',
      isGroup: true,
      parentAccount: 'Assets',
    }),
    'child group still has a parent and is not a root'
  );
  t.notOk(
    isRootAccountRecreatable({
      setupComplete: false,
      rootType: 'Asset',
      isGroup: true,
      parentAccount: undefined,
    }),
    'initial setup path is unchanged'
  );
  t.end();
});
