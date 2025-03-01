import { useAtomValue } from "jotai";
import { Link } from "react-router-dom";
import { systemScenariosAtom, useUserScenarios } from "./store";

import { PlayIcon } from "@heroicons/react/20/solid";
import type { Scenario } from "../../types";

const ScenarioList = ({
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
            <Link to={`/practice/${scenario.id}`} className="flex-grow group">
              <div className="flex items-center">
                <div>
                  <div className="text-base-content group-hover:text-primary font-medium">
                    {scenario.title}
                  </div>
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
                    className="btn btn-warning btn-xs"
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

export const ScenarioSelect = () => {
  const systemScenarios = useAtomValue(systemScenariosAtom);
  const { userScenarios, removeUserScenario } = useUserScenarios();

  return (
    <div>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">My Scenarios</h2>
            <Link
              to={`/practice/custom-${crypto.randomUUID()}`}
              className="btn btn-sm"
            >
              <span className="mr-1">+</span> New Scenario
            </Link>
          </div>
          {userScenarios.length > 0 ? (
            <ScenarioList
              scenarios={userScenarios}
              onDelete={removeUserScenario}
              isCustom={true}
            />
          ) : (
            <div className="text-base-content/70 text-center py-8 bg-base-200 rounded-lg">
              Create your first custom scenario to get started
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">System Scenarios</h2>
          <ScenarioList scenarios={systemScenarios} />
        </div>
      </div>
    </div>
  );
};
