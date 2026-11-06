<template>
  <Barcode
    :placeholder="t`Enter weight barcode`"
    :unit="unit"
    @item-selected="forwardItemSelected"
  />
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import Barcode from './Barcode.vue';

/**
 * Thin wrapper for the weight-barcode label. The shared Barcode control reads
 * the POS Settings, UOM details and item conversion factors itself, so both
 * plain and weight scans use one parser and one always-focused input rather
 * than two competing scanner listeners.
 */
export default defineComponent({
  name: 'WeightEnabledBarcode',
  components: { Barcode },
  emits: ['item-selected'],
  props: {
    unit: { type: String, default: '' },
  },
  methods: {
    forwardItemSelected(name: string, quantity: number) {
      this.$emit('item-selected', name, quantity);
    },
  },
});
</script>
