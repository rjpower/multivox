import {
  ArrowLeftCircleIcon,
  InformationCircleIcon,
  MicrophoneIcon,
  LanguageIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChatHistory } from "./ChatHistory";
import { ChatMessages } from "./ChatMessages";
import { ErrorBoundary } from "./ErrorBoundary";
import { PracticeVocabulary } from "./PracticeVocabulary";
import { PracticeState, useAppStore, usePracticeStore } from "./store";
import { type Scenario } from "./types";

interface ScenarioEditorProps {
  scenario: Scenario;
  onChange: (updates: Partial<Scenario>) => void;
}

interface ScenarioViewerProps {
  scenario: Scenario;
}

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
      <div className="space-y-4 mb-4">
        <ChatMessages
          messages={chatHistory.getViewMessages()}
          messageInputRef={messageInputRef}
        />
      </div>

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
            <MicrophoneIcon
              className={`h-5 w-5 ${isRecording ? "animate-pulse" : ""}`}
            />
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

const ScenarioEditor = ({
  scenario,
  onChange,
}: ScenarioEditorProps) => {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Scenario Title
        </label>
        <input
          type="text"
          value={scenario.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="Give your scenario a descriptive title"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={scenario.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="Briefly describe the purpose and goals of this practice scenario"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Instructions
        </label>
        <textarea
          value={scenario.instructions}
          onChange={(e) => onChange({ instructions: e.target.value })}
          className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
    </div>
  );
};

const ScenarioContent = ({
  scenario,
  editableScenario,
  scenarioId,
  practiceState,
  selectedLanguage,
  onScenarioChange,
  onStart,
}: {
  scenario: Scenario | null;
  editableScenario: Scenario | null;
  scenarioId: string;
  practiceState: PracticeState;
  selectedLanguage: string;
  onScenarioChange: (updates: Partial<Scenario>) => void;
  onStart: (instructions: string, language: string) => Promise<void>;
}) => {
  if (!scenario || practiceState !== PracticeState.WAITING) {
    return null;
  }

  return (
    <>
      {scenarioId.startsWith("custom-") && editableScenario ? (
        <ScenarioEditor
          scenario={editableScenario}
          onChange={(updates) => onScenarioChange(updates)}
        />
      ) : (
        <ScenarioViewer scenario={scenario} />
      )}
      <PracticeControls
        onStart={() => onStart(scenario.instructions, selectedLanguage)}
      />
    </>
  );
};

const ChatContent = ({
  practiceState,
  isRecording,
  chatHistory,
  onStartRecording,
  onStopRecording,
  onSendMessage,
}: {
  practiceState: PracticeState;
  isRecording: boolean;
  chatHistory: ChatHistory;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => void;
  onSendMessage: (text: string) => void;
}) => {
  if (practiceState === PracticeState.WAITING) {
    return null;
  }

  return (
    <ChatInterface
      isRecording={isRecording}
      chatHistory={chatHistory}
      onStartRecording={onStartRecording}
      onStopRecording={onStopRecording}
      onSendMessage={onSendMessage}
    />
  );
};

const ScenarioViewer = ({ scenario }: ScenarioViewerProps) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Practice: {scenario.title}</h2>
      <p className="text-gray-600 whitespace-pre-wrap">
        {scenario.description}
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Instructions
        </label>
        <div className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
          {scenario.instructions}
        </div>
      </div>
    </div>
  );
};

const TranslatingModal = () => {
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl flex items-center space-x-4">
        <LanguageIcon className="h-8 w-8 text-indigo-500 animate-spin" />
        <div>
          <h3 className="text-lg font-medium text-gray-900">Translating Instructions</h3>
          <p className="text-gray-500">Please wait while we prepare your practice session...</p>
        </div>
      </div>
    </div>
  );
};

const PracticeControls = ({ onStart }: { onStart: () => Promise<void> }) => {
  const modality = usePracticeStore((state) => state.modality);
  const setModality = usePracticeStore((state) => state.setModality);

  const handleStart = async () => {
    await onStart();
  };

  return (
    <div className="space-y-4 mt-6">
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
        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
      >
        Start Practice
      </button>
    </div>
  );
};

const ErrorDisplay = ({ 
  error,
  onDismiss
}: { 
  error: { type: string | null; message: string | null };
  onDismiss: () => void;
}) => {
  if (!error.type || !error.message) return null;

  const errorTitles = {
    translation: "Translation Error",
    connection: "Connection Error",
    recording: "Recording Error"
  };

  return (
    <div className="rounded-md bg-red-50 p-4 mb-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <XCircleIcon className="h-5 w-5 text-red-400" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            {errorTitles[error.type as keyof typeof errorTitles]}
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{error.message}</p>
          </div>
        </div>
        <div className="ml-auto pl-3">
          <div className="-mx-1.5 -my-1.5">
            <button
              onClick={onDismiss}
              className="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100"
            >
              <span className="sr-only">Dismiss</span>
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Practice = () => {
  const { scenarioId = "" } = useParams<{ scenarioId: string }>();
  const navigate = useNavigate();
  const error = usePracticeStore((state) => state.error);
  const clearError = usePracticeStore((state) => state.clearError);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [editableScenario, setEditableScenario] = useState<Scenario | null>(
    null
  );
  const [saveSuccess, setSaveSuccess] = useState(false);

  const isRecording = usePracticeStore((state) => state.isRecording);
  const chatHistory = usePracticeStore((state) => state.chatHistory);
  const startRecording = usePracticeStore((state) => state.startRecording);
  const stopRecording = usePracticeStore((state) => state.stopRecording);
  const sendMessage = usePracticeStore((state) => state.sendMessage);
  const connect = usePracticeStore((state) => state.connect);

  const systemScenarios = useAppStore((state) => state.systemScenarios);
  const userScenarios = useAppStore((state) => state.userScenarios);
  const addUserScenario = useAppStore((state) => state.addUserScenario);
  const updateUserScenario = useAppStore((state) => state.updateUserScenario);
  const selectedLanguage = useAppStore((state) => state.selectedLanguage);
  const reset = usePracticeStore((state) => state.reset);
  useEffect(() => {
    // Reset state when scenarioId changes or component unmounts
    reset();
    return () => reset();
  }, [reset, scenarioId]);

  useEffect(() => {
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
      setScenario(newScenario);
      setEditableScenario(newScenario);
    } else {
      const found =
        systemScenarios.find((s) => s.id === scenarioId) ||
        userScenarios.find((s) => s.id === scenarioId);
      setScenario(found || null);
      if (found && scenarioId.startsWith("custom-")) {
        setEditableScenario(found);
      }
    }
  }, [scenarioId, systemScenarios, userScenarios]);

  const handleSave = () => {
    if (!editableScenario) return;

    const scenarioToSave = {
      id: scenarioId,
      title: editableScenario.title,
      description: editableScenario.description,
      instructions: editableScenario.instructions,
    };

    if (!userScenarios.find((s) => s.id === scenarioId)) {
      addUserScenario(scenarioToSave);
    } else {
      updateUserScenario(scenarioId, scenarioToSave);
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const practiceState = usePracticeStore((state) => state.practiceState);

  const isTranslating = usePracticeStore(
    (state) => state.practiceState === PracticeState.TRANSLATING
  );

  if (isTranslating) {
    return <TranslatingModal />;
  }

  console.log("Scenario ID", scenarioId);

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
              <div className="flex items-center gap-2">
                {saveSuccess && (
                  <span className="text-green-600 text-sm">
                    Saved successfully!
                  </span>
                )}
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
                >
                  <InformationCircleIcon className="h-5 w-5" />
                  <span>Save Scenario</span>
                </button>
              </div>
            )}
          </div>

          <ErrorDisplay error={error} onDismiss={clearError} />

          <div className="flex gap-4">
            <div className="flex-1">
              <div className="bg-white rounded-lg shadow-md p-4">
                <ScenarioContent
                  scenario={scenario}
                  editableScenario={editableScenario}
                  scenarioId={scenarioId}
                  practiceState={practiceState}
                  selectedLanguage={selectedLanguage}
                  onScenarioChange={(updates) =>
                    setEditableScenario((prev) =>
                      prev ? { ...prev, ...updates } : null
                    )
                  }
                  onStart={connect}
                />
                <ChatContent
                  practiceState={practiceState}
                  isRecording={isRecording}
                  chatHistory={chatHistory}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  onSendMessage={sendMessage}
                />
              </div>
            </div>
            <div className="w-80 shrink-0">
              <PracticeVocabulary messages={chatHistory.getViewMessages()} />
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};
