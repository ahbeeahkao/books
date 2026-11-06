import fs from 'fs';
import os from 'os';
import path from 'path';
import test from 'tape';
import { CustomField } from 'fyo/models/CustomField';
import { CustomForm } from 'fyo/models/CustomForm';
import { getSchemas } from 'schemas';
import { getRandomString } from 'utils';
import { getCustomizableSchemas } from 'src/utils/customForm';
import { DatabaseManager } from '../manager';

test('Customize Form targets exclude child and internal schemas', (t) => {
  const schemaMap = getSchemas('-', []);
  const options = getCustomizableSchemas(schemaMap);
  const values = options.map((option) => option.value);

  for (const excluded of [
    'ItemBarcode',
    'CustomField',
    'CustomForm',
    'NumberSeries',
    'PatchRun',
    'SingleValue',
    'SetupWizard',
  ]) {
    t.notOk(values.includes(excluded), `${excluded} is not customizable`);
  }

  t.ok(values.includes('Item'), 'Item remains customizable');

  const doc = { fyo: { schemaMap } } as never;
  t.deepEqual(
    CustomField.lists.target!(doc),
    options,
    'Custom Field target list uses the same exclusions'
  );
  t.deepEqual(
    CustomForm.lists.name!(doc),
    options,
    'Custom Form name list uses the same exclusions'
  );
  t.end();
});

test('CustomField rows remain per-DB data through connect and migrate', async (t) => {
  const dbPath = path.join(
    os.tmpdir(),
    `cp5-custom-fields-${getRandomString()}.db`
  );
  const customFieldName = 'cf-nickname';
  const dm = new DatabaseManager();

  try {
    await dm.createNewDatabase(dbPath, '-');

    await dm.db!.knex!('CustomField').insert({
      name: customFieldName,
      label: 'Nickname',
      fieldname: 'nickname',
      fieldtype: 'Data',
      isRequired: 0,
      default: null,
      section: 'Default',
      tab: 'Custom',
      options: null,
      target: null,
      references: null,
      idx: 0,
      parent: 'Item',
      parentSchemaName: 'CustomForm',
      parentFieldname: 'customFields',
    });

    await dm.db!.close();
    await dm.connectToDatabase(dbPath, '-');
    await dm.db!.migrate();

    const rows = (await dm.db!.knex!('CustomField')
      .where({ name: customFieldName })
      .select()) as { parent: string; fieldname: string }[];
    t.equal(rows.length, 1, 'custom field row survives reconnect and migrate');
    t.equal(rows[0]?.parent, 'Item', 'custom field remains scoped to Item');
    t.equal(rows[0]?.fieldname, 'nickname', 'custom field name is preserved');

    t.ok(
      dm.rawCustomFields.some((field) => field.fieldname === 'nickname'),
      'raw custom fields are loaded from the company DB'
    );

    const runtimeField = dm
      .getSchemaMap()
      .Item?.fields.find((field) => field.fieldname === 'nickname');
    t.ok(runtimeField, 'custom field is merged into the runtime schema map');
    t.equal(runtimeField?.isCustom, true, 'runtime field is marked custom');

    const staticField = getSchemas('-', []).Item?.fields.find(
      (field) => field.fieldname === 'nickname'
    );
    t.notOk(staticField, 'custom field is not promoted into static schemas');
  } finally {
    await dm.db?.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  }

  t.end();
});
