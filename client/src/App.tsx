import { useState, useEffect, useRef, useCallback } from "react";
import { AudioRecorder } from "./AudioRecorder";
import { ChatHistory, ChatMessage } from "./ChatHistory";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useParams,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import type { Scenario, TranslateRequest, TranslateResponse } from "./types";
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <h3 className="text-xl font-semibold mb-2">{scenario.title}</h3>
              <p className="text-gray-600 mb-4">{scenario.instructions}</p>
              <Link
                to={`/practice/${scenario.id}?lang=${selectedLanguage}`}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Start Practice
              </Link>
            </div>
          ))}
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
      <p className="text-gray-600 mb-6">{scenario.instructions}</p>
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
            <div
              className={`max-w-[80%] px-4 py-2 rounded-lg ${
                msg.role === "assistant"
                  ? "bg-white text-gray-800 shadow"
                  : "bg-indigo-600 text-white"
              }`}
            >
              {msg.content}
            </div>
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
  const [chatHistory, setChatHistory] = useState<ChatHistory>(new ChatHistory());
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<TypedWebSocket | null>(null);
  const audioPlayer = useRef<AudioPlayer>(new AudioPlayer());

  const startRecording = async () => {
    try {
      if (recorder) {
        await recorder.startRecording();
        setIsRecording(true);
        setChatHistory((prev: ChatHistory) => prev.addMessage("user", "🎤 Recording..."));
      }
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  };

  const stopRecording = () => {
    if (recorder) {
      recorder.stopRecording();
      setIsRecording(false);
      setChatHistory((prev: ChatHistory) => prev.addMessage("user", "🎤 Recording stopped"));
    }
  };

  const connect = useCallback((initialText: string) => {
    const ws = new TypedWebSocket(
      `ws://localhost:8000/api/practice?lang=${language}`
    );

    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      setRecorder(new AudioRecorder(ws));
      ws.send({
        type: "text",
        text: initialText,
        role: "user",
      });
      setIsConnected(true);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
      setIsConnected(false);
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
                : prev.addMessage(message.role, message.text!)
            );
          }
          break;
        case "audio":
          if (message.audio) {
            audioPlayer.current.resume();
            audioPlayer.current.addAudioToQueue(message.audio);
            setChatHistory((prev) =>
              prev.addAudioAnnotation("assistant")
            );
          }
          break;
      }
    };

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send({ type: "text", text: "disconnect", role: "user" });
      }
    };
  }, [language]);


  const sendMessage = (text: string) => {
    if (wsRef.current) {
      wsRef.current.send({
        type: "text",
        text,
        role: "user",
      });
      setChatHistory((prev) => prev.addMessage("user", text));
    }
  };

  return {
    isConnected,
    isRecording,
    chatHistory,
    connect,
    startRecording,
    stopRecording,
    sendMessage,
    wsRef,
  };
};

const Practice = () => {
  const { scenarioId = "" } = useParams<{ scenarioId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const language = searchParams.get("lang") ?? "ja";
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [translatedInstructions, setTranslatedInstructions] = useState<string>("");
  
  const {
    isConnected,
    isRecording,
    chatHistory,
    connect,
    startRecording,
    stopRecording,
    sendMessage,
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

  // Start session when we have translated instructions
  useEffect(() => {
    if (translatedInstructions) {
      connect(translatedInstructions);
    }
  }, [translatedInstructions, connect]);

  const handleStartSession = async (instructions: string) => {
    setTranslatedInstructions(instructions);
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

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold mb-4">Practice Session</h2>

          {!isConnected ? (
            <ScenarioInstructions scenario={scenario} onStart={handleStartSession} />
          ) : (
            <ChatInterface
              isRecording={isRecording}
              chatHistory={chatHistory}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onSendMessage={sendMessage}
            />
          )}
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
