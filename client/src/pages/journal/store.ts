import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useCallback } from "react";

// Simplified interfaces
export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  correctedContent?: string;
  date: string;
  lastEdited: string;
}

export interface CorrectionSpan {
  start: number;
  end: number;
  suggestion: string;
  type: string;
  explanation: string;
}

export interface JournalAnalysisResponse {
  corrected_text: string;
  spans: CorrectionSpan[];
  feedback: string;
  improved_text: string;
}

// Storage atom for journal entries
export const journalEntriesAtom = atomWithStorage<JournalEntry[]>("journalEntries", [], undefined, {getOnInit: true});

// UI state atoms
export const activeEntryIdAtom = atom<string | null>(null);
export const analysisResultAtom = atom<JournalAnalysisResponse | null>(null);
export const loadingAnalysisAtom = atom<boolean>(false);

// Derived atoms for the active entry
export const activeEntryAtom = atom(
  (get) => {
    const entries = get(journalEntriesAtom);
    const activeEntryId = get(activeEntryIdAtom);
    return entries.find(entry => entry.id === activeEntryId) || null;
  }
);

export const activeEntryContentAtom = atom(
  (get) => {
    const activeEntry = get(activeEntryAtom);
    return activeEntry?.content || '';
  },
  (get, set, newContent: string) => {
    const entries = get(journalEntriesAtom);
    const activeEntryId = get(activeEntryIdAtom);
    
    if (activeEntryId) {
      const newEntries = entries.map(entry => 
        entry.id === activeEntryId 
          ? { 
              ...entry, 
              content: newContent,
              lastEdited: new Date().toISOString() 
            } 
          : entry
      );
      set(journalEntriesAtom, newEntries);
    }
  }
);

export const activeEntryTitleAtom = atom(
  (get) => {
    const activeEntry = get(activeEntryAtom);
    return activeEntry?.title || '';
  },
  (get, set, newTitle: string) => {
    const entries = get(journalEntriesAtom);
    const activeEntryId = get(activeEntryIdAtom);
    
    if (activeEntryId) {
      const newEntries = entries.map(entry => 
        entry.id === activeEntryId 
          ? { 
              ...entry, 
              title: newTitle,
              lastEdited: new Date().toISOString() 
            } 
          : entry
      );
      set(journalEntriesAtom, newEntries);
    }
  }
);

// Helper functions
const getFormattedDate = () => {
  const now = new Date();
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const generateId = () => Math.random().toString(36).substring(2, 15);

// Main journal hook
export const useJournal = () => {
  const [entries, setEntries] = useAtom(journalEntriesAtom);
  const [activeEntryId, setActiveEntryId] = useAtom(activeEntryIdAtom);
  const [analysisResult, setAnalysisResult] = useAtom(analysisResultAtom);
  const [loadingAnalysis, setLoadingAnalysis] = useAtom(loadingAnalysisAtom);
  const [activeEntry] = useAtom(activeEntryAtom);
  const [activeEntryContent, setActiveEntryContent] = useAtom(activeEntryContentAtom);
  const [activeEntryTitle, setActiveEntryTitle] = useAtom(activeEntryTitleAtom);

  // Create a new journal entry
  const createEntry = useCallback(() => {
    const id = generateId();
    const newEntry: JournalEntry = {
      id,
      title: getFormattedDate(),
      content: "",
      date: new Date().toISOString(),
      lastEdited: new Date().toISOString(),
    };

    console.log("Creating new entry:", newEntry);
    setEntries([newEntry, ...entries]);
    setActiveEntryId(id);
    setAnalysisResult(null);
    return id;
  }, [entries, setEntries, setActiveEntryId, setAnalysisResult]);

  // Update an entry (generic)
  const updateEntry = useCallback(
    (id: string, changes: Partial<JournalEntry>) => {
      console.log("Updating entry:", id, changes);

      setEntries(
        entries.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                ...changes,
                lastEdited: new Date().toISOString(),
              }
            : entry
        )
      );
    },
    [entries, setEntries]
  );

  // Delete an entry
  const deleteEntry = useCallback(
    (id: string) => {
      console.log("Deleting entry:", id);

      setEntries(entries.filter((entry) => entry.id !== id));
      if (activeEntryId === id) {
        setActiveEntryId(null);
        setAnalysisResult(null);
      }
    },
    [activeEntryId, entries, setActiveEntryId, setAnalysisResult, setEntries]
  );

  // Save the corrected version of an entry
  const saveCorrection = useCallback(
    (id: string, result?: JournalAnalysisResponse) => {
      // Use the provided result or the current analysisResult state
      const correctionResult = result || analysisResult;

      if (correctionResult && id) {
        console.log(
          "Applying all corrections:",
          correctionResult.improved_text
        );

        // Update both content and correctedContent for consistency
        updateEntry(id, {
          content: correctionResult.improved_text,
          correctedContent: correctionResult.improved_text,
        });

        // Clear the analysis result after applying corrections
        setAnalysisResult(null);
      } else {
        console.warn(
          "No correction result available to apply or no active entry id"
        );
      }
    },
    [analysisResult, updateEntry, setAnalysisResult]
  );

  // Analyze journal entry content
  const analyzeEntry = useCallback(
    async (
      content: string,
      practiceLanguageCode: string = "en",
      nativeLanguageCode: string = "en"
    ) => {
      if (!content.trim()) return;

      // Clear previous analysis result
      setAnalysisResult(null);
      setLoadingAnalysis(true);

      try {
        console.log("Analyzing content:", content);

        const response = await fetch("/api/journal/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: content,
            practice_language_code: practiceLanguageCode,
            native_language_code: nativeLanguageCode,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to analyze journal entry");
        }

        const data = await response.json();
        console.log("Analysis result:", data);

        // Set the new analysis result
        setAnalysisResult(data);
      } catch (error) {
        console.error("Error analyzing journal entry:", error);
      } finally {
        setLoadingAnalysis(false);
      }
    },
    [setAnalysisResult, setLoadingAnalysis]
  );

  return {
    entries,
    activeEntry,
    activeEntryId,
    activeEntryContent,
    activeEntryTitle,
    setActiveEntryId,
    setActiveEntryContent,
    setActiveEntryTitle,
    createEntry,
    updateEntry,
    deleteEntry,
    analyzeEntry,
    analysisResult,
    loadingAnalysis,
    saveCorrection,
  };
};
