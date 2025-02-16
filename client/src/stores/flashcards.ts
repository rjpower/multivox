import { create } from "zustand";

interface Message {
  timestamp: string;
  text: string;
  type?: "error" | "success" | undefined;
  url?: string;
}

interface UploadStore {
  modalVisible: boolean;
  messages: Message[];
  spinner: boolean;
  submitting: boolean;
  csvPreview: any | null;
  websocket: WebSocket | null;
  showModal: () => void;
  hideModal: () => void;
  setSubmitting: (flag: boolean) => void;
  setSpinner: (flag: boolean) => void;
  logMessage: (text: string, type?: "error" | "success" | undefined) => void;
  clearMessages: () => void;
  setCsvPreview: (preview: any) => void;
  startStream: (mode: "csv" | "srt", content: string, options: any) => void;
  cleanup: () => void;
}

export const useFlashcardStore = create<UploadStore>((set, get) => ({
  modalVisible: false,
  messages: [],
  spinner: true,
  submitting: false,
  csvPreview: null,
  websocket: null,
  showModal: () => set({ modalVisible: true }),
  cleanup: () => {
    const { websocket } = get();
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.close();
    }
    set({ websocket: null, submitting: false, spinner: true });
  },
  hideModal: () => {
    get().cleanup();
    set({ modalVisible: false });
  },
  setSubmitting: (submitting) => set({ submitting }),
  setSpinner: (spinner: boolean) => set({ spinner }),
  logMessage: (text, type?) =>
    set((state) => {
      const timestamp = new Date().toLocaleTimeString();
      return {
        messages: [...state.messages, { timestamp, text, type }].slice(-100),
      };
    }),
  clearMessages: () => set({ messages: [] }),
  setCsvPreview: (preview) => set({ csvPreview: preview }),
  startStream: (mode, content, options) => {
    // Cleanup any existing websocket
    get().cleanup();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/api/flashcards/generate`
    );
    set({ websocket: ws });
    ws.onopen = () => {
      set({ spinner: false });
      const request = {
        content,
        format: options.format,
        include_audio: options.includeAudio,
        target_language: options.target_language,
        mode: mode,
        api_key: options.api_key,
        field_mapping:
          mode === "csv"
            ? {
                term: options.termField,
                reading: options.readingField,
                meaning: options.meaningField,
                context_native: options.contextNativeField,
                context_en: options.contextEnField,
              }
            : null,
      };
      ws.send(JSON.stringify(request));
    };
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      set((state) => {
        const timestamp = new Date().toLocaleTimeString();
        return {
          messages: [
            ...state.messages,
            {
              timestamp,
              text: data.text,
              type: data.type,
              url: data.url,
            },
          ].slice(-100),
          spinner: data.type !== "success",
        };
      });
    };
  },
}));
