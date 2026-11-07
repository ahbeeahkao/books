<script setup lang="ts">
import { showSidebar } from 'src/utils/refs';
import { toggleSidebar } from 'src/utils/ui';
</script>
<template>
  <div class="flex overflow-hidden">
    <Transition name="sidebar">
      <!-- eslint-disable vue/require-explicit-emits -->
      <Sidebar
        v-show="showSidebar"
        class="
          flex-shrink-0
          border-e
          dark:border-gray-800
          whitespace-nowrap
          w-sidebar
        "
        :dark-mode="darkMode"
        @change-db-file="$emit('change-db-file')"
      />
    </Transition>

    <div
      class="
        flex flex-1
        overflow-y-hidden
        custom-scroll custom-scroll-thumb1
        bg-white
        dark:bg-gray-875
      "
    >
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component
            :is="Component"
            :key="$route.path"
            :dark-mode="darkMode"
            class="flex-1"
          />
        </keep-alive>
      </router-view>

      <router-view v-slot="{ Component, route }" name="edit">
        <Transition name="quickedit">
          <div v-if="route?.query?.edit">
            <component
              :is="Component"
              :key="route.query.schemaName + route.query.name"
              :dark-mode="darkMode"
            />
          </div>
        </Transition>
      </router-view>
    </div>

    <!-- Show Sidebar Button -->
    <button
      v-show="!showSidebar"
      data-testid="show-sidebar"
      class="
        absolute
        bottom-0
        start-0
        flex
        items-center
        gap-2
        text-gray-700
        dark:text-gray-200
        bg-gray-100
        dark:bg-gray-800
        border border-gray-200
        dark:border-gray-700
        hover:bg-gray-200
        dark:hover:bg-gray-700
        rounded
        shadow-sm
        p-2
        m-4
        opacity-100
        focus:outline-none focus:ring-2 focus:ring-blue-500
      "
      :aria-label="t`Show Sidebar`"
      :title="t`Show Sidebar`"
      @click="() => toggleSidebar()"
    >
      <feather-icon
        name="chevrons-right"
        class="w-4 h-4 flex-shrink-0 rtl-rotate-180"
      />
      <span class="text-sm font-medium">{{ t`Show Sidebar` }}</span>
    </button>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import Sidebar from '../components/Sidebar.vue';
export default defineComponent({
  name: 'Desk',
  components: {
    Sidebar,
  },
  props: {
    darkMode: { type: Boolean, default: false },
  },
  emits: ['change-db-file'],
});
</script>

<style scoped>
.sidebar-enter-from,
.sidebar-leave-to {
  opacity: 0;
  transform: translateX(calc(-1 * var(--w-sidebar)));
  width: 0px;
}
[dir='rtl'] .sidebar-leave-to {
  opacity: 0;
  transform: translateX(calc(1 * var(--w-sidebar)));
  width: 0px;
}

.sidebar-enter-to,
.sidebar-leave-from {
  opacity: 1;
  transform: translateX(0px);
  width: var(--w-sidebar);
}

.sidebar-enter-active,
.sidebar-leave-active {
  transition: all 150ms ease-out;
}
</style>
