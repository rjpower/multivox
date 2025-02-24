import { ArrowDownTrayIcon, TrashIcon } from "@heroicons/react/24/outline";
import { VocabItem } from "../../components/VocabItem";
import { useVocabulary } from "../../stores/app";

const exportToCsv = (items: any[]) => {
  const headers = [
    "Term",
    "Translation",
    "Notes",
    "Context",
    "Context Translation",
  ];
  const csvContent = [
    headers.join(","),
    ...items.map((item) =>
      [
        `"${item.source_text.replace(/"/g, '""')}"`,
        `"${item.translated_text.replace(/"/g, '""')}"`,
        `"${(item.notes || "").replace(/"/g, '""')}"`,
        `"${(item.context_source || "").replace(/"/g, '""')}"`,
        `"${(item.context_translated || "").replace(/"/g, '""')}"`,
      ].join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "vocabulary.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const VocabularyList = () => {
  const { items, clear, remove } = useVocabulary();

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center opacity-50">
          No vocabulary items saved yet. Add items while practicing!
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h1 className="text-3xl font-bold">Saved Vocabulary</h1>
            <div className="flex gap-2 sm:gap-4 w-full sm:w-auto">
              <button
                onClick={() => exportToCsv(items)}
                className="btn btn-ghost btn-sm gap-2"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                <span>Export CSV</span>
              </button>
              <button onClick={clear} className="btn btn-error btn-sm gap-2">
                <TrashIcon className="h-4 w-4" />
                <span>Delete All</span>
              </button>
            </div>
          </div>
          <p className="text-base-content/70">
            Review and manage your saved vocabulary items. You can export them
            to CSV format or remove items you no longer need.
          </p>
        </div>
        <div className="bg-base-100 rounded-lg shadow-lg overflow-x-auto">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead className="hidden md:table-header-group">
                <tr>
                  <th className="whitespace-nowrap">Term</th>
                  <th>Translation</th>
                  <th>Notes</th>
                  <th>Context</th>
                  <th>Translated Context</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <VocabItem
                    key={item.source_text}
                    entry={item}
                    mode="review"
                    onDelete={() => remove(item.source_text)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
