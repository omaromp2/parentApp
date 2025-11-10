<script setup lang="ts">
import type { StepperItem } from '@nuxt/ui'

const items = ref<StepperItem[]>([
    {
        title: 'File Selection',
        description: 'Select payment stub files',
        icon: 'i-lucide-house'
    },
    {
        title: 'Shipping',
        description: 'Set your preferred shipping method',
        icon: 'i-lucide-truck'
    },
    {
        title: 'Checkout',
        description: 'Confirm your order'
    }
])
</script>

<template>
    <UStepper :items="items" class="w-full" />
</template>
