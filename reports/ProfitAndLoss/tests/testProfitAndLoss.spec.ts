import { t as translate } from 'fyo';
import { AccountRootTypeEnum } from 'models/baseModels/Account/types';
import { ProfitAndLoss } from 'reports/ProfitAndLoss/ProfitAndLoss';
import { AccountTreeNode, ReportData, ReportRow } from 'reports/types';
import test from 'tape';
import { closeTestFyo, getTestFyo } from 'tests/helpers';

const fyo = getTestFyo();
const report = new ProfitAndLoss(fyo);

const incomeRoot: AccountTreeNode = {
  name: 'Income',
  rootType: AccountRootTypeEnum.Income,
  isGroup: true,
  parentAccount: null,
};

const expenseRoot: AccountTreeNode = {
  name: 'Expense',
  rootType: AccountRootTypeEnum.Expense,
  isGroup: true,
  parentAccount: null,
};

function row(name: string): ReportRow {
  return {
    cells: [{ value: name, rawValue: name, align: 'left' }],
  };
}

const incomeRows: ReportData = [row('income')];
const expenseRows: ReportData = [row('expense')];
const calls: string[] = [];

report.getIncomeOrExpenseRows = ((_roots, rows, label) => {
  calls.push(`single:${label}`);
  return [...rows, row(label)];
}) as ProfitAndLoss['getIncomeOrExpenseRows'];

report.getIncomeAndExpenseRows = ((iRows, eRows) => {
  calls.push('both');
  return [...iRows, ...eRows, row('Total Profit')];
}) as ProfitAndLoss['getIncomeAndExpenseRows'];

test('P&L: income-only roots use the income total label', (t) => {
  calls.length = 0;
  const result = report.getReportDataFromRows(
    incomeRows,
    expenseRows,
    [incomeRoot],
    undefined
  );

  t.deepEqual(calls, [`single:${translate`Total Income (Credit)`}`]);
  t.equal(result.length, 2);
  t.end();
});

test('P&L: expense-only roots use the expense total label', (t) => {
  calls.length = 0;
  const result = report.getReportDataFromRows(
    incomeRows,
    expenseRows,
    undefined,
    [expenseRoot]
  );

  t.deepEqual(calls, [`single:${translate`Total Expense (Debit)`}`]);
  t.equal(result.length, 2);
  t.end();
});

test('P&L: empty expense roots do not throw and dispatch to the single branch', (t) => {
  calls.length = 0;
  const result = report.getReportDataFromRows(
    incomeRows,
    expenseRows,
    [incomeRoot],
    []
  );

  t.deepEqual(calls, [`single:${translate`Total Income (Credit)`}`]);
  t.equal(result.length, 2);
  t.end();
});

test('P&L: present income and expense roots use the combined branch', (t) => {
  calls.length = 0;
  const result = report.getReportDataFromRows(
    incomeRows,
    expenseRows,
    [incomeRoot],
    [expenseRoot]
  );

  t.deepEqual(calls, ['both']);
  t.equal(result.length, 3);
  t.end();
});

test('P&L: missing roots return an empty report without dispatching', (t) => {
  calls.length = 0;
  const result = report.getReportDataFromRows(
    incomeRows,
    expenseRows,
    undefined,
    undefined
  );

  t.deepEqual(calls, []);
  t.deepEqual(result, []);
  t.end();
});

closeTestFyo(fyo, __filename);
