import { ModelNameEnum } from 'models/types';
import type { Schema, SchemaMap } from 'schemas/types';

/**
 * Per-company-DB customizations stay as data in `CustomField`; they are not
 * promoted into static `schemas/app/*.json` files. These exclusions keep child
 * rows and internal DocTypes out of the Customize Form parent selector and the
 * Custom Field Link/Table target list.
 */
export const EXCLUDED_CUSTOM_FORM_SCHEMAS = new Set<string>([
  ModelNameEnum.ItemBarcode,
  ModelNameEnum.CustomField,
  ModelNameEnum.CustomForm,
  ModelNameEnum.NumberSeries,
  ModelNameEnum.PatchRun,
  ModelNameEnum.SingleValue,
  ModelNameEnum.SetupWizard,
]);

export function isCustomizableSchema(schema?: Schema | null): boolean {
  if (!schema) {
    return false;
  }

  return (
    !schema.isSingle &&
    !schema.isChild &&
    !EXCLUDED_CUSTOM_FORM_SCHEMAS.has(schema.name)
  );
}

export function getCustomizableSchemas(schemaMap: Readonly<SchemaMap>) {
  return Object.values(schemaMap)
    .filter((schema) => isCustomizableSchema(schema))
    .map((schema) => ({
      label: schema?.label ?? '',
      value: schema?.name ?? '',
    }));
}
