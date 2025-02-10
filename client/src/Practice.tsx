import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { AudioRecorder } from "./AudioRecorder";
import { ChatHistory, ChatMessage } from "./ChatHistory";
import { VocabularyList } from "./VocabularyList";
import type {
  DictionaryEntry,
  HintOption,
  Scenario,
  TranscribeResponse,
  TranslateResponse,
} from "./types";
import { TypedWebSocket } from "./TypedWebSocket";
import { AudioPlayer } from "./AudioPlayer";

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

  const translation = dictionary[match].english;

  return (
    <span
      className={`
        cursor-pointer 
        inline-block px-2 py-0.5 mx-0.5 my-0.5
        rounded-full 
        ${
          isOpen
            ? "bg-gray-200 shadow-inner"
            : "bg-gray-50 hover:bg-gray-100 hover:shadow-sm"
        }
        border border-gray-200
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
        </div>
      )}
    </span>
  );
};

const HintMessage = ({
  hints,
  onSelect,
}: {
  hints: HintOption[];
  onSelect: (text: string) => void;
}) => {
  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-500 mb-2">Suggested responses:</div>
      <div className="flex flex-wrap gap-2">
        {hints.map((hint, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(hint.native)}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 
                     border border-blue-200 rounded-full
                     text-sm text-gray-700 transition-colors
                     flex flex-col items-center gap-1
                     group cursor-pointer"
          >
            <span className="font-medium">{hint.native}</span>
            <span className="text-xs text-gray-500 group-hover:text-gray-700">
              {hint.translation}
            </span>
          </button>
        ))}
      </div>
    </div>
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

const ChatMessages = ({
  messages,
  onSendMessage,
}: {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
                case "hint":
                  return (
                    <div className="max-w-[80%] px-4 py-2 bg-white rounded-lg shadow">
                      <HintMessage
                        hints={msg.content.hints}
                        onSelect={onSendMessage}
                      />
                    </div>
                  );
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
                      {msg.content.text.split("\n").map((line, i) => (
                        <p key={i} className="whitespace-pre-wrap">
                          {line}
                        </p>
                      ))}
                    </div>
                  );
              }
            })()}
          </div>
        ))}
      </div>
      <div ref={messagesEndRef} />
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

      <ChatMessages
        messages={chatHistory.getMessages()}
        onSendMessage={onSendMessage}
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

const ScenarioInstructions = ({
  scenario,
  onStart,
}: {
  scenario: Scenario | null;
  onStart: (translatedText: string) => void;
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const language = searchParams.get("lang")!;

  if (!scenario) return null;

  const handleStart = async () => {
    setIsLoading(true);
    try {
      const request = {
        text: scenario.instructions,
        language: language,
      };
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const data: TranslateResponse = await response.json();
      onStart(data.translation!);
    } catch (error) {
      console.error("Translation failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <p className="text-gray-600 mb-6 whitespace-pre-wrap">
        {scenario.description}
      </p>
      <button
        onClick={handleStart}
        disabled={isLoading}
        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
      >
        {isLoading ? "Translating..." : "Start Practice"}
      </button>
    </>
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
    isConnecting: false,
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
    if (wsState.ws || wsState.isConnecting) return;

    setWsState((prev) => ({ ...prev, isConnecting: true }));
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new TypedWebSocket(
      `${protocol}//${window.location.host}/api/practice?lang=${language}`
    );

    ws.onopen = () => {
      console.log("WebSocket connected");
      setRecorder(new AudioRecorder(ws));
      setWsState({
        ws,
        isConnected: true,
        isConnecting: false,
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
        isConnecting: false,
      });
    };

    ws.onmessage = (message) => {
      switch (message.type) {
        case "hint":
          if (message.hints) {
            setChatHistory((prev) =>
              prev.addHintMessage(message.role, message.hints)
            );
          }
          break;
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
  }, [language]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!wsState.ws || wsState.ws.readyState !== WebSocket.OPEN) {
        console.error("WebSocket not connected");
        return;
      }

      setChatHistory((prev) => prev.addTextMessage("user", text));
      wsState.ws.send({
        type: "text",
        text,
        role: "user",
      });
    },
    [wsState.ws]
  );

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

export const Practice = () => {
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

  useEffect(() => {
    fetch("/api/scenarios")
      .then((res) => res.json())
      .then((scenarios) => {
        const found = scenarios.find((s: Scenario) => s.id === scenarioId);
        setScenario(found || null);
      });
  }, [scenarioId]);

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
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => navigate("/")}
          className="mb-4 text-indigo-600 hover:text-indigo-800"
        >
          ← Back to scenarios
        </button>

        <div className="flex gap-4">
          <div className="flex-1">
            <div
              className={`bg-white rounded-lg shadow-md p-4 ${
                isConnecting || !isConnected
                  ? "opacity-50 pointer-events-none"
                  : ""
              }`}
            >
              <h2 className="text-2xl font-bold mb-4">
                Practice: {scenario?.title || "Loading..."}
              </h2>
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
          <div className="w-80 shrink-0">
            <VocabularyList messages={chatHistory.getMessages()} />
          </div>
        </div>
      </div>
    </div>
  );
};
