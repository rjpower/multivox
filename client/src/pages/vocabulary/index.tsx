import { useAppStore } from "../../stores/app";
import { TrashIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";

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
  const items = useAppStore((state) =>
    state.vocabulary
      .getAll()
      .sort((a, b) => a.source_text.localeCompare(b.source_text))
  );
  const clear = useAppStore((state) => state.vocabulary.clear);

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
                  <tr
                    key={item.source_text}
                    className="block md:table-row border-b border-base-200"
                  >
                    <td
                      data-label="Term"
                      className="block md:table-cell py-2 md:py-4"
                    >
                      <span className="font-medium md:hidden mr-2">Term:</span>
                      <span className="font-medium">{item.source_text}</span>
                    </td>
                    <td
                      data-label="Translation"
                      className="block md:table-cell py-2 md:py-4"
                    >
                      <span className="font-medium md:hidden mr-2">
                        Translation:
                      </span>
                      {item.translated_text}
                    </td>
                    <td
                      data-label="Notes"
                      className="block md:table-cell py-2 md:py-4"
                    >
                      <span className="font-medium md:hidden mr-2">Notes:</span>
                      {item.notes}
                    </td>
                    <td
                      data-label="Context"
                      className="block md:table-cell py-2 md:py-4"
                    >
                      <span className="font-medium md:hidden mr-2">
                        Context:
                      </span>
                      {item.context_source && <p>{item.context_source}</p>}
                    </td>
                    <td
                      data-label="Translated Context"
                      className="block md:table-cell py-2 md:py-4"
                    >
                      <span className="font-medium md:hidden mr-2">
                        Translated Context:
                      </span>
                      {item.context_translated && (
                        <p>{item.context_translated}</p>
                      )}
                    </td>
                    <td
                      data-label="Actions"
                      className="block md:table-cell py-2 md:py-4 text-right"
                    >
                      <button
                        onClick={() =>
                          useAppStore
                            .getState()
                            .vocabulary.remove(item.source_text)
                        }
                        className="btn btn-ghost btn-sm text-error"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
