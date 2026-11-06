<template>
  <div
    class="
      px-2
      w-36
      flex
      items-center
      border
      rounded
      bg-gray-50
      dark:text-gray-200
      dark:border-gray-800
      dark:bg-gray-890
      dark:focus-within:bg-gray-900
      focus-within:bg-gray-100
    "
  >
    <input
      ref="scanner"
      type="text"
      class="text-base placeholder-gray-600 w-full bg-transparent outline-none"
      :placeholder="inputPlaceholder"
      @change="handleChange"
    />
    <feather-icon
      name="maximize"
      class="w-3 h-3 text-gray-600 dark:text-gray-400 cursor-text"
      @click="() => ($refs.scanner as HTMLInputElement).focus()"
    />
  </div>
</template>

<script lang="ts">
import {
  getBarcodeSettings,
  getMissingWeightBarcodeFields,
  getScannedItem,
  isBarcodeValue,
  WeightBarcodeField,
} from 'src/utils/barcodes';
import { showToast } from 'src/utils/interactive';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'Barcode',
  emits: ['item-selected'],
  props: {
    placeholder: { type: String, default: '' },
  },
  data() {
    return {
      timerId: null,
      barcode: '',
      cooldown: '',
    } as {
      timerId: null | ReturnType<typeof setTimeout>;
      barcode: string;
      cooldown: string;
    };
  },
  computed: {
    inputPlaceholder(): string {
      return this.placeholder || this.t`Enter barcode`;
    },
  },
  mounted() {
    document.addEventListener('keydown', this.scanListener);
  },
  unmounted() {
    document.removeEventListener('keydown', this.scanListener);
  },
  activated() {
    document.addEventListener('keydown', this.scanListener);
  },
  deactivated() {
    document.removeEventListener('keydown', this.scanListener);
  },
  methods: {
    handleChange(e: Event) {
      const elem = e.target as HTMLInputElement;
      void this.selectItem(elem.value);
      elem.value = '';
    },
    showMissingBarcodeSettings(): boolean {
      const missing = getMissingWeightBarcodeFields(
        getBarcodeSettings(this.fyo)
      );
      if (!missing.length) {
        return false;
      }

      const labels: Record<WeightBarcodeField, string> = {
        checkDigits: this.t`Check Digits`,
        itemCodeDigits: this.t`Item Code Digits`,
        itemWeightDigits: this.t`Item Weight Digits`,
      };
      const fields = missing.map((field) => labels[field]).join(', ');
      this.error(
        this.t`Configure ${fields} in POS Settings to scan weight barcodes.`
      );
      return true;
    },
    async selectItem(code: string) {
      const barcode = code.trim();
      if (!isBarcodeValue(barcode)) {
        return this.error(this.t`Invalid barcode value ${barcode}.`);
      }

      /**
       * Between two entries of the same item, this adds
       * a cooldown period of 100ms. This is to prevent
       * double entry.
       */
      if (this.cooldown === barcode) {
        return;
      }
      this.cooldown = barcode;
      setTimeout(() => (this.cooldown = ''), 100);

      const scanned = await getScannedItem(this.fyo, barcode);
      if (!scanned) {
        if (this.showMissingBarcodeSettings()) {
          return;
        }

        return this.error(this.t`Item with barcode ${barcode} not found.`);
      }

      const { item, quantity } = scanned;
      this.success(this.t`${item.name} quantity ${quantity} added.`);
      this.$emit('item-selected', item.name, quantity);
    },
    async scanListener({ key, code, target }: KeyboardEvent) {
      /**
       * Based under the assumption that
       * - Barcode scanners trigger keydown events
       * - Keydown events are triggered quicker than human can
       *    i.e. at max 20ms between events
       * - Keydown events are triggered for barcode digits
       * - The sequence of digits might be punctuated by a return
       */
      const isEnter = code === 'Enter';
      if (!isEnter && this.isTypingTarget(target)) {
        return;
      }

      if (!isEnter && (key.length !== 1 || /\s/.test(key))) {
        return;
      }

      if (isEnter) {
        return await this.setItemFromBarcode();
      }

      this.clearInterval();

      this.barcode += key;
      this.timerId = setTimeout(async () => {
        await this.setItemFromBarcode();
        this.barcode = '';
      }, 20);
    },
    isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
        target.isContentEditable
      );
    },
    async setItemFromBarcode() {
      if (!this.barcode.trim()) {
        return;
      }

      await this.selectItem(this.barcode);

      this.barcode = '';
      this.clearInterval();
    },
    clearInterval() {
      if (this.timerId === null) {
        return;
      }

      clearInterval(this.timerId);
      this.timerId = null;
    },
    error(message: string) {
      showToast({ type: 'error', message });
    },
    success(message: string) {
      showToast({ type: 'success', message });
    },
  },
});
</script>
