// composables/useUploader.ts
import axios from "axios";
import { ref } from "vue";
import { z } from "zod";

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;
const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const api = "http://localhost:8000/api";

function createFileSchema() {
  // Build schema on client to avoid SSR 'File' reference errors
  const FileCtor = (globalThis as any).File;
  return z.object({
    file: z
      .custom<File>(
        (v) => FileCtor && v instanceof FileCtor,
        "Please choose a file",
      )
      .refine((f) => !!f, "Please choose a file")
      .refine(
        (f) => ACCEPTED_TYPES.includes(f!.type),
        "Only PDF, PNG or JPG are allowed",
      )
      .refine((f) => f!.size <= MAX_BYTES, "File must be 8MB or smaller"),
  });
}

export function useUploader() {
  const t = useToast();

  // State
  const file = ref<File | null>(null);
  const uploading = ref(false);
  const progress = ref(0);
  const status = ref<string | null>(null); // 'uploading' | 'processing' | 'done' | 'failed'
  const summary = ref<any>(null);
  const error = ref<string | null>(null);
  const validationErrors = ref<string[]>([]);
  const docId = ref<number | null>(null);

  // UX helpers
  const justUploaded = ref(false); // show success banner immediately after upload
  const showStatus = ref(false); // user toggles to reveal processing panel

  // Polling
  let poller: ReturnType<typeof setTimeout> | null = null;
  let backoffMs = 1000;
  let cancelled = false;

  const reset = () => {
    uploading.value = false;
    progress.value = 0;
    status.value = null;
    summary.value = null;
    error.value = null;
    validationErrors.value = [];
    docId.value = null;
    file.value = null;
    cancelled = false;
    justUploaded.value = false;
    showStatus.value = false;
    stopPolling();
  };

  const selectFile = (f: File | null) => {
    file.value = f;
    validationErrors.value = [];
    error.value = null;
    progress.value = 0;
  };

  const validate = (): boolean => {
    if (typeof window === "undefined") return true; // skip on SSR
    const schema = createFileSchema();
    const out = schema.safeParse({ file: file.value });
    if (!out.success) {
      validationErrors.value = out.error.errors.map((e) => e.message);
      return false;
    }
    validationErrors.value = [];
    return true;
  };

  const upload = async () => {
    if (!validate() || !file.value) return;

    error.value = null;
    uploading.value = true;
    progress.value = 0;
    status.value = "uploading";
    cancelled = false;
    justUploaded.value = false;
    showStatus.value = false;

    try {
      const fd = new FormData();
      fd.append("file", file.value);

      const res = await axios.post(`${api}/upload`, fd, {
        onUploadProgress: (evt) => {
          if (evt.total)
            progress.value = Math.round((evt.loaded * 100) / evt.total);
        },
      });

      // Upload finished: switch to non-blocking flow
      docId.value = res.data.id;
      status.value = "processing";
      uploading.value = false;
      justUploaded.value = true;

      t.add({
        title: "Upload finished",
        description: "We’ll process your document in the background.",
        color: "green",
        icon: "i-heroicons-check-circle",
      });

      startPolling();
    } catch (e: any) {
      error.value = e?.response?.data?.message || e?.message || "Upload failed";
      status.value = "failed";
      uploading.value = false;
      t.add({
        title: "Upload failed",
        description: error.value,
        color: "red",
        icon: "i-heroicons-x-circle",
      });
    }
  };

  const startPolling = () => {
    stopPolling();
    backoffMs = 1000;
    tick();
  };

  const tick = async () => {
    if (!docId.value || cancelled) return;
    try {
      const { data } = await axios.get(`${api}/status/${docId.value}`);
      status.value = data.status;
      if (data.summary) summary.value = data.summary;

      if (data.status === "done") {
        if (!showStatus.value) {
          t.add({
            title: "Summary ready",
            description: "Open “Check status” to review.",
            color: "primary",
            icon: "i-heroicons-document-check",
          });
        }
        stopPolling();
        return;
      }
      if (data.status === "failed") {
        t.add({
          title: "Processing failed",
          color: "red",
          icon: "i-heroicons-exclamation-triangle",
        });
        stopPolling();
        return;
      }
    } catch {
      // transient error; keep retrying
    }

    backoffMs = Math.min(backoffMs * 2, 5000); // up to 5s
    poller = setTimeout(tick, backoffMs);
  };

  const stopPolling = () => {
    if (poller) {
      clearTimeout(poller);
      poller = null;
    }
  };

  const cancel = () => {
    cancelled = true;
    stopPolling();
  };

  const toggleStatus = () => {
    showStatus.value = !showStatus.value;
  };

  return {
    // state
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
    // actions
    selectFile,
    upload,
    reset,
    cancel,
    toggleStatus,
  };
}
