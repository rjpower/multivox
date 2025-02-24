import { Link } from "react-router-dom";
import { ScenarioList } from "./ScenarioList";
import { useAtomValue } from "jotai";
import { systemScenariosAtom, useUserScenarios } from "../../stores/app";

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
