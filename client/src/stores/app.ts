import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage, freezeAtom } from "jotai/utils";
import { useEffect } from "react";
import { Language, Scenario, VocabularyEntry } from "../types";

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

const darkModeAtom = atomWithStorage<boolean>("darkMode", false);
export const useDarkMode = () => useAtom(darkModeAtom);

export const appErrorAtom = atom<string | null>(null);
export const languagesAtom = atom<Language[]>([]);
export const practiceLanguageAtom = atomWithStorage<string | null>(
  "practiceLanguage",
  null
);
export const nativeLanguageAtom = atomWithStorage<string | null>(
  "nativeLanguage",
  null
);

export const systemScenariosAtom = atom<Scenario[]>([]);
export const userScenariosAtom = freezeAtom(
  atomWithStorage<UserScenario[]>("userScenarios", [])
);

export const vocabularyItemsAtom = freezeAtom(
  atomWithStorage<VocabularyEntry[]>("savedVocabulary", [])
);

const appLoadingAtom = atom((get) => {
  const languages = get(languagesAtom);
  const systemScenarios = get(systemScenariosAtom);
  const appError = get(appErrorAtom);
  return !appError && !(languages.length && systemScenarios.length);
});

const readyForPractice = atom((get) => {
  const practiceLanguage = get(practiceLanguageAtom);
  const nativeLanguage = get(nativeLanguageAtom);
  return Boolean(practiceLanguage && nativeLanguage);
});

export const useAppLoading = () => {
  return useAtomValue(appLoadingAtom);
};

export const useReadyForPractice = () => {
  return useAtomValue(readyForPractice);
};

export const useLanguages = () => {
  return useAtomValue(languagesAtom);
};

export const useVocabulary = () => {
  const [items, setItems] = useAtom(vocabularyItemsAtom);

  const add = (item: VocabularyEntry) => {
    if (!items.some((i) => i.source_text === item.source_text)) {
      const newItem = { ...item };
      const newItems = [...items, newItem];
      newItems.sort((a, b) => a.source_text.localeCompare(b.source_text));
      setItems(newItems);
    }
  };

  const remove = (term: string) => {
    const newItems = items.filter((item) => item.source_text !== term);
    setItems(newItems);
  };

  const clear = () => {
    setItems([]);
  };

  const exists = (term: string) =>
    items.some((item) => item.source_text === term);

  const getAll = () => items;

  return { items, add, remove, clear, exists, getAll };
};

export const useSystemScenarios = () => {
  return useAtomValue(systemScenariosAtom);
};

export const useUserScenarios = () => {
  const [userScenarios, setUserScenarios] = useAtom(userScenariosAtom);

  const removeUserScenario = (id: string) => {
    const newUserScenarios = userScenarios.filter((s) => s.id !== id);
    setUserScenarios(newUserScenarios);
  };

  const updateUserScenario = (scenario: ScenarioInput) => {
    let newUserScenarios;
    const existingScenario = userScenarios.find((s) => s.id === scenario.id);

    if (existingScenario) {
      newUserScenarios = userScenarios.map((s) =>
        s.id === scenario.id ? { ...s, ...scenario } : s
      );
    } else {
      const newScenario: UserScenario = {
        ...scenario,
        isCustom: true,
        dateCreated: Date.now(),
      };
      newUserScenarios = [...userScenarios, newScenario];
    }

    setUserScenarios(newUserScenarios);
  };

  return { userScenarios, removeUserScenario, updateUserScenario };
};

export const AppInitializer = () => {
  const setLanguages = useSetAtom(languagesAtom);
  const setSystemScenarios = useSetAtom(systemScenariosAtom);
  const setAppError = useSetAtom(appErrorAtom);

  useEffect(() => {
    const init = async () => {
      console.log("init.");
      try {
        const languages = await fetch("/api/languages").then((res) =>
          res.json()
        );
        setLanguages(languages);

        const scenarios = await fetch("/api/scenarios").then((res) =>
          res.json()
        );
        setSystemScenarios(scenarios);
      } catch (error) {
        console.error("Failed to initialize:", error);
        setAppError(error ? error.toString() : "Unknown error");
      }
    };

    init();
  }, [setLanguages, setSystemScenarios, setAppError]);

  return null;
};

export const reset = () => {
  localStorage.clear();
  window.location.reload();
};
