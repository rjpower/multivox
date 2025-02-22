import { useAppStore } from "./store";
import { TrashIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";

const exportToCsv = (items: any[]) => {
  const headers = ["Term", "Translation", "Notes", "Context", "Context Translation"];
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
    state.vocabulary.getAll().sort((a, b) => a.source_text.localeCompare(b.source_text))
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
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold">Saved Vocabulary</h2>
        <div className="flex gap-2 sm:gap-4 w-full sm:w-auto">
          <button
            onClick={() => exportToCsv(items)}
            className="btn btn-ghost btn-sm gap-2"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span>CSV</span>
          </button>
          <button
            onClick={clear}
            className="btn btn-error btn-sm gap-2"
          >
            <TrashIcon className="h-4 w-4" />
            <span>Delete All</span>
          </button>
        </div>
      </div>
      <div className="card bg-base-100 shadow-xl overflow-x-auto">
        <table className="table table-fixed">
          <thead>
            <tr>
              <th className="whitespace-nowrap">
                Term
              </th>
              <th>
                Translation
              </th>
              <th>Notes</th>
              <th>Context</th>
              <th>Translated Context</th>
              <th>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.source_text}>
                <td className="whitespace-nowrap font-medium">
                  {item.source_text}
                </td>
                <td className="whitespace-nowrap">
                  {item.translated_text}
                </td>
                <td>
                  {item.notes}
                </td>
                <td>
                  {item.context_source && <p>{item.context_source}</p>}
                </td>
                <td>
                  {item.context_translated && <p>{item.context_translated}</p>}
                </td>
                <td className="text-right">
                  <button
                    onClick={() =>
                      useAppStore.getState().vocabulary.remove(item.source_text)
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
  );
};
