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

  setAppError: (error: string) => void;
  setAppLoading: (loading: boolean) => void;

  // Vocabulary
  vocabulary: VocabularyStore;

  // Language
  languages: Language[];
  practiceLanguage: string;
  setLanguages: (languages: Language[]) => void;
  setPracticeLanguage: (code: string) => void;

  nativeLanguage: string;
  setNativeLanguage: (code: string) => void;

  // Scenarios
  systemScenarios: Scenario[];
  userScenarios: UserScenario[];
  setScenarios: (scenarios: Scenario[]) => void;
  removeUserScenario: (id: string) => void;
  updateUserScenario: (scenario: ScenarioInput) => void;

  isReady: () => boolean;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  devtools((set, get) => {
    return {
      appLoading: true,
      setAppLoading: (loading) => set({ appLoading: loading }),
      appError: null,
      setAppError: (error) => set({ appError: error, appLoading: false }),

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
      setPracticeLanguage: (code) => {
        set({ practiceLanguage: code });
        localStorage.setItem("practiceLanguage", code);
      },
      setNativeLanguage: (code) => {
        set({ nativeLanguage: code });
        localStorage.setItem("nativeLanguage", code);
      },

      // Scenario Store
      systemScenarios: [],
      userScenarios: JSON.parse(localStorage.getItem("userScenarios") || "[]"),
      setScenarios: (scenarios) =>
        set({
          systemScenarios: scenarios,
          appLoading: !get().languages.length,
        }),

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

      updateUserScenario: (scenario: ScenarioInput) => {
        set((state) => {
          let newUserScenarios;
          const existingScenario = state.userScenarios.find(s => s.id === scenario.id);
          
          if (existingScenario) {
            // Update existing scenario
            newUserScenarios = state.userScenarios.map((s) =>
              s.id === scenario.id ? { ...s, ...scenario } : s
            );
          } else {
            // Add new scenario
            const newScenario: UserScenario = {
              ...scenario,
              isCustom: true,
              dateCreated: Date.now()
            };
            newUserScenarios = [...state.userScenarios, newScenario];
          }
          
          localStorage.setItem(
            "userScenarios",
            JSON.stringify(newUserScenarios)
          );
          return { userScenarios: newUserScenarios };
        });
      },

      isReady: () => {
        const state = get();
        return Boolean(state.practiceLanguage && state.nativeLanguage);
      },

      reset: () => {
        localStorage.clear();
        window.location.reload();
      },
    };
  })
);

export async function initAppStore({
  setLanguages,
  setScenarios,
  setNativeLanguage,
  setPracticeLanguage,
  setAppError,
}: {
  setLanguages: (languages: Language[]) => void;
  setScenarios: (scenarios: Scenario[]) => void;
  setNativeLanguage: (code: string) => void;
  setPracticeLanguage: (code: string) => void;
  setAppError: (error: string) => void;
}) {
  try {
    console.log("Initializing store...");
    // Load languages
    const languages = await fetch("/api/languages").then((res) => res.json());
    setLanguages(languages);

    // Load scenarios
    console.log("Loading scenarios...");
    const scenarios = await fetch("/api/scenarios").then((res) => res.json());
    setScenarios(scenarios);

    console.log("Restoring language settings...");
    const practiceLanguage = localStorage.getItem("practiceLanguage");
    if (practiceLanguage) {
      setPracticeLanguage(practiceLanguage);
    }

    const storedNativeLanguage = localStorage.getItem("nativeLanguage");
    if (storedNativeLanguage) {
      setNativeLanguage(storedNativeLanguage);
    }
  } catch (error) {
    console.error("Failed to initialize store:", error);
    setAppError(error!.toString());
  }
}
