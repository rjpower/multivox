import { ArrowLeftCircleIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppStore } from "../../stores/app";
import { type Scenario } from "../../types";
import { useAtom } from "jotai"; // Import Jotai hook
import { modalityAtom } from "../chat/store";

interface ScenarioViewerProps {
  scenario: Scenario;
}

const ScenarioEditor = () => {
  const { scenarioId = "" } = useParams<{ scenarioId: string }>();
  const userScenarios = useAppStore((state) => state.userScenarios);
  const updateUserScenario = useAppStore((state) => state.updateUserScenario);

  const editableScenario = userScenarios.find((s) => s.id === scenarioId);

  const handleChange = (updates: Partial<Scenario>) => {
    if (scenarioId) {
      updateUserScenario({ ...editableScenario!, ...updates });
    }
  };

  if (!editableScenario) return null;

  return (
    <div className="space-y-6">
      <div>
        <label className="label">
          <span className="label-text">Scenario Title</span>
        </label>
        <input
          type="text"
          value={editableScenario.title}
          onChange={(e) => handleChange({ title: e.target.value })}
          className="input input-bordered w-full"
          placeholder="Give your scenario a descriptive title"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content mb-1">
          <span className="label-text">Description</span>
        </label>
        <textarea
          value={editableScenario.description}
          onChange={(e) => handleChange({ description: e.target.value })}
          rows={3}
          className="textarea textarea-bordered w-full"
          placeholder="Briefly describe the purpose and goals of this practice scenario"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-base-content mb-2">
          Instructions
        </label>
        <textarea
          value={editableScenario.instructions}
          onChange={(e) => handleChange({ instructions: e.target.value })}
          className="textarea textarea-bordered w-full h-32"
        />
      </div>
    </div>
  );
};

const ScenarioViewer = ({ scenario }: ScenarioViewerProps) => {
  return (
    <div className="space-y-6">
      <p className="text-base-content/70 mb-8">{scenario.description}</p>

      <div className="form-control">
        <label className="label">
          <span className="label-text">Instructions</span>
        </label>
        <div className="card bg-base-200">
          <div className="card-body min-h-[8rem] max-h-[12rem] overflow-y-auto">
            {scenario.instructions}
          </div>
        </div>
      </div>
    </div>
  );
};

const PracticeControls = ({ onStart }: { onStart: () => void }) => {
  const [modality, setModality] = useAtom(modalityAtom); // Replace Zustand with Jotai

  return (
    <div className="space-y-4 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
        <label className="label">
          <span className="label-text">Response Type:</span>
        </label>
        <div className="flex rounded-md shadow-sm">
          <button
            onClick={() => setModality("audio")}
            className={`btn join-item ${
              modality === "audio" ? "btn-primary" : ""
            }`}
          >
            Voice
          </button>
          <button
            onClick={() => setModality("text")}
            className={`btn join-item ${
              modality === "text" ? "btn-primary" : ""
            }`}
          >
            Text
          </button>
        </div>
      </div>

      <button onClick={onStart} className="btn btn-primary">
        Start Practice
      </button>
    </div>
  );
};

export const ScenarioPreview = () => {
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { scenarioId = "" } = useParams<{ scenarioId: string }>();

  const userScenarios = useAppStore((state) => state.userScenarios);
  const userScenario = userScenarios.find((s) => s.id === scenarioId);

  const systemScenarios = useAppStore((state) => state.systemScenarios);
  const systemScenario = systemScenarios.find((s) => s.id === scenarioId);

  const setUserScenario = useAppStore((state) => state.updateUserScenario);

  useEffect(() => {
    const initializeScenario = async () => {
      if (
        scenarioId.startsWith("custom-") &&
        !userScenarios.find((s) => s.id === scenarioId)
      ) {
        const newScenario = {
          id: scenarioId,
          title: "Custom Practice Scenario",
          description: "Description for your personal practice scenario.",
          instructions: `<Instructions for the assistant>, e.g.          
You are a local real-estate agent specializing in rentals.
You help clients find local apartments suitable for them.
You walk through the process of identifying appropriate apartments, scheduling viewings, and negotiating leases.

A client has entered and needs assistance.
`,
        };
        await setUserScenario(newScenario);
      }
      setIsLoading(false);
    };

    initializeScenario();
  }, [scenarioId, userScenarios, setUserScenario]);

  const scenario = userScenario || systemScenario;

  const handleStart = () => {
    if (scenario) {
      navigate(`/practice/${scenarioId}/chat`, {
        state: {
          instructions: scenario.instructions,
        },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (scenario === undefined) {
    return <div>Failed to find matching scenario for {scenarioId}</div>;
  }

  return (
    <div className="-m-8 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-4">
          <button
            onClick={() => navigate("/scenarios")}
            className="btn btn-ghost btn-sm gap-2"
          >
            <ArrowLeftCircleIcon className="h-5 w-5" />
            <span>Back to scenarios</span>
          </button>
        </div>

        <div className="bg-base-100 rounded-lg p-6 shadow-lg">
          {scenarioId.startsWith("custom-") ? (
            <ScenarioEditor />
          ) : (
            <ScenarioViewer scenario={scenario} />
          )}
          <PracticeControls onStart={handleStart} />
        </div>
      </div>
    </div>
  );
};
