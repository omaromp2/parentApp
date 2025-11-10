<!-- <template>
    <div>
        <h1>Hello World</h1>
        <UFileUpload multiple class="w-96 min-h-48 ml-42 mb-10" />
        <stepper />
    </div>
</template>

<script setup lang="ts">
import stepper from './stepper.vue';

</script>

<style lang="scss" scoped></style> -->

<!-- pages/index.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useUploader } from '~/composables/useUploader'

const {
    file, uploading, progress, status, summary, error, validationErrors, docId,
    justUploaded, showStatus,
    selectFile, upload, reset, cancel, toggleStatus
} = useUploader()

const allow = '.pdf,.png,.jpg,.jpeg'
const isOver = ref(false)

function onInput(e: Event) {
    const target = e.target as HTMLInputElement
    selectFile(target.files?.[0] ?? null)
}
function onDrop(e: DragEvent) {
    isOver.value = false
    const f = e.dataTransfer?.files?.[0]
    if (f) selectFile(f)
}
function onDragOver(e: DragEvent) { isOver.value = true }
function onDragLeave() { isOver.value = false }
</script>

<template>
    <UPage>
        <UPageHeader title="Paystub Upload"
            description="Upload finishes instantly — processing continues in the background." />

        <UPageBody>
            <UContainer>

                <!-- Zod validation errors -->
                <UAlert v-if="validationErrors.length" color="orange" variant="subtle" title="Please fix the following"
                    class="mb-4">
                    <ul class="list-disc pl-5 mt-2 space-y-1 text-sm">
                        <li v-for="(msg, i) in validationErrors" :key="i">{{ msg }}</li>
                    </ul>
                </UAlert>

                <!-- ✅ Instant success banner after upload -->
                <UAlert v-if="justUploaded" color="green" variant="soft" icon="i-heroicons-check-badge"
                    title="Upload finished" class="mb-4">
                    <template #description>
                        We’re processing your document in the background.<br />
                        <span class="text-xs opacity-80">ID: {{ docId }}</span>
                    </template>
                    <template #actions>
                        <UButton size="xs" color="primary" variant="solid" @click="toggleStatus">
                            {{ showStatus ? 'Hide status' : 'Check status' }}
                        </UButton>
                        <UButton size="xs" variant="ghost" @click="reset">
                            Upload another
                        </UButton>
                    </template>
                </UAlert>

                <!-- Upload Card -->
                <UCard>
                    <template #header>
                        <div class="flex items-center justify-between">
                            <div class="text-lg font-semibold">Upload</div>
                            <UBadge v-if="status" color="primary" variant="solid">Status: {{ status }}</UBadge>
                        </div>
                    </template>

                    <!-- Drop zone -->
                    <div class="border border-dashed rounded-lg p-6 text-center transition-all"
                        :class="isOver ? 'border-primary-500 bg-primary-50/30 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-700'"
                        @drop.prevent="onDrop" @dragover.prevent="onDragOver" @dragleave.prevent="onDragLeave">
                        <div class="text-sm opacity-80 mb-3">Drag & drop your paystub here</div>

                        <UButton size="sm" color="primary" variant="solid" @click="$refs.fileInput.click()">
                            Choose file
                        </UButton>

                        <input ref="fileInput" type="file" class="hidden" :accept="allow" @change="onInput" />

                        <div v-if="file" class="mt-3 text-sm text-gray-600 dark:text-gray-300">
                            Selected: <span class="font-medium">{{ file.name }}</span>
                        </div>
                        <div class="mt-1 text-xs text-gray-500">Accepted: PDF, PNG, JPG (≤ 8 MB)</div>
                    </div>

                    <div class="mt-4 flex gap-3">
                        <UButton :disabled="!file || uploading" :loading="uploading" color="emerald" @click="upload">
                            {{ uploading ? 'Uploading…' : 'Upload' }}
                        </UButton>
                        <UButton variant="ghost" @click="reset">Reset</UButton>
                    </div>

                    <div v-if="uploading" class="mt-4">
                        <UProgress :value="progress" />
                        <div class="text-xs mt-1">{{ progress }}%</div>
                    </div>

                    <UAlert v-if="error" class="mt-4" color="red" variant="soft" title="Error" :description="error" />
                </UCard>

                <!-- Optional non-blocking status panel -->
                <UCard v-if="showStatus && status && status !== 'done' && status !== 'failed'" class="mt-4">
                    <div class="flex items-center gap-3">
                        <UIcon name="i-heroicons-arrow-path-20-solid" class="animate-spin h-5 w-5" />
                        <div class="font-medium">Processing in background…</div>
                    </div>
                    <p class="text-sm text-gray-500 mt-1">
                        You can navigate away — we’ll keep working. Open this panel anytime to refresh the status.
                    </p>
                    <div class="mt-3 flex gap-3">
                        <UButton color="gray" variant="ghost" @click="toggleStatus">Hide</UButton>
                        <UButton color="gray" variant="ghost" @click="cancel">Stop polling</UButton>
                    </div>
                </UCard>

                <!-- Summary appears when ready -->
                <UCard class="mt-6" v-if="status === 'done' && summary">
                    <template #header>
                        <div class="flex items-center justify-between">
                            <div class="text-lg font-semibold">Summary</div>
                            <UBadge color="primary" variant="solid">Ready</UBadge>
                        </div>
                    </template>

                    <div v-if="summary.headline" class="mb-2 text-base font-medium">
                        {{ summary.headline }}
                    </div>

                    <div v-if="summary.fields">
                        <UTable :rows="Object.entries(summary.fields).map(([field, value]) => ({ field, value }))"
                            :columns="[
                                { key: 'field', label: 'Field' },
                                { key: 'value', label: 'Value' }
                            ]" />
                    </div>
                    <div v-else>
                        <pre class="text-sm">{{ summary }}</pre>
                    </div>

                    <div class="mt-4">
                        <UButton @click="reset">Upload another</UButton>
                    </div>
                </UCard>

                <UAlert v-if="status === 'failed'" color="red" variant="soft" title="Processing failed" class="mt-4" />

            </UContainer>
        </UPageBody>
    </UPage>
</template>
