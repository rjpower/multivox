import { useState, useEffect, useRef } from "react";
import { AudioRecorder } from "./AudioRecorder";
import { ChatHistory } from "./ChatHistory";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useParams,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import type { Scenario } from "./types";
import { TypedWebSocket } from "./types";

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

const Practice = () => {
  const { scenarioId = "" } = useParams<{ scenarioId: string }>();
  const [searchParams] = useSearchParams();
  const language = searchParams.get("lang") ?? "ja";
  const navigate = useNavigate();

  const [recorder, setRecorder] = useState<AudioRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistory>(new ChatHistory());
  const wsRef = useRef<TypedWebSocket | null>(null);

  useEffect(() => {
    const ws = new TypedWebSocket(
      `ws://localhost:8000/api/practice/${scenarioId}?lang=${language}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      setRecorder(new AudioRecorder(ws));
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
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
            const audio = document.getElementById(
              "audio-playback"
            ) as HTMLAudioElement;
            if (audio) {
              const blob = new Blob([message.audio], { type: "audio/wav" });
              audio.src = URL.createObjectURL(blob);
              audio.play();
            }
          }
          break;
      }
    };
  }, [scenarioId]);

  const startRecording = async () => {
    try {
      if (recorder) {
        await recorder.startRecording();
        setIsRecording(true);
        setChatHistory(prev => prev.addMessage("user", "🎤 Recording..."));
      }
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  };

  const stopRecording = () => {
    if (recorder) {
      recorder.stopRecording();
      setIsRecording(false);
      setChatHistory(prev => prev.addMessage("user", "🎤 Recording stopped"));
    }
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

          <div className="space-y-4">
            <div className="flex flex-col space-y-4">
              {/* Voice controls */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`px-4 py-2 text-white rounded-md ${
                    isRecording
                      ? "bg-gray-600 hover:bg-gray-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {isRecording ? "Stop Recording" : "Start Recording"}
                </button>
              </div>

              {/* Messages area */}
              <div className="p-4 bg-gray-50 rounded-lg shadow-inner min-h-[400px] max-h-[400px] overflow-y-auto">
                <div className="space-y-4">
                  {chatHistory.getMessages().map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${
                        msg.role === "assistant"
                          ? "justify-start"
                          : "justify-end"
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

              {/* Text input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.elements.namedItem(
                    "message"
                  ) as HTMLInputElement;
                  const text = input.value.trim();
                  if (text && wsRef.current) {
                    wsRef.current.send({
                      type: "text",
                      text,
                      role: "user"
                    });
                    setChatHistory(prev => prev.addMessage("user", text));
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

              <audio id="audio-playback" controls className="w-full" />
            </div>
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
