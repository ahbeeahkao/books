import test from 'tape';
import {
  applyCustomFilters,
  parseCustomColumns,
  parseCustomFilters,
} from '../reports/CustomReport';

test('parseCustomColumns and parseCustomFilters handle valid and empty JSON', (t) => {
  const defaultCols = parseCustomColumns('');
  t.equal(defaultCols[0].fieldname, 'name', 'falls back to name column');

  const parsedCols = parseCustomColumns(
    JSON.stringify([{ fieldname: 'party', label: 'Customer' }])
  );
  t.equal(parsedCols[0].fieldname, 'party', 'parses custom columns');

  t.deepEqual(parseCustomFilters('invalid'), [], 'returns [] on invalid JSON');
  t.end();
});

test('applyCustomFilters supports =, !=, contains, >, <, >=, <=', (t) => {
  const rows = [
    { name: 'SINV-1', party: 'Acme Corp', grandTotal: 100, submitted: true },
    { name: 'SINV-2', party: 'Beta LLC', grandTotal: 250, submitted: false },
    { name: 'SINV-3', party: 'Acme Retail', grandTotal: 500, submitted: true },
  ];

  t.equal(
    applyCustomFilters(rows, [
      { fieldname: 'party', operator: 'contains', value: 'acme' },
    ]).length,
    2,
    'contains is case-insensitive'
  );

  t.equal(
    applyCustomFilters(rows, [
      { fieldname: 'grandTotal', operator: '>=', value: 250 },
    ]).length,
    2,
    '>= filters numeric values'
  );

  t.equal(
    applyCustomFilters(rows, [
      { fieldname: 'submitted', operator: '=', value: true },
      { fieldname: 'grandTotal', operator: '<', value: 200 },
    ]).length,
    1,
    'combines multiple filters with AND'
  );

  t.end();
});
