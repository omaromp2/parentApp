<script setup lang="ts">
import { ref, computed, unref } from "vue";
// import { useToast } from "@nuxt/ui";
import { useUploader } from "~/composables/useUploader";

const {
    file,
    uploading,
    progress,
    status,
    summary,
    error,
    validationErrors,
    docId,
    justUploaded,
    showStatus,
    selectFile,
    upload,
    reset,
    cancel,
    toggleStatus,
} = useUploader();

const toast = useToast();

/** Accept for Nuxt UI Pro FileUpload */
const accept = "application/pdf,image/png,image/jpeg";

/** v-model for <UFileUpload> — always an array so user can pick one or many */
const files = ref<File[]>([]);

/** Queue items keep the File reference to avoid lookup failures */
type ItemState = "queued" | "uploading" | "uploaded" | "failed";
type LocalItem = {
    file: File;
    name: string;
    size: number;
    type: string;
    state: ItemState;
    serverId?: number | string;
    error?: string;
};
const queue = ref<LocalItem[]>([]);

const totalQueued = computed(
    () => queue.value.filter((i) => i.state === "queued").length,
);
const totalUploaded = computed(
    () => queue.value.filter((i) => i.state === "uploaded").length,
);
const totalFailed = computed(
    () => queue.value.filter((i) => i.state === "failed").length,
);

const currentStep = computed(() => {
    if (status === "done") return 4;
    if (uploading || status === "processing") return 3;
    if (queue.value.length || file) return 2;
    return 1;
});

function humanSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Add selected file(s) to queue; keep File object to avoid later mismatches */
function onSelect(payload: File[] | null | undefined) {
    const list = payload ?? [];
    if (!list.length) return;

    for (const f of list) {
        queue.value.push({
            file: f,
            name: f.name,
            size: f.size,
            type: f.type,
            state: "queued",
        });
    }
    // Keep `files` so user can batch-upload; we clear after batch finishes.
}

/** Upload ONE item (single-file flow). Safe even if there are many queued. */
async function uploadOne(item?: LocalItem) {
    if (uploading.value) return; // guard: your composable is single-flight
    const target = item ?? queue.value.find((q) => q.state === "queued");
    if (!target) return;

    // Bridge to your composable
    selectFile(target.file);
    target.state = "uploading";
    target.error = undefined;

    try {
        await upload(); // your existing POST + progress + status kickoff
        target.state = "uploaded";
        target.serverId = unref(docId);
    } catch (e: any) {
        target.state = "failed";
        target.error = e?.message || "Upload failed";
    }
}

/** Upload ALL queued items sequentially (multi-file flow). */
async function uploadAll() {
    const pending = queue.value.filter(
        (q) => q.state === "queued" || q.state === "failed",
    );
    if (!pending.length) return;

    for (const item of pending) {
        // If a previous attempt failed, treat Retry in batch as well:
        if (item.state === "failed") {
            item.state = "queued";
            item.error = undefined;
        }
        await uploadOne(item);
    }

    // Clear `files` so same files can be re-selected later
    files.value = [];

    toast.add({
        title: "Uploads complete",
        description: `${totalUploaded.value} succeeded, ${totalFailed.value} failed.`,
        color: totalFailed.value ? "orange" : "green",
        icon: totalFailed.value
            ? "i-lucide-alert-triangle"
            : "i-lucide-check-circle-2",
    });
}

/** Retry a failed item */
async function retryItem(item: LocalItem) {
    if (item.state !== "failed" || uploading.value) return;
    item.state = "queued";
    item.error = undefined;
    await uploadOne(item);
}

/** Remove an item (only if not currently uploading) */
function removeItem(item: LocalItem) {
    if (item.state === "uploading") return;
    const idx = queue.value.indexOf(item);
    if (idx >= 0) queue.value.splice(idx, 1);
}

/** Full reset (queue + uploader state) */
function resetAll() {
    queue.value = [];
    files.value = [];
    reset();
}
</script>

<template>
    <UPage>
        <UPageHeader
            title="Paystub Upload"
            description="Pick one file or many — upload instantly and let processing finish in the background."
        >
            <template #bottom>
                <div class="flex items-center gap-2 text-sm">
                    <div
                        class="flex items-center gap-2"
                        :class="currentStep >= 1 ? 'opacity-100' : 'opacity-50'"
                    >
                        <UIcon name="i-lucide-folder-input" />
                        <span>1. Select</span>
                    </div>
                    <UIcon name="i-lucide-chevrons-right" class="opacity-50" />
                    <div
                        class="flex items-center gap-2"
                        :class="currentStep >= 2 ? 'opacity-100' : 'opacity-50'"
                    >
                        <UIcon name="i-lucide-list-plus" />
                        <span>2. Queue</span>
                    </div>
                    <UIcon name="i-lucide-chevrons-right" class="opacity-50" />
                    <div
                        class="flex items-center gap-2"
                        :class="currentStep >= 3 ? 'opacity-100' : 'opacity-50'"
                    >
                        <UIcon name="i-lucide-upload" />
                        <span>3. Upload & Process</span>
                    </div>
                    <UIcon name="i-lucide-chevrons-right" class="opacity-50" />
                    <div
                        class="flex items-center gap-2"
                        :class="currentStep >= 4 ? 'opacity-100' : 'opacity-50'"
                    >
                        <UIcon name="i-lucide-badge-check" />
                        <span>4. Summary</span>
                    </div>
                </div>
            </template>
        </UPageHeader>

        <UPageBody>
            <UContainer>
                <!-- Zod / client validation messages from your composable -->
                <UAlert
                    v-if="validationErrors.length"
                    color="orange"
                    variant="subtle"
                    title="Please fix the following"
                    class="mb-4"
                >
                    <ul class="list-disc pl-5 mt-2 space-y-1 text-sm">
                        <li v-for="(msg, i) in validationErrors" :key="i">
                            {{ msg }}
                        </li>
                    </ul>
                </UAlert>

                <!-- Instant success banner from your composable -->
                <UAlert
                    v-if="justUploaded"
                    color="green"
                    variant="soft"
                    icon="i-lucide-badge-check"
                    title="Upload finished"
                    class="mb-4"
                >
                    <template #description>
                        We’re processing your document in the background.
                        <span v-if="docId" class="block text-xs opacity-80 mt-1"
                            >ID: {{ docId }}</span
                        >
                    </template>
                    <template #actions>
                        <UButton
                            size="xs"
                            color="primary"
                            variant="solid"
                            @click="toggleStatus"
                        >
                            {{ showStatus ? "Hide status" : "Check status" }}
                        </UButton>
                        <UButton size="xs" variant="ghost" @click="reset"
                            >Upload another</UButton
                        >
                    </template>
                </UAlert>

                <UCard>
                    <template #header>
                        <div class="flex items-center justify-between">
                            <div class="text-lg font-semibold">Upload</div>
                            <div class="flex items-center gap-2">
                                <UBadge
                                    v-if="status"
                                    color="primary"
                                    variant="soft"
                                    >Status: {{ status }}</UBadge
                                >
                                <UBadge
                                    v-if="totalQueued"
                                    color="gray"
                                    variant="soft"
                                    :label="`${totalQueued} queued`"
                                />
                                <UBadge
                                    v-if="totalUploaded"
                                    color="green"
                                    variant="soft"
                                    :label="`${totalUploaded} uploaded`"
                                />
                                <UBadge
                                    v-if="totalFailed"
                                    color="red"
                                    variant="soft"
                                    :label="`${totalFailed} failed`"
                                />
                            </div>
                        </div>
                    </template>

                    <!-- Nuxt UI Pro FileUpload (single OR multiple) -->
                    <UFileUpload
                        v-model="files"
                        multiple
                        :accept="accept"
                        label="Drop your paystubs here"
                        description="PDF, PNG or JPG (≤ 8 MB each)"
                        icon="i-lucide-upload"
                        class="w-96 min-h-48 ml-42 mb-10"
                        @update:modelValue="onSelect"
                    >
                        <template #actions="{ open }">
                            <UButton
                                label="Choose files"
                                icon="i-lucide-file-up"
                                color="primary"
                                variant="solid"
                                @click="open()"
                            />
                        </template>
                    </UFileUpload>

                    <!-- Queue list with per-item controls: Upload this file / Retry / Remove -->
                    <div class="space-y-3">
                        <div
                            v-for="item in queue"
                            :key="item.name + item.size + item.state"
                            class="rounded-lg border border-gray-200/60 dark:border-gray-800/60 p-3"
                        >
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <div class="flex items-center gap-2">
                                        <UIcon
                                            :name="
                                                item.state === 'uploaded'
                                                    ? 'i-lucide-check-circle'
                                                    : item.state === 'failed'
                                                      ? 'i-lucide-x-circle'
                                                      : item.state ===
                                                          'uploading'
                                                        ? 'i-lucide-loader-2'
                                                        : 'i-lucide-file-text'
                                            "
                                            :class="
                                                item.state === 'uploading'
                                                    ? 'animate-spin'
                                                    : ''
                                            "
                                            class="h-4 w-4"
                                        />
                                        <span class="font-medium truncate">{{
                                            item.name
                                        }}</span>
                                    </div>
                                    <div class="text-xs text-gray-500 mt-0.5">
                                        {{ humanSize(item.size) }} &middot;
                                        {{ item.type || "unknown" }}
                                        <span
                                            v-if="item.serverId"
                                            class="ml-2 opacity-75"
                                            >ID: {{ item.serverId }}</span
                                        >
                                    </div>
                                </div>

                                <div class="flex items-center gap-2 shrink-0">
                                    <UBadge
                                        :color="
                                            item.state === 'uploaded'
                                                ? 'green'
                                                : item.state === 'failed'
                                                  ? 'red'
                                                  : item.state === 'uploading'
                                                    ? 'primary'
                                                    : 'gray'
                                        "
                                        variant="soft"
                                        :label="item.state"
                                    />

                                    <!-- Single-file: Upload this one -->
                                    <UButton
                                        v-if="item.state === 'queued'"
                                        size="xs"
                                        color="emerald"
                                        variant="soft"
                                        icon="i-lucide-play"
                                        :disabled="uploading"
                                        @click="uploadOne(item)"
                                        title="Upload this file"
                                    />

                                    <!-- Retry failed -->
                                    <UButton
                                        v-if="item.state === 'failed'"
                                        size="xs"
                                        color="orange"
                                        variant="soft"
                                        icon="i-lucide-rotate-ccw"
                                        :disabled="uploading"
                                        @click="retryItem(item)"
                                        title="Retry"
                                    />

                                    <!-- Remove if not uploading -->
                                    <UButton
                                        v-if="item.state !== 'uploading'"
                                        size="xs"
                                        color="gray"
                                        variant="ghost"
                                        icon="i-lucide-x"
                                        title="Remove"
                                        @click="removeItem(item)"
                                    />
                                </div>
                            </div>

                            <!-- Show composable progress for the active (uploading) item -->
                            <div
                                v-if="item.state === 'uploading' && uploading"
                                class="mt-2 space-y-1"
                            >
                                <UProgress :value="progress" />
                                <div class="text-xs flex justify-between">
                                    <span v-if="error" class="text-red-500">{{
                                        error
                                    }}</span>
                                    <span v-else>{{ progress }}%</span>
                                </div>
                            </div>

                            <UAlert
                                v-if="item.state === 'failed' && item.error"
                                class="mt-2"
                                color="red"
                                variant="soft"
                                title="Upload failed"
                                :description="item.error"
                            />
                        </div>
                    </div>

                    <div class="mt-4 flex flex-wrap gap-3">
                        <!-- Multi-file: Upload all queued (and failed -> retried) -->
                        <UButton
                            color="emerald"
                            :disabled="
                                uploading || (!totalQueued && !totalFailed)
                            "
                            :loading="uploading"
                            icon="i-lucide-list-start"
                            @click="uploadAll"
                        >
                            {{
                                uploading ? "Uploading…" : `Start upload (all)`
                            }}
                        </UButton>

                        <!-- Single-file: Upload first queued -->
                        <UButton
                            color="primary"
                            variant="soft"
                            icon="i-lucide-play"
                            :disabled="uploading || !totalQueued"
                            @click="uploadOne()"
                        >
                            Upload first queued
                        </UButton>

                        <UButton
                            color="gray"
                            variant="ghost"
                            icon="i-lucide-rotate-ccw"
                            :disabled="
                                uploading || (!queue.length && !files.length)
                            "
                            @click="resetAll"
                        >
                            Reset
                        </UButton>
                    </div>

                    <UAlert
                        v-if="error"
                        class="mt-4"
                        color="red"
                        variant="soft"
                        title="Error"
                        :description="error"
                    />
                </UCard>

                <!-- Background status panel -->
                <UCard
                    v-if="
                        showStatus &&
                        status &&
                        status !== 'done' &&
                        status !== 'failed'
                    "
                    class="mt-4"
                >
                    <div class="flex items-center gap-3">
                        <UIcon
                            name="i-lucide-loader-2"
                            class="animate-spin h-5 w-5"
                        />
                        <div class="font-medium">Processing in background…</div>
                    </div>
                    <p class="text-sm text-gray-500 mt-1">
                        You can navigate away — we’ll keep working. Open this
                        panel anytime to refresh the status.
                    </p>
                    <div class="mt-3 flex gap-3">
                        <UButton
                            color="gray"
                            variant="ghost"
                            @click="toggleStatus"
                            >Hide</UButton
                        >
                        <UButton color="gray" variant="ghost" @click="cancel"
                            >Stop polling</UButton
                        >
                    </div>
                </UCard>

                <!-- Summary -->
                <UCard class="mt-6" v-if="status === 'done' && summary">
                    <template #header>
                        <div class="flex items-center justify-between">
                            <div class="text-lg font-semibold">Summary</div>
                            <UBadge color="green" variant="solid">Ready</UBadge>
                        </div>
                    </template>

                    <div
                        v-if="summary.headline"
                        class="mb-2 text-base font-medium"
                    >
                        {{ summary.headline }}
                    </div>

                    <div v-if="summary.fields">
                        <UTable
                            :rows="
                                Object.entries(summary.fields).map(
                                    ([field, value]) => ({ field, value }),
                                )
                            "
                            :columns="[
                                { key: 'field', label: 'Field' },
                                { key: 'value', label: 'Value' },
                            ]"
                        />
                    </div>
                    <div v-else>
                        <pre class="text-sm">{{ summary }}</pre>
                    </div>

                    <div class="mt-4 flex gap-3">
                        <UButton @click="reset">Upload another</UButton>
                        <UButton
                            variant="soft"
                            color="primary"
                            @click="toggleStatus"
                            >Check status</UButton
                        >
                    </div>
                </UCard>

                <UAlert
                    v-if="status === 'failed'"
                    color="red"
                    variant="soft"
                    title="Processing failed"
                    class="mt-4"
                />
            </UContainer>
        </UPageBody>
    </UPage>
</template>
