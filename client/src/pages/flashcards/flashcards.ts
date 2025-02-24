import { create } from "zustand";

interface Message {
  timestamp: string;
  text: string;
  type?: "error" | "success" | undefined;
  url?: string;
}

interface UploadStore {
  downloadUrl: string | null;
  modalVisible: boolean;
  messages: Message[];
  spinner: boolean;
  submitting: boolean;
  csvPreview: any | null;
  websocket: WebSocket | null;
  content: string;
  analyzeError: string | null;
  inputMode: "csv" | "srt";
  fieldMapping: typeof initialFieldMapping;
  format: "apkg" | "pdf";
  includeAudio: boolean;

  isFormValid: () => boolean;
  setContent: (content: string) => void;
  setAnalyzeError: (error: string | null) => void;
  setInputMode: (mode: "csv" | "srt") => void;
  setFieldMapping: (mapping: typeof initialFieldMapping) => void;
  setFormat: (format: "apkg" | "pdf") => void;
  setIncludeAudio: (include: boolean) => void;
  showModal: () => void;
  hideModal: () => void;
  setSubmitting: (flag: boolean) => void;
  setSpinner: (flag: boolean) => void;
  logMessage: (text: string, type?: "error" | "success" | undefined) => void;
  clearMessages: () => void;
  setCsvPreview: (preview: any) => void;
  startGeneration: (sourceLanguage: string, targetLanguage: string) => void;
  cleanup: () => void;
}

const initialFieldMapping = {
  term_field: "",
  reading_field: "",
  meaning_field: "",
  context_native_field: "",
  context_en_field: "",
  separator: ",",
};

export const useFlashcardStore = create<UploadStore>((set, get) => ({
  downloadUrl: "",
  modalVisible: false,
  messages: [],
  spinner: true,
  submitting: false,
  csvPreview: null,
  websocket: null,
  content: "",
  analyzeError: null,
  inputMode: "csv",
  fieldMapping: initialFieldMapping,
  format: "pdf",
  includeAudio: false,

  isFormValid: () => {
    const state = get();
    if (!state.content) return false;

    if (state.inputMode === "csv") {
      // For CSV mode, require analysis and field mapping
      if (!state.csvPreview) return false;

      // At minimum need term or meaning field
      return !!(
        state.fieldMapping.term_field || state.fieldMapping.meaning_field
      );
    }

    return true;
  },

  setContent: (content: string) => set({ content }),
  setAnalyzeError: (error: string | null) => set({ analyzeError: error }),
  setInputMode: (mode: "csv" | "srt") => set({ inputMode: mode }),
  setFieldMapping: (mapping) => set({ fieldMapping: mapping }),
  setFormat: (format: "apkg" | "pdf") => set({ format }),
  setIncludeAudio: (include: boolean) => set({ includeAudio: include }),
  showModal: () => set({ modalVisible: true }),
  cleanup: () => {
    const { websocket } = get();
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.close();
    }
    // Reset everything except content
    set({
      websocket: null,
      submitting: false,
      spinner: true,
      messages: [],
      downloadUrl: null,
      csvPreview: null,
      analyzeError: null,
      fieldMapping: initialFieldMapping,
      modalVisible: false,
      inputMode: "csv",
      format: "pdf",
      includeAudio: false,
    });
  },
  hideModal: () => {
    get().cleanup();
  },
  setSubmitting: (submitting) => set({ submitting }),
  setSpinner: (spinner: boolean) => set({ spinner }),
  logMessage: (text, type?) => {
    set((state) => ({
      messages: [
        ...state.messages,
        {
          timestamp: new Date().toISOString(),
          text,
          type,
        },
      ].slice(-100),
    }));
  },
  clearMessages: () => set({ messages: [] }),
  setCsvPreview: (preview) => set({ csvPreview: preview }),
  startGeneration: (sourceLanguage: string, targetLanguage: string) => {
    const state = get();
    state.setSubmitting(true);
    state.showModal();
    state.clearMessages();
    state.logMessage("Starting processing...");

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(
        `${protocol}//${window.location.host}/api/flashcards/generate`
      );
      set({ websocket: ws });

      ws.onopen = () => {
        set({ spinner: false });
        const request = {
          content: state.content,
          format: state.format,
          include_audio: state.includeAudio,
          source_language: sourceLanguage,
          target_language: targetLanguage,
          mode: state.inputMode,
          field_mapping:
            state.inputMode === "csv"
              ? {
                  term: state.fieldMapping.term_field,
                  reading: state.fieldMapping.reading_field,
                  meaning: state.fieldMapping.meaning_field,
                  context_native: state.fieldMapping.context_native_field,
                  context_en: state.fieldMapping.context_en_field,
                }
              : null,
        };
        ws.send(JSON.stringify(request));
      };

      ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        state.logMessage(data.text, data.type);
        if (data.url) {
          set({ downloadUrl: data.url });
        }
        set({ spinner: data.type !== "success" });
      };
    } catch (err: any) {
      state.logMessage(`Error: ${err.message}`, "error");
      state.setSubmitting(false);
    }
  },
}));
