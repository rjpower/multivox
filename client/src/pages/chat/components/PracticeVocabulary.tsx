import { useState, useEffect } from "react";
import { VocabularyEntry, WebSocketMessage } from "../../../types";
import { BookmarkIcon, BookmarkSquareIcon } from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolidIcon } from "@heroicons/react/24/solid";
import { useAppStore } from "../../../stores/app";

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
    <div className="card bg-base-100 shadow-xl h-full overflow-y-auto">
      <div className="card-body p-4">
        <div className="flex justify-end">
          <BookmarkAllButton vocabulary={vocabulary} />
        </div>
        <div className="space-y-3">
          {vocabulary.map((entry) => (
            <div
              key={entry.source_text}
              className="group hover:bg-base-200 p-2 rounded-md transition-colors flex justify-between items-start"
            >
              <div className="flex-1">
                <div className="text-md font-medium">{entry.source_text}</div>
                <div className="text-sm opacity-70">
                  {entry.translated_text}
                </div>
                {entry.notes && (
                  <div className="text-xs opacity-50 italic group-hover:block">
                    {entry.notes}
                  </div>
                )}
              </div>
              <SaveVocabButton entry={entry} />
            </div>
          ))}
        </div>
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
      className="btn btn-ghost btn-sm gap-1 normal-case"
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
  const isSaved = useAppStore((state) =>
    state.vocabulary.exists(entry.source_text)
  );

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
      className={`btn btn-ghost btn-sm ${
        isSaved ? "" : "opacity-50 hover:opacity-100"
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
