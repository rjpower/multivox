import { VocabularyEntry } from "../types";
import { BookmarkSquareIcon } from "@heroicons/react/24/outline";
import { useVocabulary } from "../stores/app";
import { VocabItem } from "../components/VocabItem";

interface PracticeVocabularyProps {
  vocabulary: VocabularyEntry[];
}

export const PracticeVocabulary = ({ vocabulary }: PracticeVocabularyProps) => {
  const { add, remove, exists } = useVocabulary();

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
