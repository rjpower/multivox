import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { ChatHistory, ChatMessage } from "./ChatHistory";
import { VocabularyList } from "./VocabularyList";
import {
  TranslateMessageContent,
  type DictionaryEntry,
  type HintOption,
  type Scenario,
  type TranscribeResponse,
} from "./types";
import { usePracticeStore } from "./PracticeStore";

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
  messageInputRef,
}: {
  hints: HintOption[];
  messageInputRef: React.RefObject<HTMLInputElement | null>;
}) => {
  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-500 mb-2">Suggested responses:</div>
      <div className="flex flex-wrap gap-2">
        {hints.map((hint, idx) => (
          <button
            key={idx}
            onClick={() => {
              if (messageInputRef.current) {
                messageInputRef.current.value = hint.native;
                messageInputRef.current.focus();
              }
            }}
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
  messageInputRef,
}: {
  messages: ChatMessage[];
  messageInputRef: React.RefObject<HTMLInputElement | null>;
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
                        messageInputRef={messageInputRef}
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
                case "translate":
                  return (
                    <div className="max-w-[80%] px-4 py-2 bg-white rounded-lg shadow">
                      <div className="space-y-3">
                        <div className="text-sm leading-relaxed">
                          {msg.content.chunked?.map(
                            (term: string, idx: number) => (
                              <TranscriptionChunk
                                key={idx}
                                term={term}
                                dictionary={
                                  (msg.content as TranslateMessageContent)
                                    .dictionary || {}
                                }
                              />
                            )
                          ) || (
                            <div className="text-gray-800">
                              {msg.content.original}
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 italic">
                          {msg.content.translation}
                        </div>
                      </div>
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
  const messageInputRef = useRef<HTMLInputElement>(null);
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
        className="flex space-x-2"
      >
        <input
          ref={messageInputRef}
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

const ScenarioInstructions = ({ scenario }: { scenario: Scenario | null }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const modality = usePracticeStore((state) => state.modality);
  const setModality = usePracticeStore((state) => state.setModality);
  const translateInstructions = usePracticeStore((state) => state.translateInstructions);
  const customInstructions = usePracticeStore((state) => state.customInstructions);
  const setCustomInstructions = usePracticeStore((state) => state.setCustomInstructions);
  
  const language = searchParams.get("lang")!;

  if (!scenario) return null;

  const handleStart = async () => {
    setIsLoading(true);
    try {
      await translateInstructions(customInstructions ?? scenario.instructions, language);
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
  const [searchParams] = useSearchParams();
  const language = searchParams.get("lang") ?? "ja";
  const [scenario, setScenario] = useState<Scenario | null>(null);

  const isRecording = usePracticeStore((state) => state.isRecording);
  const chatHistory = usePracticeStore((state) => state.chatHistory);
  const connect = usePracticeStore((state) => state.connect);
  const startRecording = usePracticeStore((state) => state.startRecording);
  const stopRecording = usePracticeStore((state) => state.stopRecording);
  const sendMessage = usePracticeStore((state) => state.sendMessage);

  const reset = usePracticeStore((state) => state.reset);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  useEffect(() => {
    if (scenarioId === "custom") {
      setScenario({
        id: "custom",
        title: "Custom Scenario",
        description: "Create your own custom practice scenario.",
        instructions: "Enter your custom instructions here...",
      });
    } else {
      fetch("/api/scenarios")
        .then((res) => res.json())
        .then((scenarios) => {
          const found = scenarios.find((s: Scenario) => s.id === scenarioId);
          setScenario(found || null);
        });
    }
  }, [scenarioId]);

  const translatedInstructions = usePracticeStore(
    (state) => state.translatedInstructions
  );

  useEffect(() => {
    if (translatedInstructions && !chatHistory.getMessages().length) {
      connect(language).then(() => {
        sendMessage(translatedInstructions);
      });
    }
  }, [translatedInstructions, chatHistory, connect, sendMessage]);

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
            <div className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-2xl font-bold mb-4">
                Practice: {scenario?.title || "Loading..."}
              </h2>
              {chatHistory.getMessages().length === 0 ? (
                <ScenarioInstructions scenario={scenario} />
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
          <div className="w-80 shrink-0">
            <VocabularyList messages={chatHistory.getMessages()} />
          </div>
        </div>
      </div>
    </div>
  );
};
