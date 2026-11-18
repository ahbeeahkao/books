import { Report } from 'reports/Report';
import { ColumnField, ReportData, ReportRow } from 'reports/types';
import { FieldTypeEnum } from 'schemas/types';

export type CustomFilterOperator =
  | '='
  | '!='
  | 'contains'
  | '>'
  | '<'
  | '>='
  | '<=';

export interface CustomReportColumn {
  fieldname: string;
  label: string;
  fieldtype?: FieldTypeEnum;
  width?: number;
}

export interface CustomReportFilter {
  fieldname: string;
  operator: CustomFilterOperator;
  value: string | number | boolean;
}

export function parseCustomColumns(json?: string): CustomReportColumn[] {
  if (!json?.trim()) {
    return [
      { fieldname: 'name', label: 'Name', fieldtype: FieldTypeEnum.Data },
    ];
  }
  try {
    const parsed = JSON.parse(json) as CustomReportColumn[];
    return Array.isArray(parsed) && parsed.length
      ? parsed
      : [{ fieldname: 'name', label: 'Name', fieldtype: FieldTypeEnum.Data }];
  } catch {
    return [
      { fieldname: 'name', label: 'Name', fieldtype: FieldTypeEnum.Data },
    ];
  }
}

export function parseCustomFilters(json?: string): CustomReportFilter[] {
  if (!json?.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(json) as CustomReportFilter[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function applyCustomFilters<T extends Record<string, unknown>>(
  rows: T[],
  filters: CustomReportFilter[]
): T[] {
  if (!filters.length) {
    return rows;
  }

  return rows.filter((row) =>
    filters.every((filter) => {
      const raw = row[filter.fieldname];
      const target = filter.value;

      switch (filter.operator) {
        case '=':
          return String(raw ?? '') === String(target ?? '');
        case '!=':
          return String(raw ?? '') !== String(target ?? '');
        case 'contains':
          return String(raw ?? '')
            .toLowerCase()
            .includes(String(target ?? '').toLowerCase());
        case '>':
          return Number(raw) > Number(target);
        case '<':
          return Number(raw) < Number(target);
        case '>=':
          return Number(raw) >= Number(target);
        case '<=':
          return Number(raw) <= Number(target);
        default:
          return true;
      }
    })
  );
}

export class CustomReport extends Report {
  static title = 'Custom Report';
  static reportName = 'custom-report';
  static isInventory = false;

  baseModel = 'SalesInvoice';
  columnsJson = '';
  filtersJson = '';
  sortBy = '';
  sortOrder: 'asc' | 'desc' = 'desc';

  setColumns(): void {
    const cols = parseCustomColumns(this.columnsJson);
    this.columns = cols.map(
      (col): ColumnField => ({
        fieldname: col.fieldname,
        label: col.label || col.fieldname,
        fieldtype: col.fieldtype ?? FieldTypeEnum.Data,
        width: col.width ?? 1.5,
      })
    );
  }

  async setReportData(): Promise<void> {
    this.setColumns();
    const fields = this.columns.map((c) => c.fieldname);
    const rows = (await this.fyo.db.getAll(this.baseModel, {
      fields,
      orderBy: this.sortBy || undefined,
      order: this.sortOrder,
    })) as unknown as Record<string, unknown>[];

    const filters = parseCustomFilters(this.filtersJson);
    const filtered = applyCustomFilters(rows, filters);

    this.reportData = filtered.map((row) => {
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      const cells: {
        rawValue: string | number | boolean | null;
        value: string;
      }[] = this.columns.map((col) => {
        const val = row[col.fieldname] as
          | string
          | number
          | boolean
          | null
          | undefined;
        return {
          rawValue: val ?? null,
          value: String(val ?? ''),
        };
      });
      return { cells } as unknown as ReportRow;
    }) as ReportData;
  }
}
