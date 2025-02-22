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
    <div className="space-y-2">
      {scenarios.map((scenario, index) => (
        <div 
          key={`${scenario.id}-${index}`}
          className="bg-base-100 p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <Link
              to={`/practice/${scenario.id}`}
              className="flex-grow group"
            >
              <div className="flex items-center">
                <div>
                  <div className="text-base-content group-hover:text-primary font-medium">
                    {scenario.title}
                  </div>
                  {scenario.description && (
                    <div className="text-sm text-base-content/70 mt-1 line-clamp-2">
                      {scenario.description}
                    </div>
                  )}
                </div>
                <div className="ml-4 flex-shrink-0">
                  <div className="badge badge-primary gap-2">
                    <PlayIcon className="h-4 w-4" />
                    Practice
                  </div>
                </div>
              </div>
            </Link>
            {isCustom && (
              <div className="flex-shrink-0 space-x-2">
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
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
