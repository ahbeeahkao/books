<template>
  <div class="flex flex-col h-full bg-white dark:bg-gray-900">
    <PageHeader :title="t`Custom Report Builder`">
      <Button type="primary" @click="runReport">
        {{ t`Run Report` }}
      </Button>
      <Button @click="saveReport">
        {{ t`Save` }}
      </Button>
    </PageHeader>

    <div class="p-4 grid grid-cols-12 gap-4 overflow-auto flex-1">
      <div class="col-span-4 space-y-4 border-r dark:border-gray-800 pr-4">
        <div v-if="savedReports.length">
          <label class="block text-sm font-medium mb-1 dark:text-gray-200">
            {{ t`Load Saved Report` }}
          </label>
          <select
            v-model="selectedSavedReport"
            class="w-full px-3 py-1.5 text-sm border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            @change="loadSavedReport"
          >
            <option value="">{{ t`Select a saved report...` }}</option>
            <option v-for="r in savedReports" :key="r.name" :value="r.name">
              {{ r.title || r.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-200">
            {{ t`Report Title` }}
          </label>
          <input
            v-model="title"
            type="text"
            class="w-full px-3 py-1.5 text-sm border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            :placeholder="t`My Custom Report`"
          />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-200">
            {{ t`Base Document` }}
          </label>
          <select
            v-model="baseModel"
            class="w-full px-3 py-1.5 text-sm border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          >
            <option v-for="m in baseModels" :key="m" :value="m">
              {{ m }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1 dark:text-gray-200">
            {{ t`Columns` }}
          </label>
          <div
            class="max-h-48 overflow-y-auto border rounded p-2 space-y-1 dark:border-gray-700"
          >
            <label
              v-for="field in availableFields"
              :key="field.fieldname"
              class="flex items-center gap-2 text-sm dark:text-gray-200"
            >
              <input
                v-model="selectedFieldnames"
                type="checkbox"
                :value="field.fieldname"
              />
              <span>{{ field.label || field.fieldname }}</span>
            </label>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-sm font-medium dark:text-gray-200">
              {{ t`Filters` }}
            </label>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="text-xs text-gray-600 dark:text-gray-300 hover:underline"
                @click="applyDatePreset('thisMonth')"
              >
                {{ t`This Month` }}
              </button>
              <button
                type="button"
                class="text-xs text-gray-600 dark:text-gray-300 hover:underline"
                @click="applyDatePreset('thisYear')"
              >
                {{ t`This Year` }}
              </button>
              <button
                type="button"
                class="text-xs text-blue-600 hover:underline"
                @click="addFilter"
              >
                + {{ t`Add Filter` }}
              </button>
            </div>
          </div>
          <div v-for="(f, idx) in filters" :key="idx" class="flex gap-1 mb-2">
            <select
              v-model="f.fieldname"
              class="w-1/3 px-1.5 py-1 text-xs border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            >
              <option
                v-for="field in availableFields"
                :key="field.fieldname"
                :value="field.fieldname"
              >
                {{ field.label || field.fieldname }}
              </option>
            </select>
            <select
              v-model="f.operator"
              class="w-1/4 px-1.5 py-1 text-xs border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            >
              <option v-for="op in operators" :key="op" :value="op">
                {{ op }}
              </option>
            </select>
            <input
              v-model="f.value"
              type="text"
              class="w-1/3 px-1.5 py-1 text-xs border rounded dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
            />
            <button
              type="button"
              class="text-xs text-red-500 px-1"
              @click="filters.splice(idx, 1)"
            >
              ×
            </button>
          </div>
        </div>
      </div>

      <div class="col-span-8 overflow-auto">
        <table
          v-if="rows.length"
          class="w-full text-sm border-collapse border dark:border-gray-700"
        >
          <thead>
            <tr class="bg-gray-50 dark:bg-gray-800">
              <th
                v-for="col in activeColumns"
                :key="col.fieldname"
                class="text-left p-2 border dark:border-gray-700 font-medium dark:text-gray-200"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, rIdx) in rows"
              :key="rIdx"
              class="hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <td
                v-for="col in activeColumns"
                :key="col.fieldname"
                class="p-2 border dark:border-gray-700 dark:text-gray-300"
              >
                {{ row[col.fieldname] ?? '' }}
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else class="text-sm text-gray-500 dark:text-gray-400">
          {{ t`Select columns and click Run Report to preview results.` }}
        </p>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import PageHeader from 'src/components/PageHeader.vue';
import Button from 'src/components/Button.vue';
import { fyo } from 'src/initFyo';
import { showToast } from 'src/utils/interactive';
import { ModelNameEnum } from 'models/types';
import {
  applyCustomFilters,
  CustomFilterOperator,
  CustomReportFilter,
  parseCustomColumns,
  parseCustomFilters,
} from 'reports/CustomReport';

export default defineComponent({
  name: 'CustomReportBuilder',
  components: { PageHeader, Button },
  data() {
    return {
      title: 'My Custom Report',
      baseModel: 'SalesInvoice',
      baseModels: [
        'SalesInvoice',
        'PurchaseInvoice',
        'Payment',
        'JournalEntry',
        'Account',
        'Item',
        'Party',
      ],
      selectedFieldnames: ['name'] as string[],
      filters: [] as CustomReportFilter[],
      operators: [
        '=',
        '!=',
        'contains',
        '>',
        '<',
        '>=',
        '<=',
      ] as CustomFilterOperator[],
      rows: [] as Record<string, unknown>[],
      savedReports: [] as {
        name: string;
        title?: string;
        baseModel?: string;
        columnsJson?: string;
        filtersJson?: string;
      }[],
      selectedSavedReport: '',
    };
  },
  async mounted() {
    await this.fetchSavedReports();
  },
  computed: {
    availableFields() {
      const schema = fyo.schemaMap[this.baseModel];
      return (schema?.fields ?? []).filter(
        (f) => f.fieldname !== 'name' || true
      );
    },
    activeColumns() {
      return this.selectedFieldnames.map((fieldname) => {
        const field = this.availableFields.find(
          (f) => f.fieldname === fieldname
        );
        return {
          fieldname,
          label: field?.label || fieldname,
        };
      });
    },
  },
  watch: {
    baseModel() {
      this.selectedFieldnames = ['name'];
      this.filters = [];
      this.rows = [];
    },
  },
  methods: {
    async fetchSavedReports() {
      this.savedReports = (await fyo.db.getAll(ModelNameEnum.CustomReport, {
        fields: ['name', 'title', 'baseModel', 'columnsJson', 'filtersJson'],
      })) as {
        name: string;
        title?: string;
        baseModel?: string;
        columnsJson?: string;
        filtersJson?: string;
      }[];
    },
    loadSavedReport() {
      const report = this.savedReports.find(
        (r) => r.name === this.selectedSavedReport
      );
      if (!report) {
        return;
      }
      this.title = report.title || report.name;
      if (report.baseModel) {
        this.baseModel = report.baseModel;
      }
      this.selectedFieldnames = parseCustomColumns(report.columnsJson).map(
        (c) => c.fieldname
      );
      this.filters = parseCustomFilters(report.filtersJson);
    },
    applyDatePreset(preset: 'thisMonth' | 'thisYear') {
      const now = new Date();
      const start =
        preset === 'thisMonth'
          ? new Date(now.getFullYear(), now.getMonth(), 1)
          : new Date(now.getFullYear(), 0, 1);
      const startIso = start.toISOString().slice(0, 10);
      const endIso = now.toISOString().slice(0, 10);
      this.filters = [
        ...this.filters.filter((f) => f.fieldname !== 'date'),
        { fieldname: 'date', operator: '>=', value: startIso },
        { fieldname: 'date', operator: '<=', value: endIso },
      ];
    },
    addFilter() {
      this.filters.push({
        fieldname: this.availableFields[0]?.fieldname ?? 'name',
        operator: '=',
        value: '',
      });
    },
    async runReport() {
      const fields = this.selectedFieldnames.length
        ? this.selectedFieldnames
        : ['name'];
      const raw = (await fyo.db.getAll(this.baseModel, {
        fields,
      })) as Record<string, unknown>[];
      this.rows = applyCustomFilters(raw, this.filters);
    },
    async saveReport() {
      try {
        const doc = fyo.doc.getNewDoc(ModelNameEnum.CustomReport, {
          title: this.title || 'Custom Report',
          baseModel: this.baseModel,
          columnsJson: JSON.stringify(this.activeColumns),
          filtersJson: JSON.stringify(this.filters),
        });
        await doc.sync();
        showToast({ type: 'success', message: this.t`Custom Report saved.` });
      } catch (err) {
        showToast({ type: 'error', message: String(err) });
      }
    },
  },
});
</script>
