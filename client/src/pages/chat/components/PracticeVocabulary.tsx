import { useState } from "react";
import { VocabularyEntry, WebSocketMessage } from "../../../types";
import { BookmarkSquareIcon } from "@heroicons/react/24/outline";
import { useVocabulary } from "../../../stores/app";
import { VocabItem } from "../../../components/VocabItem";

export const PracticeVocabulary = ({
  messages,
}: {
  messages: Array<WebSocketMessage>;
}) => {
  const [vocabulary, setVocabulary] = useState<VocabularyEntry[]>([]);
  const { add, remove, exists } = useVocabulary();

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

  if (vocabulary.length === 0) {
    return null;
  }

  return (
    <div className="card bg-base-100 shadow-xl h-full overflow-y-auto">
      <div className="card-body p-4">
        <div className="flex justify-end">
          <BookmarkAllButton vocabulary={vocabulary} />
        </div>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <tbody>
              {vocabulary.map((entry) => (
                <VocabItem
                  key={entry.source_text}
                  entry={entry}
                  mode="practice"
                  saved={exists(entry.source_text)}
                  onSave={() => {
                    if (exists(entry.source_text)) {
                      remove(entry.source_text);
                    } else {
                      add(entry);
                    }
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const BookmarkAllButton = ({
  vocabulary,
}: {
  vocabulary: VocabularyEntry[];
}) => {
  const { add, remove, exists } = useVocabulary();
  const allSaved =
    vocabulary.length > 0 &&
    vocabulary.every((entry) => exists(entry.source_text));

  const handleBookmarkAll = () => {
    if (allSaved) {
      // Remove all items
      vocabulary.forEach((entry) => {
        remove(entry.source_text);
      });
    } else {
      // Add all missing items
      vocabulary.forEach((entry) => {
        if (!exists(entry.source_text)) {
          add(entry);
        }
      });
    }
  };

  return (
    <button
      onClick={handleBookmarkAll}
      className="btn btn-ghost btn-sm gap-1 normal-case"
      title={allSaved ? "Remove all from vocabulary" : "Save all to vocabulary"}
    >
      <BookmarkSquareIcon className="h-5 w-5" />
      <span className="text-sm">Save All</span>
    </button>
  );
};
