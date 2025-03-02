import {
  CloudArrowUpIcon,
  ExclamationCircleIcon,
  PlayIcon,
  StopIcon,
} from "@heroicons/react/24/outline";
import { useAtom } from "jotai";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DictionaryEntry,
  HintOption,
  MessageRole,
  WebSocketMessage,
} from "../../../types";
import { audioPlayerAtom } from "../store";
import { Base64AudioBuffer } from "./AudioPlayer";

// View-specific message types for the chat interface
export interface ViewMessage {
  role: MessageRole;
  type: string;
}

export interface TextViewMessage extends ViewMessage {
  type: "text";
  text: string;
}

export interface AudioViewMessage extends ViewMessage {
  id: string;
  type: "audio";
  placeholder: "🎤" | "🔊";
  audioBuffers: Base64AudioBuffer[];
  isComplete: boolean;
}

export interface TranscriptionViewMessage extends ViewMessage {
  type: "transcription";
  source_text: string;
  translated_text: string;
  chunked: string[];
  dictionary: Record<string, DictionaryEntry>;
}

export interface TranslationViewMessage extends ViewMessage {
  type: "translation";
  source_text: string;
  translated_text: string;
  chunked: string[];
  dictionary: Record<string, DictionaryEntry>;
}

export interface HintViewMessage extends ViewMessage {
  type: "hint";
  hints: HintOption[];
}

export interface ErrorViewMessage extends ViewMessage {
  type: "error";
  text: string;
}

export interface InitializeViewMessage extends ViewMessage {
  type: "initialize";
  text: string;
}

export type ChatViewMessage =
  | TextViewMessage
  | AudioViewMessage
  | TranscriptionViewMessage
  | TranslationViewMessage
  | HintViewMessage
  | ErrorViewMessage
  | InitializeViewMessage;

const TranscriptionChunk = ({
  term,
  dictionary,
}: {
  term: string;
  dictionary: Record<string, DictionaryEntry>;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Find the longest matching dictionary key that is contained in this term
  const translation = dictionary[term];

  if (!translation) {
    return <span className="badge badge-lg">{term}</span>;
  }

  return (
    <span
      className={`
        badge badge-lg
        cursor-pointer 
        relative
        transition-all duration-200
      `}
      onClick={() => setIsOpen(!isOpen)}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {term}
      {isOpen && (
        <div
          className="
          absolute left-1/2 transform -translate-x-1/2 z-10
          top-full mt-2
          px-3 py-2 rounded-lg shadow-lg
          bg-base-100 border border-base-300
          text-sm text-base-content
          min-w-[150px]
          whitespace-normal
        "
        >
          <div className="font-medium mb-1">{translation.translated_text}</div>
        </div>
      )}
    </span>
  );
};

const HintMessageComponent = ({
  msg,
  onHintSelect,
}: {
  msg: HintViewMessage;
  onHintSelect?: (text: string) => void;
}) => {
  return (
    <div className="flex justify-center my-4">
      <div className="bg-base-200 shadow-lg rounded-lg p-4 max-w-[80%] mx-auto">
        <h3 className="text-sm font-medium mb-2">Suggested Responses</h3>
        <div className="flex flex-wrap gap-2">
          {msg.hints.map((hint, idx) => {
            const [sourceLine, ...translationLines] =
              hint.source_text.split("\n");
            const translation =
              translationLines.join(" ") || hint.translated_text;

            return (
              <button
                key={idx}
                onClick={() => onHintSelect?.(sourceLine)}
                className="group relative px-3 py-1.5 rounded-lg bg-base-100 hover:bg-base-300 transition-colors"
              >
                <span className="text-sm font-medium">{sourceLine}</span>
                <div className="absolute left-0 right-0 -bottom-1 translate-y-full opacity-0 group-hover:opacity-100 transition-opacity bg-base-100 shadow-lg rounded-lg p-2 z-10">
                  <span className="text-xs text-base-content/70 whitespace-pre-line">
                    {translation}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const TranscriptionMessageComponent = ({
  msg,
}: {
  msg: TranscriptionViewMessage;
}) => {
  const [showTranslation, setShowTranslation] = useState(false);

  return (
    <div
      className={`chat ${msg.role === "assistant" ? "chat-start" : "chat-end"}`}
    >
      <div className="chat-bubble max-w-[80%] space-y-3">
        <div className="flex flex-wrap gap-2">
          {msg.chunked.map((term: string, idx: number) => (
            <TranscriptionChunk
              key={idx}
              term={term}
              dictionary={msg.dictionary}
            />
          ))}
        </div>
        {msg.translated_text && (
          <button
            onClick={() => setShowTranslation(!showTranslation)}
            className="btn btn-xs btn-ghost"
          >
            {showTranslation ? "Hide" : "Show"} Translation
          </button>
        )}
        {showTranslation && msg.translated_text && (
          <div className="text-sm opacity-70 italic">{msg.translated_text}</div>
        )}
      </div>
    </div>
  );
};

const AudioMessageComponent = ({ msg }: { msg: AudioViewMessage }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioPlayer] = useAtom(audioPlayerAtom);

  const handlePlayback = async () => {
    if (!audioPlayer || !msg.isComplete) return;

    if (isPlaying) {
      audioPlayer.stop();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      await audioPlayer.playAudioBlocking(msg.audioBuffers);
      setIsPlaying(false);
    }
  };

  return (
    <div
      className={`chat ${msg.role === "assistant" ? "chat-start" : "chat-end"}`}
    >
      <div className="chat-bubble">
        <div className="flex items-center gap-2">
          {!msg.isComplete ? (
            <span className="animate-[bounce_1s_ease-in-out]">
              {msg.placeholder}
            </span>
          ) : (
            <button
              onClick={handlePlayback}
              className="btn btn-circle btn-ghost btn-sm"
            >
              {isPlaying ? (
                <StopIcon className="h-5 w-5" />
              ) : (
                <PlayIcon className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const TranslateMessageComponent = ({
  msg,
}: {
  msg: TranslationViewMessage;
}) => (
  <div
    className={`chat ${msg.role === "assistant" ? "chat-start" : "chat-end"}`}
  >
    <div className="chat-bubble">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {msg.chunked?.map((term: string, idx: number) => (
            <TranscriptionChunk
              key={idx}
              term={term}
              dictionary={msg.dictionary || {}}
            />
          )) || <div>{msg.source_text}</div>}
        </div>
        <div className="text-sm italic opacity-70">{msg.translated_text}</div>
      </div>
    </div>
  </div>
);

const InitializeMessageComponent = ({
  msg,
}: {
  msg: InitializeViewMessage;
}) => (
  <div
    className={`chat ${msg.role === "assistant" ? "chat-start" : "chat-end"}`}
  >
    <div className="chat-bubble chat-bubble-info">
      <div className="flex items-center gap-2 mb-2">
        <CloudArrowUpIcon className="h-5 w-5" />
        <span>Initializing...</span>
      </div>
      <div className="text-sm">
        {msg.text.split("\n").map((line, i) => (
          <p key={i} className="whitespace-pre-wrap">
            {line}
          </p>
        ))}
      </div>
    </div>
  </div>
);

const TextMessageComponent = ({ msg }: { msg: TextViewMessage }) => (
  <div
    className={`chat ${msg.role === "assistant" ? "chat-start" : "chat-end"}`}
  >
    <div
      className={`chat-bubble ${
        msg.role === "assistant" ? "chat-bubble-info" : "chat-bubble-primary"
      }`}
    >
      {msg.text.split("\n").map((line, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {line}
        </p>
      ))}
    </div>
  </div>
);

const ErrorMessageComponent = ({ msg }: { msg: ErrorViewMessage }) => (
  <div
    className={`chat ${msg.role === "assistant" ? "chat-start" : "chat-end"}`}
  >
    <div className="chat-bubble chat-bubble-error">
      <div className="flex items-center gap-2">
        <ExclamationCircleIcon className="h-5 w-5" />
        <span>{msg.text}</span>
      </div>
    </div>
  </div>
);

function processMessages(messages: WebSocketMessage[]): ChatViewMessage[] {
  const viewMessages: ChatViewMessage[] = [];

  for (const message of messages) {
    // Skip user audio messages
    if (message.type === "audio" && message.role === "user") {
      continue;
    }
    switch (message.type) {
      case "audio":
        const audioMsg = {
          type: "audio",
          id: `audio-${viewMessages.length}`,
          role: message.role,
          placeholder: message.role === "user" ? "🎤" : "🔊",
          audioBuffers: [
            {
              data: message.audio,
              mime_type: message.mime_type,
            },
          ],
          isComplete: message.end_of_turn,
        } as AudioViewMessage;
        viewMessages.push(audioMsg);
        break;

      case "initialize":
        viewMessages.push({
          type: "initialize",
          role: message.role,
          text: message.text,
        });
        break;

      case "text":
        if (message.text.trim()) {
          viewMessages.push({
            type: "text",
            role: message.role,
            text: message.text,
          });
        }
        break;

      case "transcription":
        viewMessages.push({
          type: "transcription",
          role: message.role,
          source_text: message.source_text,
          translated_text: message.translated_text,
          chunked: message.chunked || [],
          dictionary: message.dictionary || {},
        });
        break;

      case "translation":
        viewMessages.push({
          type: "translation",
          role: message.role,
          source_text: message.source_text,
          translated_text: message.translated_text,
          chunked: message.chunked || [],
          dictionary: message.dictionary || {},
        });
        break;

      case "hint":
        viewMessages.push({
          type: "hint",
          role: message.role,
          hints: message.hints,
        });
        break;

      case "error":
        viewMessages.push({
          type: "error",
          role: message.role,
          text: message.text,
        });
        break;
    }
  }
  return viewMessages;
}

export const ChatMessages = ({
  messages: rawMessages,
  onHintSelect,
}: {
  messages: WebSocketMessage[];
  onHintSelect?: (text: string) => void;
}) => {
  const viewMessages = useMemo(
    () => processMessages(rawMessages),
    [rawMessages]
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [viewMessages]);

  return (
    <div className="flex-1 p-4 bg-base-200 overflow-y-auto">
      <div className="space-y-4">
        {viewMessages.map((msg, idx) => {
          switch (msg.type) {
            case "hint":
              return (
                <HintMessageComponent
                  key={idx}
                  msg={msg}
                  onHintSelect={onHintSelect}
                />
              );
            case "transcription":
              return <TranscriptionMessageComponent key={idx} msg={msg} />;
            case "audio":
              return <AudioMessageComponent key={msg.id} msg={msg} />;
            case "translation":
              return <TranslateMessageComponent key={idx} msg={msg} />;
            case "initialize":
              return <InitializeMessageComponent key={idx} msg={msg} />;
            case "text":
              return <TextMessageComponent key={idx} msg={msg} />;
            case "error":
              return <ErrorMessageComponent key={idx} msg={msg} />;
          }
        })}
      </div>
      <div ref={messagesEndRef} />
    </div>
  );
};
