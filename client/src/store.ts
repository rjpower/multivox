import { create, StateCreator } from "zustand";
import {
  WebSocketMessage,
  WebSocketState,
  type Language,
  type Scenario,
} from "./types";

import { devtools } from "zustand/middleware";
import { AudioPlayer } from "./AudioPlayer";
import { AudioRecorder } from "./AudioRecorder";
import { ChatHistory } from "./ChatHistory";
import { translateText, initializeWebSocket } from "./practiceUtils";
import { TypedWebSocket } from "./TypedWebSocket";

interface SavedVocabularyItem {
  term: string;
  translation: string;
  notes?: string;
  context?: string;
  chunks?: string[];
  dateAdded: number;
}

// Vocabulary Store
interface VocabularyStore {
  items: SavedVocabularyItem[];
  add: (item: Omit<SavedVocabularyItem, "dateAdded">) => void;
  remove: (term: string) => void;
  clear: () => void;
  exists: (term: string) => boolean;
  getAll: () => SavedVocabularyItem[];
}

interface VocabularySlice {
  vocabulary: VocabularyStore;
}

// Language Store
interface LanguageSlice {
  languages: Language[];
  selectedLanguage: string;
  setLanguages: (languages: Language[]) => void;
  setSelectedLanguage: (code: string) => void;
  fetchLanguages: () => Promise<void>;
}

// API Store
interface ApiSlice {
  geminiApiKey: string | null;
  apiKeyError: string | null;
  apiKeyStatus: ApiKeyStatus;
  setGeminiApiKey: (key: string) => Promise<void>;
}

// Loading Store
interface UserScenario extends Scenario {
  isCustom: true;
  dateCreated: number;
}

interface ScenarioInput {
  id: string;
  title: string;
  description: string;
  instructions: string;
}

interface ScenarioSlice {
  systemScenarios: Scenario[];
  userScenarios: UserScenario[];
  scenariosLoading: boolean;
  addUserScenario: (scenario: ScenarioInput) => void;
  removeUserScenario: (id: string) => void;
  updateUserScenario: (
    id: string,
    updates: Partial<Omit<UserScenario, "id" | "isCustom" | "dateCreated">>
  ) => void;
  fetchSystemScenarios: () => Promise<void>;
}

export enum PracticeState {
  WAITING = "WAITING",
  TRANSLATING = "TRANSLATING",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
}

interface PracticeSlice {
  practice: {
    isRecording: boolean;
    practiceState: PracticeState;
    wsState: WebSocketState;
    modality: "text" | "audio";
    translatedInstructions: string | null;
    customInstructions: string | null;
    chatHistory: ChatHistory;
    connection: TypedWebSocket | null;
    recorder: AudioRecorder | null;
    audioPlayer: AudioPlayer;
    setPracticeState: (state: PracticeState) => void;
    setModality: (modality: "text" | "audio") => void;
    setCustomInstructions: (instructions: string | null) => void;
    connect: (text: string, language: string) => Promise<void>;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    sendMessage: (text: string) => void;
    reset: () => void;
  };
}

export type AppState = VocabularySlice &
  LanguageSlice &
  ApiSlice &
  ScenarioSlice &
  PracticeSlice & {
    isReady: boolean;
  };

const createVocabularySlice: StateCreator<AppState, [], [], VocabularySlice> = (
  set,
  get
) => ({
  vocabulary: {
    items: JSON.parse(
      localStorage.getItem("savedVocabulary") || "[]"
    ) as SavedVocabularyItem[],

    add: (item: Omit<SavedVocabularyItem, "dateAdded">) => {
      const store = get().vocabulary;
      const exists = store.items.some(
        (i: SavedVocabularyItem) => i.term === item.term
      );
      if (!exists) {
        const newItem = { ...item, dateAdded: Date.now() };
        const newItems = [...store.items, newItem];
        localStorage.setItem("savedVocabulary", JSON.stringify(newItems));
        set((state) => ({
          vocabulary: {
            ...state.vocabulary,
            items: newItems,
          },
        }));
      }
    },

    remove: (term: string) => {
      const store = get().vocabulary;
      const newItems = store.items.filter(
        (item: SavedVocabularyItem) => item.term !== term
      );
      localStorage.setItem("savedVocabulary", JSON.stringify(newItems));
      set((state) => ({
        vocabulary: {
          ...state.vocabulary,
          items: newItems,
        },
      }));
    },

    clear: () => {
      localStorage.setItem("savedVocabulary", JSON.stringify([]));
      set((state) => ({
        vocabulary: {
          ...state.vocabulary,
          items: [],
        },
      }));
    },

    exists: (term: string) => {
      return get().vocabulary.items.some((item) => item.term === term);
    },

    getAll: () => get().vocabulary.items,
  },
});

export enum ApiKeyStatus {
  UNSET = "UNSET",
  CHECKING = "CHECKING",
  VALID = "VALID",
  INVALID = "INVALID",
}

const createLanguageSlice: StateCreator<AppState, [], [], LanguageSlice> = (
  set
) => ({
  languages: [],
  selectedLanguage: localStorage.getItem("selectedLanguage") || "",
  setLanguages: (languages) => set({ languages }),
  setSelectedLanguage: (code) => {
    localStorage.setItem("selectedLanguage", code);
    set((state) => ({
      selectedLanguage: code,
      isReady: !!(code && state.geminiApiKey),
    }));
  },
  fetchLanguages: async () => {
    const response = await fetch("/api/languages");
    const languages = await response.json();
    set({ languages });
  },
});

const createApiSlice: StateCreator<AppState, [], [], ApiSlice> = (set) => ({
  geminiApiKey: localStorage.getItem("geminiApiKey"),
  apiKeyStatus: localStorage.getItem("geminiApiKey")
    ? ApiKeyStatus.VALID
    : ApiKeyStatus.UNSET,
  apiKeyError: null,
  setGeminiApiKey: async (key) => {
    if (key) {
      localStorage.setItem("geminiApiKey", key);
    } else {
      localStorage.removeItem("geminiApiKey");
    }
    set({
      geminiApiKey: key,
      apiKeyStatus: ApiKeyStatus.CHECKING,
      apiKeyError: null,
    });
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1/models?key=" + key
    );

    if (response.ok) {
      localStorage.setItem("geminiApiKey", key);
      set((state) => ({
        apiKeyStatus: ApiKeyStatus.VALID,
        isReady: !!(key && state.selectedLanguage),
      }));
    } else {
      const errorData = await response.json();
      const errorMessage = errorData.error?.message || "Invalid API key";
      set({
        apiKeyStatus: ApiKeyStatus.INVALID,
        apiKeyError: errorMessage,
      });
    }
  },
});

const createScenarioSlice: StateCreator<AppState, [], [], ScenarioSlice> = (
  set
) => ({
  systemScenarios: [],
  userScenarios: JSON.parse(localStorage.getItem("userScenarios") || "[]"),
  scenariosLoading: false,

  addUserScenario: (scenario: ScenarioInput) => {
    const newScenario: UserScenario = {
      ...scenario,
      id: scenario.id,
      isCustom: true,
      dateCreated: Date.now(),
    };

    set((state: AppState) => {
      const newUserScenarios = [...state.userScenarios, newScenario];
      localStorage.setItem("userScenarios", JSON.stringify(newUserScenarios));
      return { userScenarios: newUserScenarios };
    });
  },

  removeUserScenario: (id) => {
    set((state) => {
      const newUserScenarios = state.userScenarios.filter((s) => s.id !== id);
      localStorage.setItem("userScenarios", JSON.stringify(newUserScenarios));
      return { userScenarios: newUserScenarios };
    });
  },

  updateUserScenario: (id, updates) => {
    set((state) => {
      const newUserScenarios = state.userScenarios.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      );
      localStorage.setItem("userScenarios", JSON.stringify(newUserScenarios));
      return { userScenarios: newUserScenarios };
    });
  },

  fetchSystemScenarios: async () => {
    set({ scenariosLoading: true });
    try {
      const scenarios = await fetch("/api/scenarios").then((res) => res.json());
      set({
        systemScenarios: scenarios,
        scenariosLoading: false,
      });
    } catch (error) {
      console.error("Failed to fetch scenarios:", error);
      set({ scenariosLoading: false });
    }
  },
});

interface StoreActions {
  reset: () => void;
}

interface CoreState {
  isReady: boolean;
}

type FullAppState = AppState & CoreState & StoreActions;

function handleWebSocketMessage(
  set: (fn: (state: AppState) => Partial<AppState>) => void
) {
  return (message: WebSocketMessage) => {
    if (message.type == "audio") {
      const store = useAppStore.getState();
      if (store.practice.audioPlayer) {
        store.practice.audioPlayer.addAudioToQueue(message.audio);
      }
    }
    set((state) => ({
      practice: {
        ...state.practice,
        chatHistory: state.practice.chatHistory.handleMessage(message),
      },
    }));
  };
}

const createPracticeSlice: StateCreator<AppState, [], [], PracticeSlice> = (
  set,
  get
) => ({
  practice: {
    isRecording: false,
    practiceState: PracticeState.WAITING,
    wsState: WebSocketState.DISCONNECTED,
    modality: "audio",
    translatedInstructions: null,
    customInstructions: null,
    chatHistory: new ChatHistory(),
    connection: null,
    recorder: null,
    audioPlayer: new AudioPlayer(),

    setPracticeState: (state: PracticeState) =>
      set((s) => ({ practice: { ...s.practice, practiceState: state } })),

    setModality: (modality) =>
      set((s) => ({ practice: { ...s.practice, modality } })),

    setCustomInstructions: (instructions) =>
      set((s: AppState) => ({
        practice: { ...s.practice, customInstructions: instructions },
      })),

    connect: async (text, language) => {
      const store = get();
      try {
        set((s) => ({
          practice: { ...s.practice, practiceState: PracticeState.TRANSLATING },
        }));
        const translation = await translateText({
          text,
          target_language: language,
        });

        set((s) => ({
          practice: {
            ...s.practice,
            practiceState: PracticeState.CONNECTING,
            translatedInstructions: translation,
          },
        }));

        const ws = await initializeWebSocket(
          language,
          store.practice.modality,
          handleWebSocketMessage(set)
        );
        const recorder = new AudioRecorder(ws);

        set((s) => ({
          practice: {
            ...s.practice,
            connection: ws,
            recorder,
            wsState: WebSocketState.CONNECTED,
            practiceState: PracticeState.ACTIVE,
            chatHistory: s.practice.chatHistory.handleMessage({
              type: "initialize",
              role: "assistant",
              text: translation,
            }),
          },
        }));

        // send initialization message with translated instructions
        ws.send({
          type: "initialize",
          text: translation,
          role: "assistant",
        });
      } catch (error) {
        set((s) => ({
          practice: {
            ...s.practice,
            translatedInstructions: null,
            practiceState: PracticeState.WAITING,
          },
        }));
        throw error;
      }
    },

    startRecording: async () => {
      const { practice } = get();
      try {
        if (practice.recorder) {
          await practice.recorder.startRecording();
          set((s) => ({
            practice: {
              ...s.practice,
              isRecording: true,
              chatHistory: s.practice.chatHistory.handleMessage({
                type: "audio",
                role: "user",
                audio: "",
              }),
            },
          }));
        }
      } catch (err) {
        console.error("Failed to start recording:", err);
      }
    },

    stopRecording: () => {
      const { practice } = get();
      if (practice.recorder) {
        practice.recorder.stopRecording();
        set((s) => ({
          practice: {
            ...s.practice,
            isRecording: false,
            chatHistory: s.practice.chatHistory.handleMessage({
              type: "audio",
              role: "user",
              audio: "",
              end_of_turn: true,
            }),
          },
        }));
      }
    },

    sendMessage: (text) => {
      const { practice } = get();
      if (
        !practice.connection ||
        practice.connection.readyState !== WebSocket.OPEN
      ) {
        console.error("WebSocket not connected");
        return;
      }

      set((s) => ({
        practice: {
          ...s.practice,
          chatHistory: s.practice.chatHistory.handleMessage({
            type: "text",
            role: "user",
            text,
          }),
        },
      }));

      practice.connection.send({
        type: "text",
        text,
        role: "user",
      });
    },

    reset: () => {
      const { practice } = get();
      // during the demo, we will have "fake" connections and recorders
      if (typeof practice.audioPlayer?.stop === "function") {
        practice.audioPlayer.stop();
      }
      if (typeof practice.connection?.close === "function") {
        practice.connection.close();
      }
      if (typeof practice.recorder?.stopRecording === "function") {
        practice.recorder.stopRecording();
      }
      set((s) => ({
        practice: {
          ...s.practice,
          isRecording: false,
          wsState: WebSocketState.DISCONNECTED,
          practiceState: PracticeState.WAITING,
          connection: null,
          recorder: null,
          translatedInstructions: null,
          customInstructions: null,
          chatHistory: new ChatHistory(),
        },
      }));
    },
  },
});

const resetStore = () => {
  localStorage.clear();
  window.location.reload();
};

export const useAppStore = create<FullAppState>()(
  devtools((set, get) => {
    let store: any = {};

    store = {
      ...createVocabularySlice(set, get, store),
      ...createLanguageSlice(set, get, store),
      ...createApiSlice(set, get, store),
      ...createScenarioSlice(set, get, store),
      ...createPracticeSlice(set, get, store),
    };

    // Load initial data
    store.fetchLanguages();
    store.fetchSystemScenarios();

    return {
      ...store,
      reset: resetStore,
      isReady: !!(store.geminiApiKey && store.selectedLanguage),
      setIsReady: (ready: boolean) => set({ isReady: ready }),
    };
  })
);
