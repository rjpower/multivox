import {
  ArrowLeftCircleIcon,
  InformationCircleIcon,
  MicrophoneIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChatHistory } from "./ChatHistory";
import { ChatMessages } from "./ChatMessages";
import { ErrorBoundary } from "./ErrorBoundary";
import { PracticeVocabulary } from "./PracticeVocabulary";
import { PracticeState, useAppStore } from "./store";
import { type Scenario } from "./types";


const ChatInterface = ({
  isRecording,
  chatHistory,
  onStartRecording,
  onStopRecording,
  onSendMessage,
}: {
  isRecording: boolean;
  chatHistory: ChatHistory;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => void;
  onSendMessage: (text: string) => void;
}) => {
  const messageInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-4">
      <ChatMessages
        messages={chatHistory.getMessages()}
        messageInputRef={messageInputRef}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem(
            "message"
          ) as HTMLInputElement;
          const text = input.value.trim();
          if (text) {
            onSendMessage(text);
            input.value = "";
          }
        }}
        className="flex space-x-2 items-center"
      >
        <div className="flex-1 flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500">
          <input
            ref={messageInputRef}
            type="text"
            name="message"
            placeholder="Type your message..."
            className="flex-1 focus:outline-none"
          />
          <button
            type="button"
            onClick={isRecording ? onStopRecording : onStartRecording}
            className={`p-1.5 rounded-full transition-colors ${
              isRecording
                ? "bg-red-100 text-red-600 hover:bg-red-200"
                : "hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            }`}
          >
            <MicrophoneIcon className={`h-5 w-5 ${isRecording ? 'animate-pulse' : ''}`} />
          </button>
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Send
        </button>
      </form>
    </div>
  );
};

const ScenarioInstructions = ({ scenario }: { scenario: Scenario | null }) => {
  const [isLoading, setIsLoading] = useState(false);
  const practice = useAppStore((state) => state.practice);
  const modality = practice.modality;
  const setModality = practice.setModality;
  const customInstructions = practice.customInstructions;
  const setCustomInstructions = practice.setCustomInstructions;
  const connect = practice.connect;
  const selectedLanguage = useAppStore((state) => state.selectedLanguage);

  if (!scenario) return null;

  const handleStart = async () => {
    setIsLoading(true);
    try {
      await connect(
        customInstructions ?? scenario.instructions,
        selectedLanguage
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-4 mb-6">
        <p className="text-gray-600 whitespace-pre-wrap">
          {scenario.description}
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Instructions
          </label>
          <textarea
            value={customInstructions ?? scenario.instructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">
            Response Type:
          </label>
          <div className="flex rounded-md shadow-sm">
            <button
              onClick={() => setModality("audio")}
              className={`px-4 py-2 text-sm font-medium rounded-l-md border ${
                modality === "audio"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              Voice
            </button>
            <button
              onClick={() => setModality("text")}
              className={`px-4 py-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
                modality === "text"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              Text
            </button>
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={isLoading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
        >
          {isLoading ? "Translating..." : "Start Practice"}
        </button>
      </div>
    </>
  );
};

export const Practice = () => {
  const { scenarioId = "" } = useParams<{ scenarioId: string }>();
  const navigate = useNavigate();
  const [scenario, setScenario] = useState<Scenario | null>(null);

  const practice = useAppStore((state) => state.practice);
  const isRecording = practice.isRecording;
  const chatHistory = practice.chatHistory;
  const startRecording = practice.startRecording;
  const stopRecording = practice.stopRecording;
  const sendMessage = practice.sendMessage;
  const reset = practice.reset;

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const systemScenarios = useAppStore((state) => state.systemScenarios);
  const userScenarios = useAppStore((state) => state.userScenarios);
  const addUserScenario = useAppStore((state) => state.addUserScenario);
  const updateUserScenario = useAppStore((state) => state.updateUserScenario);
  const scenariosLoading = systemScenarios.length === 0;

  useEffect(() => {
    if (!scenariosLoading) {
      if (
        scenarioId.startsWith("custom-") &&
        !userScenarios.find((s) => s.id === scenarioId)
      ) {
        setScenario({
          id: "custom",
          title: "New Scenario",
          description: "Create your own custom practice scenario.",
          instructions: "Enter your custom instructions here...",
        });
      } else {
        const found =
          systemScenarios.find((s) => s.id === scenarioId) ||
          userScenarios.find((s) => s.id === scenarioId);
        setScenario(found || null);
      }
    }
  }, [scenarioId, systemScenarios, userScenarios, scenariosLoading]);

  const handleSave = () => {
    if (!scenario) return;

    if (
      scenarioId.startsWith("custom-") &&
      !userScenarios.find((s) => s.id === scenarioId)
    ) {
      addUserScenario({
        id: scenarioId,
        title: scenario.title,
        description: scenario.description,
        instructions: scenario.instructions || "",
      });
    } else {
      updateUserScenario(scenarioId, {
        title: scenario.title,
        description: scenario.description,
        instructions: scenario.instructions,
      });
    }
    navigate("/scenarios");
  };

  const practiceState = useAppStore((state) => state.practice.practiceState);
  const geminiApiKey = useAppStore((state) => state.geminiApiKey);

  useEffect(() => {
    if (!geminiApiKey) {
      navigate("/config");
    }
  }, [geminiApiKey, navigate]);

  const renderPractice = () => {
    if (practiceState === PracticeState.WAITING) {
      return <ScenarioInstructions scenario={scenario} />;
    }
    const LoadingDots = () => {
      return (
        <div className="flex space-x-2 items-center">
          <div className="w-2 h-2 bg-indigo-600 rounded-full animate-[bounce_1s_infinite_0ms]"></div>
          <div className="w-2 h-2 bg-indigo-600 rounded-full animate-[bounce_1s_infinite_200ms]"></div>
          <div className="w-2 h-2 bg-indigo-600 rounded-full animate-[bounce_1s_infinite_400ms]"></div>
        </div>
      );
    };

    if (practiceState === PracticeState.TRANSLATING) {
      return (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="text-gray-500">Translating instructions</div>
          <LoadingDots />
        </div>
      );
    }
    if (practiceState === PracticeState.CONNECTING) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Connecting...</div>
        </div>
      );
    }
    return (
      <ChatInterface
        isRecording={isRecording}
        chatHistory={chatHistory}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onSendMessage={sendMessage}
      />
    );
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => navigate("/scenarios")}
              className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <ArrowLeftCircleIcon className="h-5 w-5" />
              <span>Back to scenarios</span>
            </button>
            {scenarioId.startsWith("custom-") && (
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
              >
                <InformationCircleIcon className="h-5 w-5" />
                <span>Save Scenario</span>
              </button>
            )}
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <div className="bg-white rounded-lg shadow-md p-4">
                <h2 className="text-2xl font-bold mb-4">
                  Practice: {scenario?.title || "Loading..."}
                </h2>
                {renderPractice()}
              </div>
            </div>
            <div className="w-80 shrink-0">
              <PracticeVocabulary messages={chatHistory.getMessages()} />
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};
