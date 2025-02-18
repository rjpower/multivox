import { Link } from "react-router-dom";
import { PlayIcon } from "@heroicons/react/20/solid";
import type { Scenario } from "./types";


export const ScenarioList = ({
  scenarios,
  onDelete,
  isCustom = false,
}: {
  scenarios: Scenario[];
  onDelete?: (id: string) => void;
  isCustom?: boolean;
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Title
            </th>
            {isCustom && (
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {scenarios.map((scenario, index) => (
            <tr key={`${scenario.id}-${index}`} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link
                  to={`/practice/${scenario.id}`}
                  className="block group"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-900 group-hover:text-indigo-600">
                      {scenario.title}
                    </div>
                    <div className="ml-2 flex-shrink-0">
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-indigo-600 group-hover:text-white border border-indigo-600 group-hover:bg-indigo-600 rounded">
                        <PlayIcon className="h-4 w-4 mr-1" />
                        Practice
                      </span>
                    </div>
                  </div>
                </Link>
              </td>
              {isCustom && (
                <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                  <Link
                    to={`/practice/${scenario.id}?mode=edit`}
                    className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Edit
                  </Link>
                  {onDelete && (
                    <button
                      onClick={() => onDelete(scenario.id)}
                      className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Delete
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
