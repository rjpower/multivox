import { ChatMessage, WebSocketMessage } from "./types";

export class ChatHistory {
  private messages: ChatMessage[] = [];

  constructor(initialMessages: ChatMessage[] = []) {
    this.messages = initialMessages;
  }

  private appendMessage(message: ChatMessage): ChatHistory {
    return new ChatHistory([...this.messages, message]);
  }

  private replaceLastMessage(message: ChatMessage): ChatHistory {
    return new ChatHistory([...this.messages.slice(0, -1), message]);
  }

  private shouldReplaceLastMessage(message: ChatMessage): boolean {
    const lastMessage = this.messages[this.messages.length - 1];
    return (
      message.type === "audio" &&
      lastMessage?.type === "audio" &&
      lastMessage?.role === message.role
    );
  }

  private appendOrReplaceMessage(message: ChatMessage): ChatHistory {
    return this.shouldReplaceLastMessage(message)
      ? this.replaceLastMessage(message)
      : this.appendMessage(message);
  }

  handleMessage(message: WebSocketMessage): ChatHistory {
    switch (message.type) {
      case "initialize":
        return this.appendMessage({
          type: "initialize",
          role: "assistant",
          text: message.text,
        });

      case "text":
        return message.role === "assistant"
          ? this.appendAssistantText(message.text)
          : this.appendMessage({
              type: "text",
              role: message.role,
              text: message.text,
            });

      case "translation":
        return this.appendMessage({
          type: "translation",
          role: message.role,
          original: message.original,
          translation: message.translation,
          chunked: message.chunked || [],
          dictionary: message.dictionary || {},
        });

      case "transcription":
        return this.appendMessage({
          role: message.role,
          type: "transcription",
          ...message.transcription,
        });

      case "audio":
        return this.appendOrReplaceMessage({
          role: message.role,
          type: "audio",
          placeholder: message.role === "user" ? "🎤" : "🔊",
          timestamp: Date.now(),
        });

      case "hint":
        return this.appendMessage({
          type: "hint",
          role: message.role,
          hints: message.hints,
        });

      case "error":
        return this.appendMessage({
          type: "error",
          role: message.role,
          text: message.text,
        });

      default:
        return this;
    }
  }

  private appendAssistantText(text: string): ChatHistory {
    if (text === "") {
      return this;
    }

    const lastMessage = this.messages[this.messages.length - 1];

    if (lastMessage?.role === "assistant" && lastMessage?.type === "text") {
      return this.replaceLastMessage({
        role: "assistant",
        type: "text",
        text: lastMessage.text + text,
      });
    }

    return this.appendMessage({
      type: "text",
      role: "assistant",
      text,
    });
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }
}
