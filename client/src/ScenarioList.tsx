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
      <table className="table">
        <thead>
          <tr>
            <th>Title</th>
            {isCustom && <th className="text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {scenarios.map((scenario, index) => (
            <tr key={`${scenario.id}-${index}`}>
              <td>
                <Link
                  to={`/practice/${scenario.id}`}
                  className="block group"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-base-content group-hover:text-primary">
                      {scenario.title}
                    </div>
                    <div className="ml-2 flex-shrink-0">
                      <div className="badge badge-primary gap-2">
                        <PlayIcon className="h-4 w-4" />
                        Practice
                      </div>
                    </div>
                  </div>
                </Link>
              </td>
              {isCustom && (
                <td className="text-right space-x-1 whitespace-nowrap">
                  <Link
                    to={`/practice/${scenario.id}?mode=edit`}
                    className="btn btn-info btn-xs"
                  >
                    Edit
                  </Link>
                  {onDelete && (
                    <button
                      onClick={() => onDelete(scenario.id)}
                      className="btn btn-error btn-xs"
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
