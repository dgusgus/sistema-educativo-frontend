<script setup lang="ts">
import { computed } from 'vue'
import { advertenciaCi } from '@/lib/ci'

const props = defineProps<{ modelValue: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const aviso = computed(() => advertenciaCi(props.modelValue))
</script>

<template>
  <input
    :value="modelValue"
    type="text"
    inputmode="text"
    autocomplete="off"
    class="input input-bordered w-full"
    :class="{ 'input-warning': aviso }"
    :disabled="disabled"
    :aria-invalid="aviso ? 'true' : undefined"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
  <p v-if="aviso" class="mt-1 text-xs text-warning" role="status">⚠ {{ aviso }}</p>
</template>