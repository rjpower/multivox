import {
  ExclamationCircleIcon,
  CloudArrowUpIcon,
  StopIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageRole,
  DictionaryEntry,
  WebSocketMessage,
  HintOption,
} from "./types";
import { usePracticeStore } from "./stores/practice";
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

interface MessageContainerProps {
  role: MessageRole;
  children: React.ReactNode;
}

const MessageContainer = ({ role, children }: MessageContainerProps) => (
  <div
    className={`flex ${role === "assistant" ? "justify-start" : "justify-end"}`}
  >
    {children}
  </div>
);

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

  const translation = dictionary[match].translated_text;

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

const HintMessageComponent = ({
  msg,
  messageInputRef,
}: {
  msg: HintViewMessage;
  messageInputRef: React.RefObject<HTMLInputElement | null>;
}) => {
  return (
    <MessageContainer role={msg.role}>
      <div className="max-w-[80%] px-4 py-2 bg-white rounded-lg shadow space-y-2">
        <div className="text-sm text-gray-500 mb-2">Suggested responses:</div>
        <div className="flex flex-wrap gap-2">
          {msg.hints.map((hint, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (messageInputRef.current) {
                  messageInputRef.current.value = hint.source_text;
                  messageInputRef.current.focus();
                }
              }}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 
                     border border-blue-200 rounded-full
                     text-sm text-gray-700 transition-colors
                     flex flex-col items-center gap-1
                     group cursor-pointer"
            >
              <span className="font-medium">{hint.source_text}</span>
              <span className="text-xs text-gray-500 group-hover:text-gray-700">
                {hint.translated_text}
              </span>
            </button>
          ))}
        </div>
      </div>
    </MessageContainer>
  );
};

const TranscriptionMessageComponent = ({
  msg,
}: {
  msg: TranscriptionViewMessage;
}) => {
  const [showTranslation, setShowTranslation] = useState(false);

  return (
    <MessageContainer role={msg.role}>
      <div
        className={`max-w-[80%] px-4 py-2 ${
          msg.role === "assistant" ? "text-gray-600" : "text-indigo-300"
        } space-y-3`}
      >
        <div className="text-sm leading-relaxed">
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
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            {showTranslation ? "Hide" : "Show"} Translation
          </button>
        )}
        {showTranslation && msg.translated_text && (
          <div className="text-sm text-gray-600 italic">
            {msg.translated_text}
          </div>
        )}
      </div>
    </MessageContainer>
  );
};

const AudioMessageComponent = ({ msg }: { msg: AudioViewMessage }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioPlayer = usePracticeStore((state) => state.audioPlayer);

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
    <MessageContainer role={msg.role}>
      <div
        className={`max-w-[80%] px-4 py-2 rounded-lg ${
          msg.role === "assistant"
            ? "bg-white text-gray-800 shadow"
            : "bg-indigo-600 text-white"
        }`}
      >
        <div className="flex items-center gap-2">
          {!msg.isComplete ? (
            <span className="animate-[bounce_1s_ease-in-out]">
              {msg.placeholder}
            </span>
          ) : (
            <button
              onClick={handlePlayback}
              className={`p-2 rounded-full hover:bg-gray-100 ${
                msg.role === "assistant" ? "text-gray-700" : "text-white"
              }`}
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
    </MessageContainer>
  );
};

const TranslateMessageComponent = ({
  msg,
}: {
  msg: TranslationViewMessage;
}) => (
  <MessageContainer role={msg.role}>
    <div className="max-w-[80%] px-4 py-2 bg-white rounded-lg shadow">
      <div className="space-y-3">
        <div className="text-sm leading-relaxed">
          {msg.chunked?.map((term: string, idx: number) => (
            <TranscriptionChunk
              key={idx}
              term={term}
              dictionary={msg.dictionary || {}}
            />
          )) || <div className="text-gray-800">{msg.source_text}</div>}
        </div>
        <div className="text-sm text-gray-600 italic">
          {msg.translated_text}
        </div>
      </div>
    </div>
  </MessageContainer>
);

const InitializeMessageComponent = ({
  msg,
}: {
  msg: InitializeViewMessage;
}) => (
  <MessageContainer role={msg.role}>
    <div className="max-w-[80%] px-4 py-2 bg-blue-50 text-gray-600 rounded-lg border border-blue-200">
      <div className="flex items-center gap-2 mb-2 text-blue-600">
        <CloudArrowUpIcon className="h-5 w-5" />
      </div>
      <div className="text-sm">
        {msg.text.split("\n").map((line, i) => (
          <p key={i} className="whitespace-pre-wrap">
            {line}
          </p>
        ))}
      </div>
    </div>
  </MessageContainer>
);

const TextMessageComponent = ({ msg }: { msg: TextViewMessage }) => (
  <MessageContainer role={msg.role}>
    <div
      className={`max-w-[80%] px-4 py-2 rounded-lg ${
        msg.role === "assistant"
          ? "bg-white text-gray-800 shadow"
          : "bg-indigo-600 text-white"
      }`}
    >
      {msg.text.split("\n").map((line, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {line}
        </p>
      ))}
    </div>
  </MessageContainer>
);

const ErrorMessageComponent = ({ msg }: { msg: ErrorViewMessage }) => (
  <MessageContainer role={msg.role}>
    <div className="max-w-[80%] px-4 py-2 bg-red-50 text-red-700 rounded-lg border border-red-200">
      <div className="flex items-center gap-2">
        <ExclamationCircleIcon className="h-5 w-5" />
        <span>{msg.text}</span>
      </div>
    </div>
  </MessageContainer>
);

function processMessages(messages: WebSocketMessage[]): ChatViewMessage[] {
  const viewMessages: ChatViewMessage[] = [];

  for (const message of messages) {
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
          role: "assistant",
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
  messageInputRef,
}: {
  messages: WebSocketMessage[];
  messageInputRef: React.RefObject<HTMLInputElement | null>;
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
    <div className="p-4 bg-gray-50 rounded-lg shadow-inner min-h-[400px] max-h-[400px] overflow-y-auto">
      <div className="space-y-4">
        {viewMessages.map((msg, idx) => {
          switch (msg.type) {
            case "hint":
              return (
                <HintMessageComponent
                  key={idx}
                  msg={msg}
                  messageInputRef={messageInputRef}
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
