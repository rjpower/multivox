import {
  ArrowLeftCircleIcon,
  BookOpenIcon,
  MicrophoneIcon,
  LanguageIcon,
  PaperAirplaneIcon,
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
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-4 mb-4 overflow-y-auto">
        <ChatMessages
          messages={chatHistory.getMessages()}
          messageInputRef={messageInputRef}
        />
      </div>

      <div className="border-t border-base-200 bg-base-100 px-4 py-2">
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
          className="flex items-center gap-2"
        >
          <button
            type="button"
            onClick={isRecording ? onStopRecording : onStartRecording}
            className={`btn btn-circle ${
              isRecording ? "btn-error" : "btn-ghost"
            }`}
          >
            <MicrophoneIcon
              className={`h-5 w-5 ${isRecording ? "animate-pulse" : ""}`}
            />
          </button>

          <input
            ref={messageInputRef}
            type="text"
            name="message"
            placeholder="Type your message..."
            className="input input-bordered flex-1"
          />

          <button
            type="submit"
            className="btn btn-ghost btn-circle"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

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
        <label className="block text-sm font-medium text-gray-700 mb-1">
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
        <label className="block text-sm font-medium text-gray-700 mb-2">
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

const ScenarioContent = () => {
  const [isLoading, setIsLoading] = useState(true);
  const practiceState = usePracticeStore((state) => state.practiceState);
  const connect = usePracticeStore((state) => state.connect);
  const practiceLanguage = useAppStore((state) => state.practiceLanguage);
  const nativeLanguage = useAppStore((state) => state.nativeLanguage);
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

  if (practiceState !== PracticeState.WAITING) {
    return null;
  }

  const scenario = userScenario || systemScenario;

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
    <>
      {scenarioId.startsWith("custom-") ? (
        <ScenarioEditor />
      ) : (
        <ScenarioViewer scenario={scenario} />
      )}
      <PracticeControls
        onStart={() =>
          connect(scenario.instructions, practiceLanguage, nativeLanguage)
        }
      />
    </>
  );
};

const ChatContent = () => {
  const practiceState = usePracticeStore((state) => state.practiceState);
  const isRecording = usePracticeStore((state) => state.isRecording);
  const chatHistory = usePracticeStore((state) => state.chatHistory);
  const startRecording = usePracticeStore((state) => state.startRecording);
  const stopRecording = usePracticeStore((state) => state.stopRecording);
  const sendMessage = usePracticeStore((state) => state.sendMessage);

  if (practiceState === PracticeState.WAITING) {
    return null;
  }

  return (
    <ChatInterface
      isRecording={isRecording}
      chatHistory={chatHistory}
      onStartRecording={startRecording}
      onStopRecording={() => {
        stopRecording();
      }}
      onSendMessage={sendMessage}
    />
  );
};

const ScenarioViewer = ({ scenario }: ScenarioViewerProps) => {
  return (
    <div className="space-y-6">
      <h2 className="card-title text-2xl">Practice: {scenario.title}</h2>
      <p className="text-base-content/70 whitespace-pre-wrap">
        {scenario.description}
      </p>

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

const TranslatingModal = () => {
  return (
    <div className="modal modal-open">
      <div className="modal-box flex items-center space-x-4">
        <LanguageIcon className="h-8 w-8 text-primary animate-spin" />
        <div>
          <h3 className="text-lg font-medium">
            Translating Instructions
          </h3>
          <p className="text-gray-500">
            Please wait while we prepare your practice session...
          </p>
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

      <button onClick={handleStart} className="btn btn-primary">
        Start Practice
      </button>
    </div>
  );
};

const ErrorDisplay = ({
  error,
  onDismiss,
}: {
  error: { type: string | null; message: string | null };
  onDismiss: () => void;
}) => {
  if (!error.type || !error.message) return null;

  const errorTitles = {
    translation: "Translation Error",
    connection: "Connection Error",
    recording: "Recording Error",
  };

  return (
    <div className="alert alert-error mb-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <XCircleIcon className="h-5 w-5" />
        </div>
        <div className="ml-3">
          <h3 className="font-medium">
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
              className="btn btn-circle btn-ghost btn-sm"
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
  const [isVocabVisible, setIsVocabVisible] = useState(false);
  const { scenarioId = "" } = useParams<{ scenarioId: string }>();
  const navigate = useNavigate();
  const error = usePracticeStore((state) => state.error);
  const clearError = usePracticeStore((state) => state.clearError);
  const chatHistory = usePracticeStore((state) => state.chatHistory);

  const reset = usePracticeStore((state) => state.reset);
  useEffect(() => {
    // Reset state when scenarioId changes or component unmounts
    reset();
    return () => reset();
  }, [reset, scenarioId]);

  const isTranslating = usePracticeStore(
    (state) => state.practiceState === PracticeState.TRANSLATING
  );

  if (isTranslating) {
    return <TranslatingModal />;
  }

  console.log("Scenario ID", scenarioId);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-base-200 p-4">
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

          <ErrorDisplay error={error} onDismiss={clearError} />

          <div className="flex flex-col lg:flex-row gap-4 relative">
            <div className="absolute top-4 right-4 lg:hidden">
              <button
                onClick={() => setIsVocabVisible(!isVocabVisible)}
                className="btn btn-circle btn-ghost"
              >
                <BookOpenIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1">
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                <ScenarioContent />
                <ChatContent />
                </div>
              </div>
            </div>
            <div
              className={`
              fixed lg:relative top-0 right-0 h-full 
              w-80 bg-white lg:bg-transparent
              transform transition-transform duration-300 ease-in-out
              ${
                isVocabVisible
                  ? "translate-x-0"
                  : "translate-x-full lg:translate-x-0"
              }
              lg:w-80 lg:shrink-0 
              shadow-lg lg:shadow-none
              z-50 lg:z-auto
            `}
            >
              <div className="lg:hidden navbar bg-base-100">
                <h3 className="navbar-start font-medium">Vocabulary</h3>
                <button
                  onClick={() => setIsVocabVisible(false)}
                  className="navbar-end btn btn-circle btn-ghost btn-sm"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <PracticeVocabulary messages={chatHistory.getMessages()} />
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};
