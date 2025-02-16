import { WebSocketMessage, MessageRole, DictionaryEntry, HintOption } from "./types";

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
  type: "audio";
  placeholder: "🎤" | "🔊";
}

export interface TranscriptionViewMessage extends ViewMessage {
  type: "transcription";
  transcription: string;
  chunked: string[];
  dictionary: Record<string, DictionaryEntry>;
  translation: string;
}

export interface TranslationViewMessage extends ViewMessage {
  type: "translation";
  original: string;
  translation: string;
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

export class ChatHistory {
  private messages: WebSocketMessage[] = [];

  constructor(initialMessages: WebSocketMessage[] = []) {
    this.messages = initialMessages;
  }

  handleMessage(message: WebSocketMessage): ChatHistory {
    return new ChatHistory([...this.messages, message]);
  }

  // Get raw messages for debugging/storage
  getRawMessages(): WebSocketMessage[] {
    return this.messages;
  }

  // Get coalesced messages for rendering
  getViewMessages(): ChatViewMessage[] {
    const viewMessages: ChatViewMessage[] = [];
    
    for (const message of this.messages) {
      const lastMessage = viewMessages[viewMessages.length - 1];

      // Handle coalescing cases first
      if (message.type === "text" && message.role === "assistant" && 
          lastMessage?.type === "text" && lastMessage.role === "assistant") {
        // Coalesce assistant text messages
        viewMessages[viewMessages.length - 1] = {
          ...lastMessage,
          text: lastMessage.text + message.text,
        };
        continue;
      }

      if (message.type === "audio" && lastMessage?.type === "audio" && 
          lastMessage.role === message.role) {
        // Replace previous audio message of same role
        viewMessages[viewMessages.length - 1] = {
          type: "audio",
          role: message.role,
          placeholder: message.role === "user" ? "🎤" : "🔊"
        };
        continue;
      }

      // Convert message to view message
      switch (message.type) {
        case "initialize":
          viewMessages.push({
            type: "initialize",
            role: "assistant",
            text: message.text
          });
          break;

        case "text":
          if (message.text.trim()) {
            viewMessages.push({
              type: "text",
              role: message.role,
              text: message.text
            });
          }
          break;

        case "audio":
          viewMessages.push({
            type: "audio",
            role: message.role,
            placeholder: message.role === "user" ? "🎤" : "🔊"
          });
          break;

        case "transcription":
          viewMessages.push({
            type: "transcription",
            role: message.role,
            ...message.transcription
          });
          break;

        case "translation":
          viewMessages.push({
            type: "translation",
            role: message.role,
            original: message.original,
            translation: message.translation,
            chunked: message.chunked || [],
            dictionary: message.dictionary || {}
          });
          break;

        case "hint":
          viewMessages.push({
            type: "hint",
            role: message.role,
            hints: message.hints
          });
          break;

        case "error":
          viewMessages.push({
            type: "error",
            role: message.role,
            text: message.text
          });
          break;
      }
    }

    return viewMessages;
  }
}
