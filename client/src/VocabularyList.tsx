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
        <div className="text-center text-gray-500">
          No vocabulary items saved yet. Add items while practicing!
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Saved Vocabulary</h2>
        <div className="flex gap-2 sm:gap-4 w-full sm:w-auto">
          <button
            onClick={() => exportToCsv(items)}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-colors flex items-center gap-2"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span>CSV</span>
          </button>
          <button
            onClick={clear}
            className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors flex items-center gap-2"
          >
            <TrashIcon className="h-4 w-4" />
            <span>Delete All</span>
          </button>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Term
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Translation
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Notes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Context
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Translated Context
              </th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item) => (
              <tr key={item.source_text} className="hover:bg-gray-50">
                <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {item.source_text}
                </td>
                <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.translated_text}
                </td>
                <td className="px-3 sm:px-6 py-2 sm:py-4 text-sm text-gray-500">
                  {item.notes}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {item.context_source && <p>{item.context_source}</p>}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {item.context_translated && <p>{item.context_translated}</p>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() =>
                      useAppStore.getState().vocabulary.remove(item.source_text)
                    }
                    className="text-red-600 hover:text-red-900"
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
