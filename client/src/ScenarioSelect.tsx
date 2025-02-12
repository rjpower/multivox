import { Link } from "react-router-dom";
import { ScenarioList } from "./ScenarioList";
import { useAppStore } from "./store";

export const ScenarioSelect = () => {
  const systemScenarios = useAppStore((state) => state.systemScenarios);
  const userScenarios = useAppStore((state) => state.userScenarios);
  const removeUserScenario = useAppStore((state) => state.removeUserScenario);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Language Practice
        </h1>

        <div className="flex justify-between items-center mb-8">
          <Link
            to={`/practice/custom-${crypto.randomUUID()}`}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Create Custom Scenario
          </Link>
        </div>

        {userScenarios.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              My Scenarios
            </h2>
            <div className="bg-white rounded-lg shadow-md">
              <ScenarioList
                scenarios={userScenarios}
                onDelete={removeUserScenario}
                isCustom={true}
              />
            </div>
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            System Scenarios
          </h2>
          <div className="bg-white rounded-lg shadow-md">
            <ScenarioList scenarios={systemScenarios} />
          </div>
        </div>
      </div>
    </div>
  );
};
