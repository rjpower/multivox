import { useState, useEffect } from "react";
import { VocabularyEntry, WebSocketMessage } from "./types";
import { useAppStore } from "./store";
import { BookmarkIcon, BookmarkSquareIcon } from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolidIcon } from "@heroicons/react/24/solid";

export const PracticeVocabulary = ({
  messages,
}: {
  messages: Array<WebSocketMessage>;
}) => {
  const [vocabulary, setVocabulary] = useState<VocabularyEntry[]>([]);

  useEffect(() => {
    // Collect unique vocabulary items from all transcription messages
    const vocabMap = new Map<string, VocabularyEntry>();

    messages.forEach((msg) => {
      if (msg.type === "transcription" && msg.dictionary) {
        Object.entries(msg.dictionary).forEach(([term, entry]) => {
          vocabMap.set(term, {
            ...entry,
            context_source: msg.source_text,
            context_translated: msg.translated_text,
          });
        });
      }
      if (msg.type === "translation" && msg.dictionary) {
        Object.entries(msg.dictionary).forEach(([term, entry]) => {
          vocabMap.set(term, {
            ...entry,
            context_source: msg.source_text,
            context_translated: msg.translated_text,
          });
        });
      }
    });

    // Convert to sorted array
    const sortedVocab = Array.from(vocabMap.entries())
      .map(([term, entry]) => ({ term, entry }))
      .sort((a, b) => a.term.localeCompare(b.term));

    setVocabulary(sortedVocab.map((item) => item.entry));
  }, [messages]);

  if (vocabulary.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 max-h-[600px] overflow-y-auto">
      <div className="flex justify-end mb-4">
        <BookmarkAllButton vocabulary={vocabulary} />
      </div>
      <div className="space-y-3">
        {vocabulary.map((entry) => (
          <div
            key={entry.source_text}
            className="group hover:bg-indigo-50 p-2 rounded-md transition-colors flex justify-between items-start"
          >
            <div className="flex-1">
              <div className="text-md font-medium text-gray-900">
                {entry.source_text}
              </div>
              <div className="text-sm text-gray-600">
                {entry.translated_text}
              </div>
              {entry.notes && (
                <div className="text-xs text-gray-500 italic group-hover:block">
                  {entry.notes}
                </div>
              )}
            </div>
            <SaveVocabButton entry={entry} />
          </div>
        ))}
      </div>
    </div>
  );
};

interface SaveVocabButtonProps {
  entry: VocabularyEntry;
}

const BookmarkAllButton = ({
  vocabulary,
}: {
  vocabulary: VocabularyEntry[];
}) => {
  const add = useAppStore((state) => state.vocabulary.add);
  const exists = useAppStore((state) => state.vocabulary.exists);

  const handleBookmarkAll = () => {
    vocabulary.forEach((entry) => {
      if (!exists(entry.source_text)) {
        add(entry);
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

const SaveVocabButton = ({ entry }: SaveVocabButtonProps) => {
  const add = useAppStore((state) => state.vocabulary.add);
  const remove = useAppStore((state) => state.vocabulary.remove);
  const isSaved = useAppStore((state) => state.vocabulary.exists(entry.source_text));

  const handleClick = () => {
    if (isSaved) {
      remove(entry.source_text);
    } else {
      add(entry);
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
