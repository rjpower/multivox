import { Link } from "react-router-dom";
import { ScenarioList } from "./ScenarioList";
import { useAppStore } from "./store";

export const ScenarioSelect = () => {
  const systemScenarios = useAppStore((state) => state.systemScenarios);
  const userScenarios = useAppStore((state) => state.userScenarios);
  const removeUserScenario = useAppStore((state) => state.removeUserScenario);

  return (
    <div className="min-h-screen bg-base-200">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-8">
          Conversation Practice Scenarios
        </h1>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">My Scenarios</h2>
            <Link
              to={`/practice/custom-${crypto.randomUUID()}`}
              className="btn btn-secondary btn-sm"
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
            <div className="text-base-content/70 text-center py-8 bg-base-100 rounded-lg">
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
