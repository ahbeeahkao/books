import { QueryFilter } from 'utils/db/types';

/**
 * `status` is a computed list-column, not a database column. Every filter on
 * it has to be removed before `DatabaseCore.getAll` builds a SQL query.
 */
export const COMPUTED_STATUS_FIELD = 'status';

export type StatusFilterCondition = {
  operator: string;
  value: unknown;
};

export type SplitStatusFilter = {
  dbFilters: QueryFilter;
  statusConditions: StatusFilterCondition[];
};

export function splitComputedStatusFilter(
  filters: QueryFilter
): SplitStatusFilter {
  const dbFilters: QueryFilter = { ...filters };
  const statusConditions = getStatusFilterConditions(
    dbFilters[COMPUTED_STATUS_FIELD]
  );
  delete dbFilters[COMPUTED_STATUS_FIELD];

  return { dbFilters, statusConditions };
}

export function getStatusFilterConditions(
  value: unknown
): StatusFilterCondition[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return [{ operator: '=', value }];
  }

  const conditions: StatusFilterCondition[] = [];
  for (let i = 0; i < value.length; i += 2) {
    if (i + 1 >= value.length) {
      break;
    }

    conditions.push({
      operator: String(value[i] ?? '=').toLowerCase(),
      value: value[i + 1],
    });
  }

  return conditions;
}

export function filterByComputedStatus<T>(
  rows: T[],
  conditions: StatusFilterCondition[],
  getStatus: (row: T) => unknown
): T[] {
  const activeConditions = conditions.filter(({ operator, value }) => {
    if (operator === 'is null' || operator === 'is not null') {
      return true;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return value !== undefined && value !== null && value !== '';
  });

  if (!activeConditions.length) {
    return rows;
  }

  return rows.filter((row) => {
    const status = getStatus(row);
    return activeConditions.every(({ operator, value }) =>
      matchesStatusFilter(status, operator, value)
    );
  });
}

export function matchesStatusFilter(
  status: unknown,
  operatorInput: string,
  value: unknown
): boolean {
  const operator = normalizeOperator(operatorInput.toLowerCase());
  const actual = asString(status);
  const expected = asString(value);

  switch (operator) {
    case '=':
      return equals(actual, expected);
    case '!=':
      return !equals(actual, expected);
    case 'like':
      return buildLikePattern(expected).test(actual);
    case 'not like':
      return !buildLikePattern(expected).test(actual);
    case 'in':
      return asList(value).some((item) => equals(actual, asString(item)));
    case 'not in':
      return !asList(value).some((item) => equals(actual, asString(item)));
    case 'is null':
      return actual === '';
    case 'is not null':
      return actual !== '';
    case '>':
      return compare(actual, expected) > 0;
    case '>=':
      return compare(actual, expected) >= 0;
    case '<':
      return compare(actual, expected) < 0;
    case '<=':
      return compare(actual, expected) <= 0;
    default:
      return true;
  }
}

function normalizeOperator(operator: string): string {
  switch (operator) {
    case 'includes':
      return 'like';
    case '<>':
    case 'is not':
      return '!=';
    case 'is':
      return '=';
    default:
      return operator;
  }
}

function asString(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value);
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function equals(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function compare(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildLikePattern(value: string): RegExp {
  let pattern = escapeRegExp(value);
  if (!pattern.includes('%')) {
    pattern = `%${pattern}%`;
  }

  pattern = pattern.replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${pattern}$`, 'i');
}
