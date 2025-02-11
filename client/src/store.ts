import { create } from 'zustand'
import type { Language, Scenario } from './types'

interface AppState {
  // Languages
  languages: Language[];
  selectedLanguage: string;
  setLanguages: (languages: Language[]) => void;
  setSelectedLanguage: (code: string) => void;

  // Scenarios
  scenarios: Scenario[];
  setScenarios: (scenarios: Scenario[]) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Fetch initial data
  fetchInitialData: () => Promise<void>;
}

export const useStore = create<AppState>((set) => ({
  // Languages
  languages: [],
  selectedLanguage: "ja",
  setLanguages: (languages) => set({ languages }),
  setSelectedLanguage: (code) => set({ selectedLanguage: code }),

  // Scenarios
  scenarios: [],
  setScenarios: (scenarios) => set({ scenarios }),

  // Loading states
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),

  // Fetch initial data
  fetchInitialData: async () => {
    set({ isLoading: true });
    try {
      const [languagesRes, scenariosRes] = await Promise.all([
        fetch("/api/languages"),
        fetch("/api/scenarios"),
      ]);
      const languages = await languagesRes.json();
      const scenarios = await scenariosRes.json();

      set({
        languages,
        scenarios,
        isLoading: false,
      });
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
      set({ isLoading: false });
    }
  },
}));
