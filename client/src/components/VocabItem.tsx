import { VocabularyEntry } from "../types";
import { BookmarkIcon } from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolidIcon } from "@heroicons/react/24/solid";
import { TrashIcon } from "@heroicons/react/24/outline";

interface VocabItemProps {
  entry: VocabularyEntry;
  mode: "practice" | "review";
  onSave?: () => void;
  onDelete?: () => void;
  saved?: boolean;
}

export const VocabItem = ({
  entry,
  mode,
  onSave,
  onDelete,
  saved,
}: VocabItemProps) => {
  const renderAction = () => {
    if (mode === "practice") {
      return (
        <button
          onClick={onSave}
          className={`btn btn-ghost btn-sm ${
            saved ? "" : "opacity-50 hover:opacity-100"
          }`}
          title={saved ? "Remove from vocabulary" : "Save to vocabulary"}
        >
          {saved ? (
            <BookmarkSolidIcon className="h-5 w-5" />
          ) : (
            <BookmarkIcon className="h-5 w-5" />
          )}
        </button>
      );
    }
    return (
      <button
        onClick={onDelete}
        className="btn btn-ghost btn-sm text-error"
        title="Delete"
      >
        <TrashIcon className="h-5 w-5" />
      </button>
    );
  };

  if (mode === "practice") {
    return (
      <tr className="border-b border-base-200">
        <td colSpan={4} className="py-2">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-medium">{entry.source_text}</span>
                {entry.reading && entry.reading !== entry.source_text && (
                  <span className="text-sm opacity-70">({entry.reading})</span>
                )}
              </div>
              <div className="text-base opacity-70 mt-0.5">
                {entry.translated_text}
              </div>
              {entry.notes && (
                <div className="text-sm opacity-50 mt-0.5 italic">
                  {entry.notes}
                </div>
              )}
            </div>
            {renderAction()}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="block md:table-row border-b border-base-200">
      <td data-label="Term" className="block md:table-cell py-2 md:py-4">
        <span className="font-medium md:hidden mr-2">Term:</span>
        <div className="flex items-baseline gap-2">
          <span className="font-medium">{entry.source_text}</span>
          {entry.reading && entry.reading !== entry.source_text && (
            <span className="text-sm opacity-70">({entry.reading})</span>
          )}
        </div>
      </td>
      <td data-label="Translation" className="block md:table-cell py-2 md:py-4">
        <span className="font-medium md:hidden mr-2">Translation:</span>
        {entry.translated_text}
      </td>
      <td data-label="Notes" className="block md:table-cell py-2 md:py-4">
        <span className="font-medium md:hidden mr-2">Notes:</span>
        {entry.notes && (
          <span className="italic opacity-70">{entry.notes}</span>
        )}
      </td>
      <td data-label="Context" className="block md:table-cell py-2 md:py-4">
        <span className="font-medium md:hidden mr-2">Context:</span>
        {entry.context_source && <p>{entry.context_source}</p>}
      </td>
      <td
        data-label="Translated Context"
        className="block md:table-cell py-2 md:py-4"
      >
        <span className="font-medium md:hidden mr-2">Translated Context:</span>
        {entry.context_translated && <p>{entry.context_translated}</p>}
      </td>
      <td
        data-label="Actions"
        className="block md:table-cell py-2 md:py-4 text-right"
      >
        {renderAction()}
      </td>
    </tr>
  );
};
