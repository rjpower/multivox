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

        <div className="flex justify-between items-center mb-8">
          <Link
            to={`/practice/custom-${crypto.randomUUID()}`}
            className="btn btn-primary"
          >
            Create Custom Scenario
          </Link>
        </div>

        {userScenarios.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">My Scenarios</h2>
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body p-0">
                <ScenarioList
                  scenarios={userScenarios}
                  onDelete={removeUserScenario}
                  isCustom={true}
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-4">System Scenarios</h2>
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body p-0">
              <ScenarioList scenarios={systemScenarios} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
