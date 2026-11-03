import test from 'tape';
import {
  filterByComputedStatus,
  getStatusFilterConditions,
  matchesStatusFilter,
  splitComputedStatusFilter,
} from 'src/utils/statusFilters';
import { QueryFilter } from 'utils/db/types';

type StatusRow = { name: string; status: string };

const rows: StatusRow[] = [
  { name: 'A', status: 'Cancelled' },
  { name: 'B', status: 'Unpaid' },
  { name: 'C', status: 'PartlyPaid' },
  { name: 'D', status: '' },
];

const getStatus = (row: StatusRow) => row.status;
const names = (filtered: StatusRow[]) => filtered.map((row) => row.name);

function filter(filters: QueryFilter): StatusRow[] {
  const { statusConditions } = splitComputedStatusFilter(filters);
  return filterByComputedStatus(rows, statusConditions, getStatus);
}

test('computed status filter is removed before building a SQL query', (t) => {
  const filters = {
    status: ['not like', 'Cancelled'],
    party: 'Customer',
  } as QueryFilter;

  const { dbFilters, statusConditions } = splitComputedStatusFilter(filters);

  t.notOk('status' in dbFilters, 'computed status removed from db filters');
  t.equal(dbFilters.party, 'Customer', 'unrelated filters are preserved');
  t.deepEqual(
    statusConditions,
    [{ operator: 'not like', value: 'Cancelled' }],
    'status condition is kept for client-side filtering'
  );
  t.ok('status' in filters, 'input filters are not mutated');
  t.end();
});

test('computed status filters parse string and multi-condition values', (t) => {
  t.deepEqual(getStatusFilterConditions('Cancelled'), [
    { operator: '=', value: 'Cancelled' },
  ]);

  t.deepEqual(
    getStatusFilterConditions(['!=', 'Cancelled', 'not like', 'Paid']),
    [
      { operator: '!=', value: 'Cancelled' },
      { operator: 'not like', value: 'Paid' },
    ]
  );

  t.deepEqual(getStatusFilterConditions(undefined), []);
  t.end();
});

test('all computed status operators are applied client-side', (t) => {
  t.deepEqual(
    names(filter({ status: ['not like', 'Cancelled'] })),
    ['B', 'C', 'D'],
    'not like is handled instead of leaking into SQL'
  );

  t.deepEqual(
    names(filter({ status: ['like', 'paid'] })),
    ['B', 'C'],
    'like is a case-insensitive substring match'
  );

  t.deepEqual(
    names(filter({ status: ['not like', 'paid'] })),
    ['A', 'D'],
    'not like excludes substring matches'
  );

  t.deepEqual(names(filter({ status: 'Cancelled' })), ['A'], 'plain equality');
  t.deepEqual(
    names(filter({ status: ['=', 'cancelled'] })),
    ['A'],
    'equality is case-insensitive'
  );
  t.deepEqual(
    names(filter({ status: ['!=', 'Cancelled'] })),
    ['B', 'C', 'D'],
    'inequality'
  );
  t.deepEqual(
    names(filter({ status: ['in', ['Cancelled', 'Unpaid']] })),
    ['A', 'B'],
    'in'
  );
  t.deepEqual(
    names(filter({ status: ['not in', ['Cancelled', 'Unpaid']] })),
    ['C', 'D'],
    'not in'
  );
  t.deepEqual(names(filter({ status: ['is null', ''] })), ['D'], 'is null');
  t.deepEqual(
    names(filter({ status: ['is not null', ''] })),
    ['A', 'B', 'C'],
    'is not null'
  );
  t.end();
});

test('computed status filters combine conditions and ignore empty values', (t) => {
  t.deepEqual(
    names(filter({ status: ['!=', 'Cancelled', 'not like', 'paid'] })),
    ['D'],
    'multiple conditions are ANDed'
  );

  t.deepEqual(
    names(filter({ status: ['not like', ''] })),
    ['A', 'B', 'C', 'D'],
    'empty comparison value does not filter'
  );

  t.deepEqual(
    names(filter({ status: ['unknown operator', 'Cancelled'] })),
    ['A', 'B', 'C', 'D'],
    'unsupported operators do not drop rows'
  );

  t.deepEqual(names(filter({})), ['A', 'B', 'C', 'D'], 'no status filter');
  t.end();
});

test('matchesStatusFilter supports SQL-like wildcards', (t) => {
  t.ok(matchesStatusFilter('PartlyPaid', 'like', '%Paid'), 'trailing wildcard');
  t.ok(matchesStatusFilter('PartlyPaid', 'like', 'Part_y%'), 'underscore');
  t.notOk(matchesStatusFilter('Unpaid', 'not like', '%Paid'), 'not like');
  t.end();
});
