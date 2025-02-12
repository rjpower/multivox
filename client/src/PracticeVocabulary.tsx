import { useState, useEffect } from "react";
import { DictionaryEntry } from "./types";
import { ChatMessage } from "./ChatHistory";
import { useAppStore } from "./store";
import { BookmarkIcon, BookmarkSquareIcon } from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolidIcon } from "@heroicons/react/24/solid";

interface VocabularyItem {
  term: string;
  entry: DictionaryEntry;
}

export const PracticeVocabulary = ({ messages }: { messages: Array<ChatMessage> }) => {
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);

  useEffect(() => {
    // Collect unique vocabulary items from all transcription messages
    const vocabMap = new Map<string, DictionaryEntry>();

    messages.forEach((msg) => {
      if (msg.content.type === "transcription" && msg.content.transcription) {
        Object.entries(msg.content.transcription.dictionary).forEach(
          ([term, entry]) => {
            vocabMap.set(term, entry);
          }
        );
      }
      if (msg.content.type === "translate" && msg.content.dictionary) {
        Object.entries(msg.content.dictionary).forEach(([term, entry]) => {
          vocabMap.set(term, entry);
        });
      }
    });

    // Convert to sorted array
    const sortedVocab = Array.from(vocabMap.entries())
      .map(([term, entry]) => ({ term, entry }))
      .sort((a, b) => a.term.localeCompare(b.term));

    setVocabulary(sortedVocab);
  }, [messages]);

  if (vocabulary.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 max-h-[600px] overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Vocabulary</h3>
        <BookmarkAllButton vocabulary={vocabulary} />
      </div>
      <div className="space-y-3">
        {vocabulary.map(({ term, entry }) => (
          <div
            key={term}
            className="group hover:bg-indigo-50 p-2 rounded-md transition-colors flex justify-between items-start"
          >
            <div className="flex-1">
              <div className="text-md font-medium text-gray-900">{term}</div>
            <div className="text-sm text-gray-600">{entry.english}</div>
            {entry.notes && (
              <div className="text-xs text-gray-500 italic group-hover:block">
                {entry.notes}
              </div>
            )}
            </div>
            <SaveVocabButton term={term} entry={entry} />
          </div>
        ))}
      </div>
    </div>
  );
};

interface SaveVocabButtonProps {
  term: string;
  entry: DictionaryEntry;
}

const BookmarkAllButton = ({ vocabulary }: { vocabulary: VocabularyItem[] }) => {
  const add = useAppStore((state) => state.vocabulary.add);
  const exists = useAppStore((state) => state.vocabulary.exists);
  
  const handleBookmarkAll = () => {
    vocabulary.forEach(({ term, entry }) => {
      if (!exists(term)) {
        add({
          term,
          translation: entry.english,
          notes: entry.notes,
          context: entry.native,
        });
      }
    });
  };

  return (
    <button
      onClick={handleBookmarkAll}
      className="text-gray-400 hover:text-indigo-600 p-1 rounded-md transition-colors flex items-center gap-1"
      title="Save all to vocabulary"
    >
      <BookmarkSquareIcon className="h-5 w-5" />
      <span className="text-sm">Save All</span>
    </button>
  );
};

const SaveVocabButton = ({ term, entry }: SaveVocabButtonProps) => {
  const add = useAppStore((state) => state.vocabulary.add);
  const remove = useAppStore((state) => state.vocabulary.remove);
  const isSaved = useAppStore((state) => state.vocabulary.exists(term));

  const handleClick = () => {
    if (isSaved) {
      remove(term);
    } else {
      add({
        term,
        translation: entry.english,
        notes: entry.notes,
        context: entry.native,
      });
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`ml-2 p-1 rounded-md transition-colors ${
        isSaved
          ? "text-indigo-600 hover:text-indigo-700"
          : "text-gray-400 hover:text-indigo-600"
      }`}
      title={isSaved ? "Remove from vocabulary" : "Save to vocabulary"}
    >
      {isSaved ? (
        <BookmarkSolidIcon className="h-5 w-5" />
      ) : (
        <BookmarkIcon className="h-5 w-5" />
      )}
    </button>
  );
};
