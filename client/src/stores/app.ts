import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { Language, Scenario, VocabularyEntry } from "../types";

interface SavedVocabularyItem extends VocabularyEntry {
  dateAdded: number;
}

interface VocabularyStore {
  items: SavedVocabularyItem[];
  add: (item: Omit<SavedVocabularyItem, "dateAdded">) => void;
  remove: (term: string) => void;
  clear: () => void;
  exists: (term: string) => boolean;
  getAll: () => SavedVocabularyItem[];
}

export enum ApiKeyStatus {
  UNSET = "UNSET",
  CHECKING = "CHECKING",
  VALID = "VALID",
  INVALID = "INVALID",
}

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

interface AppState {
  appLoading: boolean;
  appError: string | null;

  // Vocabulary
  vocabulary: VocabularyStore;

  // Language
  languages: Language[];
  practiceLanguage: string;
  setLanguages: (languages: Language[]) => void;
  setpracticeLanguage: (code: string) => void;

  nativeLanguage: string;
  setNativeLanguage: (code: string) => void;

  // API
  geminiApiKey: string | null;
  apiKeyError: string | null;
  apiKeyStatus: ApiKeyStatus;
  setGeminiApiKey: (key: string) => Promise<void>;

  // Scenarios
  systemScenarios: Scenario[];
  userScenarios: UserScenario[];
  setScenarios: (scenarios: Scenario[]) => void;
  addUserScenario: (scenario: ScenarioInput) => void;
  removeUserScenario: (id: string) => void;
  updateUserScenario: (
    id: string,
    updates: Partial<Omit<UserScenario, "id" | "isCustom" | "dateCreated">>
  ) => void;

  // Core
  isReady: boolean;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  devtools((set, get) => {
    const initStore = async () => {
      try {
        console.log("Initializing store...");
        // Load languages
        const languages = await fetch("/api/languages").then((res) =>
          res.json()
        );
        get().setLanguages(languages);

        // Load scenarios
        console.log("Loading scenarios...");
        const scenarios = await fetch("/api/scenarios").then((res) =>
          res.json()
        );
        get().setScenarios(scenarios);

        // Restore saved configuration
        console.log("Restoring saved configuration...");
        const storedApiKey = localStorage.getItem("geminiApiKey");
        if (storedApiKey) {
          set({ geminiApiKey: storedApiKey, apiKeyStatus: ApiKeyStatus.VALID });
        }

        console.log("Restoring language settings...");
        const storedLanguage = localStorage.getItem("practiceLanguage");
        if (storedLanguage) {
          get().setpracticeLanguage(storedLanguage);
        }

        const storedNativeLanguage = localStorage.getItem("nativeLanguage");
        if (storedNativeLanguage) {
          get().setNativeLanguage(storedNativeLanguage);
        }

        set({
          isReady: !!(get().practiceLanguage && get().geminiApiKey),
        });
      } catch (error) {
        console.error("Failed to initialize store:", error);
        set({ appLoading: false, appError: error!.toString() });
      }
    };

    initStore();

    return {
      appLoading: true,
      appError: null,

      // Vocabulary Store
      vocabulary: {
        items: JSON.parse(
          localStorage.getItem("savedVocabulary") || "[]"
        ) as SavedVocabularyItem[],

        add: (item: Omit<SavedVocabularyItem, "dateAdded">) => {
          const store = get().vocabulary;
          const exists = store.items.some(
            (i: SavedVocabularyItem) => i.source_text === item.source_text
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
            (item: SavedVocabularyItem) => item.source_text !== term
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
          return get().vocabulary.items.some(
            (item) => item.source_text === term
          );
        },

        getAll: () => get().vocabulary.items,
      },

      // Language Store
      languages: [],
      practiceLanguage: "",
      nativeLanguage: "en",
      setLanguages: (languages) =>
        set({
          languages,
          appLoading: !get().systemScenarios.length,
        }),
      setpracticeLanguage: (code) => {
        set((state) => ({
          practiceLanguage: code,
          isReady: !!(code && state.geminiApiKey),
        }));
        localStorage.setItem("practiceLanguage", code);
      },
      setNativeLanguage: (code) => {
        set({ nativeLanguage: code });
        localStorage.setItem("nativeLanguage", code);
      },

      // API Store
      geminiApiKey: null,
      apiKeyStatus: ApiKeyStatus.UNSET,
      apiKeyError: null,
      isReady: false,
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
            isReady: !!(key && state.practiceLanguage),
          }));
        } else {
          const errorData = await response.json();
          const errorMessage = errorData.error?.message || "Invalid API key";
          set({
            apiKeyStatus: ApiKeyStatus.INVALID,
            apiKeyError: errorMessage,
            isReady: false,
          });
        }
      },

      // Scenario Store
      systemScenarios: [],
      userScenarios: JSON.parse(localStorage.getItem("userScenarios") || "[]"),
      setScenarios: (scenarios) =>
        set({
          systemScenarios: scenarios,
          appLoading: !get().languages.length,
        }),

      addUserScenario: (scenario: ScenarioInput) => {
        const newScenario: UserScenario = {
          ...scenario,
          id: scenario.id,
          isCustom: true,
          dateCreated: Date.now(),
        };

        set((state: AppState) => {
          const newUserScenarios = [...state.userScenarios, newScenario];
          localStorage.setItem(
            "userScenarios",
            JSON.stringify(newUserScenarios)
          );
          return { userScenarios: newUserScenarios };
        });
      },

      removeUserScenario: (id) => {
        set((state) => {
          const newUserScenarios = state.userScenarios.filter(
            (s) => s.id !== id
          );
          localStorage.setItem(
            "userScenarios",
            JSON.stringify(newUserScenarios)
          );
          return { userScenarios: newUserScenarios };
        });
      },

      updateUserScenario: (id, updates) => {
        set((state) => {
          const newUserScenarios = state.userScenarios.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          );
          localStorage.setItem(
            "userScenarios",
            JSON.stringify(newUserScenarios)
          );
          return { userScenarios: newUserScenarios };
        });
      },

      reset: () => {
        localStorage.clear();
        window.location.reload();
      },
    };
  })
);
