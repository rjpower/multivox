import { useState, useEffect, useRef, useCallback } from "react";
import { ScenarioList } from "./ScenarioList";
import { AudioRecorder } from "./AudioRecorder";
import { ChatHistory, ChatMessage } from "./ChatHistory";
import { VocabularyList } from "./VocabularyList";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useParams,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import type {
  DictionaryEntry,
  Scenario,
  TranscribeResponse,
  TranslateRequest,
  TranslateResponse,
} from "./types";
import { TypedWebSocket } from "./types";
import { AudioPlayer } from "./AudioPlayer";

const Home = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("ja");

  useEffect(() => {
    fetch("/api/scenarios")
      .then((res) => res.json())
      .then((data) => setScenarios(data));
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Language Practice
        </h1>

        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Practice Language
          </label>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="ja">Japanese</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="it">Italian</option>
          </select>
        </div>

        <div className="bg-white rounded-lg shadow-md">
          <ScenarioList 
            scenarios={scenarios} 
            selectedLanguage={selectedLanguage} 
          />
        </div>
      </div>
    </div>
  );
};

const ScenarioInstructions = ({
  scenario,
  onStart,
}: {
  scenario: Scenario | null;
  onStart: (translatedText: string) => void;
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const language = searchParams.get("lang") ?? "ja";

  if (!scenario) return null;

  const handleStart = async () => {
    setIsLoading(true);
    try {
      // Then get translation and send as first message
      const request: TranslateRequest = {
        text: scenario.instructions,
        language: language,
      };
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const data: TranslateResponse = await response.json();
      onStart(data.translation);
    } catch (error) {
      console.error("Translation failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-4">
      <h3 className="text-xl font-semibold mb-4">{scenario.title}</h3>
      <p className="text-gray-600 mb-6 whitespace-pre-wrap">{scenario.instructions}</p>
      <button
        onClick={handleStart}
        disabled={isLoading}
        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
      >
        {isLoading ? "Translating..." : "Start Practice"}
      </button>
    </div>
  );
};

const TranscriptionChunk = ({
  term,
  dictionary,
}: {
  term: string;
  dictionary: Record<string, DictionaryEntry>;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Find the longest matching dictionary key that is contained in this term
  const match = Object.keys(dictionary)
    .filter((key) => term.includes(key))
    .sort((a, b) => b.length - a.length)[0];

  if (!match) {
    return <span>{term}</span>;
  }

  const translation = dictionary[match].translation;

  return (
    <span
      className={`
        cursor-pointer 
        inline-block px-2 py-0.5 mx-0.5 my-0.5
        rounded-full 
        ${
          isOpen
            ? "bg-indigo-200 shadow-inner"
            : "bg-indigo-50 hover:bg-indigo-100 hover:shadow-sm"
        }
        border border-indigo-200
        transition-all duration-200
        relative
      `}
      onClick={() => setIsOpen(!isOpen)}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {term}
      {isOpen && (
        <div
          className="
          absolute top-full left-1/2 transform -translate-x-1/2 mt-1 z-10
          px-3 py-2 rounded-lg shadow-lg
          bg-white border border-gray-200
          text-sm text-gray-700
          min-w-[150px]
        "
        >
          <div className="font-medium mb-1">{translation}</div>
          {/* Add notes if they exist */}
        </div>
      )}
    </span>
  );
};

const TranscriptionMessage = ({ data }: { data: TranscribeResponse }) => {
  const [showTranslation, setShowTranslation] = useState(false);

  return (
    <div className="space-y-3">
      <div className="text-sm leading-relaxed">
        {data.chunked.map((term: string, idx: number) => (
          <TranscriptionChunk
            key={idx}
            term={term}
            dictionary={data.dictionary}
          />
        ))}
      </div>
      {data.translation && (
        <button
          onClick={() => setShowTranslation(!showTranslation)}
          className="text-xs text-indigo-600 hover:text-indigo-800"
        >
          {showTranslation ? "Hide" : "Show"} Translation
        </button>
      )}
      {showTranslation && data.translation && (
        <div className="text-sm text-gray-600 italic">{data.translation}</div>
      )}
    </div>
  );
};

const ChatMessages = ({ messages }: { messages: ChatMessage[] }) => {
  return (
    <div className="p-4 bg-gray-50 rounded-lg shadow-inner min-h-[400px] max-h-[400px] overflow-y-auto">
      <div className="space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.role === "assistant" ? "justify-start" : "justify-end"
            }`}
          >
            {(() => {
              switch (msg.content.type) {
                case "transcription":
                  return (
                    <div
                      className={`max-w-[80%] px-4 py-2 ${
                        msg.role === "assistant"
                          ? "text-gray-600"
                          : "text-indigo-300"
                      }`}
                    >
                      <TranscriptionMessage data={msg.content.transcription} />
                    </div>
                  );
                case "audio":
                  return (
                    <div
                      className={`max-w-[80%] px-4 py-2 rounded-lg ${
                        msg.role === "assistant"
                          ? "bg-white text-gray-800 shadow"
                          : "bg-indigo-600 text-white"
                      }`}
                    >
                      {msg.content.placeholder}
                    </div>
                  );
                case "text":
                  return (
                    <div
                      className={`max-w-[80%] px-4 py-2 rounded-lg ${
                        msg.role === "assistant"
                          ? "bg-white text-gray-800 shadow"
                          : "bg-indigo-600 text-white"
                      }`}
                    >
                      {msg.content.text}
                    </div>
                  );
              }
            })()}
          </div>
        ))}
      </div>
    </div>
  );
};

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
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <button
          onClick={isRecording ? onStopRecording : onStartRecording}
          className={`px-4 py-2 text-white rounded-md ${
            isRecording
              ? "bg-gray-600 hover:bg-gray-700"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {isRecording ? "Stop Recording" : "Start Recording"}
        </button>
      </div>

      <ChatMessages messages={chatHistory.getMessages()} />

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
        className="flex space-x-2"
      >
        <input
          type="text"
          name="message"
          placeholder="Type your message..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
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

const usePracticeSession = (language: string) => {
  const [recorder, setRecorder] = useState<AudioRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistory>(
    new ChatHistory()
  );
  const [wsState, setWsState] = useState<{
    ws: TypedWebSocket | null;
    isConnected: boolean;
    isConnecting: boolean;
  }>({
    ws: null,
    isConnected: false,
    isConnecting: false
  });
  const audioPlayer = useRef<AudioPlayer>(new AudioPlayer());

  const startRecording = async () => {
    try {
      if (recorder) {
        await recorder.startRecording();
        setIsRecording(true);
        setChatHistory((prev: ChatHistory) =>
          prev.addAudioMessage("user", true)
        );
      }
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  };

  const stopRecording = () => {
    if (recorder) {
      recorder.stopRecording();
      setIsRecording(false);
      setChatHistory((prev: ChatHistory) =>
        prev.addAudioMessage("user", false)
      );
    }
  };

  const connect = useCallback(() => {
    if (wsState.ws || wsState.isConnecting) return; // Already connected or connecting
    
    setWsState(prev => ({ ...prev, isConnecting: true }));
    const ws = new TypedWebSocket(
      `ws://localhost:8000/api/practice?lang=${language}`
    );

    ws.onopen = () => {
      console.log("WebSocket connected");
      setRecorder(new AudioRecorder(ws));
      setWsState({
        ws,
        isConnected: true,
        isConnecting: false
      });
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
      setWsState({
        ws: null,
        isConnected: false,
        isConnecting: false
      });
    };

      ws.onmessage = (message) => {
        switch (message.type) {
          case "text":
            if (message.text) {
              setChatHistory((prev) =>
                message.role === "assistant"
                  ? prev.updateLastAssistantMessage(
                      message.text!,
                      message.mode ?? "append"
                    )
                  : prev.addTextMessage(message.role, message.text!)
              );
            }
            break;
          case "transcription":
            setChatHistory((prev) =>
              prev.addTranscriptionMessage(message.role, message.transcription!)
            );
            break;
          case "audio":
            if (message.audio) {
              audioPlayer.current.resume();
              audioPlayer.current.addAudioToQueue(message.audio);
              setChatHistory((prev) => prev.addAudioMessage(message.role));
            }
            break;
        }
      };

      return () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send({ type: "text", text: "disconnect", role: "user" });
        }
      };
    },
    [language]
  );

  const sendMessage = useCallback((text: string) => {
    if (!wsState.ws || wsState.ws.readyState !== WebSocket.OPEN) {
      console.error("WebSocket not connected");
      return;
    }

    // Update chat history first
    setChatHistory((prev) => prev.addTextMessage("user", text));

    // Then send to server
    wsState.ws.send({
      type: "text",
      text,
      role: "user",
    });
  }, [wsState.ws]);

  return {
    isConnected: wsState.isConnected,
    isConnecting: wsState.isConnecting,
    isRecording,
    chatHistory,
    connect,
    startRecording,
    stopRecording,
    sendMessage,
    ws: wsState.ws,
  };
};

const Practice = () => {
  const { scenarioId = "" } = useParams<{ scenarioId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const language = searchParams.get("lang") ?? "ja";
  const [scenario, setScenario] = useState<Scenario | null>(null);

  const {
    isConnected,
    isConnecting,
    isRecording,
    chatHistory,
    connect,
    startRecording,
    stopRecording,
    sendMessage,
    ws,
  } = usePracticeSession(language);

  // Fetch scenario
  useEffect(() => {
    fetch("/api/scenarios")
      .then((res) => res.json())
      .then((scenarios) => {
        const found = scenarios.find((s: Scenario) => s.id === scenarioId);
        setScenario(found || null);
      });
  }, [scenarioId]);

  // Connect when component mounts
  useEffect(() => {
    connect();
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [connect]);

  const handleStartSession = async (instructions: string) => {
    sendMessage(instructions);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-6">
        <button
          onClick={() => navigate("/")}
          className="mb-4 text-indigo-600 hover:text-indigo-800"
        >
          ← Back to scenarios
        </button>

        <div className="flex gap-6">
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold mb-4">Practice Session</h2>

              <div
                className={`space-y-4 ${
                  isConnecting || !isConnected
                    ? "opacity-50 pointer-events-none"
                    : ""
                }`}
              >
                {!isConnected ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Connecting...</p>
                  </div>
                ) : (
                  <>
                    {chatHistory.getMessages().length === 0 ? (
                      <ScenarioInstructions
                        scenario={scenario}
                        onStart={handleStartSession}
                      />
                    ) : (
                      <ChatInterface
                        isRecording={isRecording}
                        chatHistory={chatHistory}
                        onStartRecording={startRecording}
                        onStopRecording={stopRecording}
                        onSendMessage={sendMessage}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="w-80 shrink-0">
            <VocabularyList messages={chatHistory.getMessages()} />
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/practice/:scenarioId" element={<Practice />} />
      </Routes>
    </Router>
  );
}

export default App;
