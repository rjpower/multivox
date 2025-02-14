import { ExclamationCircleIcon, CloudArrowUpIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useRef, useState } from "react";
import {
  AudioChatMessage,
  ChatMessage,
  DictionaryEntry,
  ErrorChatMessage,
  HintChatMessage,
  InitializeChatMessage,
  MessageRole,
  TextChatMessage,
  TranscriptionChatMessage,
  TranslateChatMessage,
} from "./types";

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

const HintMessageComponent = ({
  msg,
  messageInputRef,
}: {
  msg: HintChatMessage;
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
    </MessageContainer>
  );
};

const TranscriptionMessageComponent = ({ msg }: { msg: TranscriptionChatMessage }) => {
  const [showTranslation, setShowTranslation] = useState(false);

  return (
    <MessageContainer role={msg.role}>
      <div className={`max-w-[80%] px-4 py-2 ${
        msg.role === "assistant" ? "text-gray-600" : "text-indigo-300"
      } space-y-3`}>
        <div className="text-sm leading-relaxed">
          {msg.chunked.map((term: string, idx: number) => (
            <TranscriptionChunk
              key={idx}
              term={term}
              dictionary={msg.dictionary}
            />
          ))}
        </div>
        {msg.translation && (
        <button
          onClick={() => setShowTranslation(!showTranslation)}
          className="text-xs text-indigo-600 hover:text-indigo-800"
        >
          {showTranslation ? "Hide" : "Show"} Translation
        </button>
      )}
      {showTranslation && msg.translation && (
        <div className="text-sm text-gray-600 italic">{msg.translation}</div>
      )}
      </div>
    </MessageContainer>
  );
};

const AudioMessageComponent = ({ msg }: { msg: AudioChatMessage }) => (
  <MessageContainer role={msg.role}>
    <div className={`max-w-[80%] px-4 py-2 rounded-lg ${
      msg.role === "assistant"
        ? "bg-white text-gray-800 shadow"
        : "bg-indigo-600 text-white"
    }`}>
      <span className="inline-flex items-center">
        <span className="animate-[bounce_1s_ease-in-out]">
          {msg.placeholder}
        </span>
        <span className="ml-1">...</span>
      </span>
    </div>
  </MessageContainer>
);

const TranslateMessageComponent = ({ msg }: { msg: TranslateChatMessage }) => (
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
          )) || (
            <div className="text-gray-800">{msg.original}</div>
          )}
        </div>
        <div className="text-sm text-gray-600 italic">
          {msg.translation}
        </div>
      </div>
    </div>
  </MessageContainer>
);

const InitializeMessageComponent = ({ msg }: { msg: InitializeChatMessage }) => (
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

const TextMessageComponent = ({ msg }: { msg: TextChatMessage }) => (
  <MessageContainer role={msg.role}>
    <div className={`max-w-[80%] px-4 py-2 rounded-lg ${
      msg.role === "assistant"
        ? "bg-white text-gray-800 shadow"
        : "bg-indigo-600 text-white"
    }`}>
      {msg.text.split("\n").map((line, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {line}
        </p>
      ))}
    </div>
  </MessageContainer>
);

const ErrorMessageComponent = ({ msg }: { msg: ErrorChatMessage }) => (
  <MessageContainer role={msg.role}>
    <div className="max-w-[80%] px-4 py-2 bg-red-50 text-red-700 rounded-lg border border-red-200">
      <div className="flex items-center gap-2">
        <ExclamationCircleIcon className="h-5 w-5" />
        <span>{msg.text}</span>
      </div>
    </div>
  </MessageContainer>
);

export const ChatMessages = ({
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
        {messages.map((msg, idx) => {
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
              return <AudioMessageComponent key={idx} msg={msg} />;
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
