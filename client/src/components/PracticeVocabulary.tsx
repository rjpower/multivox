import { VocabularyEntry } from "../types";
import { BookmarkSquareIcon } from "@heroicons/react/24/outline";
import { useVocabulary } from "../stores/app";
import { VocabItem } from "../components/VocabItem";

interface PracticeVocabularyProps {
  wordList: VocabularyEntry[];
}

const BookmarkAllButton = ({ wordList }: { wordList: VocabularyEntry[] }) => {
  const { addAll, removeAll, exists } = useVocabulary();
  const allSaved =
    wordList.length > 0 && wordList.every((entry) => exists(entry.source_text));

  console.log("allSaved", allSaved);

  const handleBookmarkAll = () => {
    if (allSaved) {
      removeAll(wordList.map((entry) => entry.source_text));
    } else {
      addAll(wordList);
    }
  };

  return (
    <button
      onClick={handleBookmarkAll}
      className="btn btn-ghost btn-sm gap-1 normal-case"
      title={allSaved ? "Remove all from vocabulary" : "Save all to vocabulary"}
    >
      <BookmarkSquareIcon className="h-5 w-5" />
      <span className="text-sm">{allSaved ? "Remove All" : "Save All"}</span>
    </button>
  );
};

export const PracticeVocabulary = ({ wordList }: PracticeVocabularyProps) => {
  const { addAll, removeAll, exists } = useVocabulary();

  if (wordList.length === 0) {
    return null;
  }

  return (
    <div className="card bg-base-100 shadow-xl h-full overflow-y-auto">
      <div className="card-body p-4">
        <div className="flex justify-end">
          <BookmarkAllButton wordList={wordList} />
        </div>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <tbody>
              {wordList.map((entry) => (
                <VocabItem
                  key={entry.source_text}
                  entry={entry}
                  mode="practice"
                  saved={exists(entry.source_text)}
                  onSave={() => {
                    if (exists(entry.source_text)) {
                      removeAll([entry.source_text]);
                    } else {
                      addAll([entry]);
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
