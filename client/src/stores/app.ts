import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage, freezeAtom } from "jotai/utils";
import { useEffect } from "react";
import { Language, VocabularyEntry } from "../types";
import { systemScenariosAtom } from "../pages/scenario/store";

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

export const modalityAtom = atomWithStorage<"audio" | "text">(
  "modality",
  "audio"
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

  const addAll = (newItems: VocabularyEntry[]) => {
    const existingItems = items.map((item) => item.source_text);
    const filteredItems = newItems.filter(
      (item) => !existingItems.includes(item.source_text)
    );
    const updatedItems = [...items, ...filteredItems];
    updatedItems.sort((a, b) => a.source_text.localeCompare(b.source_text));
    setItems(updatedItems);
  };

  const removeAll = (terms: string[]) => {
    const newItems = items.filter((item) => !terms.includes(item.source_text));
    console.log("removeAll", items.length, newItems.length, terms.length);
    setItems(newItems);
  };

  const clear = () => {
    setItems([]);
  };

  const exists = (term: string) =>
    items.some((item) => item.source_text === term);

  return { items, addAll, removeAll, clear, exists };
};

export const AppInitializer = () => {
  const setLanguages = useSetAtom(languagesAtom);
  const setSystemScenarios = useSetAtom(systemScenariosAtom);
  const setAppError = useSetAtom(appErrorAtom);

  useEffect(() => {
    const init = async () => {
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
