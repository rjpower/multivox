import {
  MessageRole,
  TranscribeResponse,
  ChatMessage,
  TextChatMessage,
  HintOption,
  DictionaryEntry,
} from "./types";

export class ChatHistory {
  private messages: ChatMessage[] = [];

  constructor(initialMessages: ChatMessage[] = []) {
    this.messages = initialMessages;
  }

  addMessage(message: ChatMessage): ChatHistory {
    // For audio messages, replace the last audio message if it exists and has the same role
    if (message.type === "audio") {
      const lastMessageIndex = this.messages.length - 1;
      const lastMessage = this.messages[lastMessageIndex];

      if (
        lastMessage &&
        lastMessage.role === message.role &&
        lastMessage.type === "audio"
      ) {
        // Replace the last audio message
        return new ChatHistory([
          ...this.messages.slice(0, lastMessageIndex),
          { ...message },
        ]);
      }
    }

    // For non-audio messages or if no matching audio message found, append
    return new ChatHistory([...this.messages, message]);
  }

  addInitializeMessage(text: string): ChatHistory {
    return this.addMessage({
      type: "initialize",
      role: "assistant",
      text,
    });
  }

  addTextMessage(role: MessageRole, text: string): ChatHistory {
    if (role == "assistant") {
      return this.updateLastAssistantMessage(text);
    } else {
      return this.addMessage({ type: "text", role, text });
    }
  }

  addTranslateMessage(
    role: MessageRole,
    original: string,
    translation: string,
    chunked: string[] = [],
    dictionary: Record<string, DictionaryEntry> = {}
  ): ChatHistory {
    return this.addMessage({
      type: "translate",
      role,
      original,
      translation,
      chunked,
      dictionary,
    });
  }

  addTranscriptionMessage(
    role: MessageRole,
    transcription: TranscribeResponse
  ): ChatHistory {
    return this.addMessage({ role, type: "transcription", ...transcription });
  }

  addHintMessage(role: MessageRole, hints: HintOption[]): ChatHistory {
    return this.addMessage({ role, type: "hint", hints });
  }

  addAudioMessage(role: MessageRole): ChatHistory {
    return this.addMessage({
      role,
      type: "audio",
      placeholder: role === "user" ? "🎤" : "🔊",
      timestamp: Date.now(),
    });
  }

  // Gemini flash streams the assistant messages, so we need to append
  // the text to the last assistant message if it exists and it is the
  // last message in the chat history.
  updateLastAssistantMessage(text: string): ChatHistory {
    const lastMessage = this.messages[this.messages.length - 1];

    // If no messages or last message isn't from assistant, add as new
    if (
      !lastMessage ||
      lastMessage.role !== "assistant" ||
      lastMessage.type !== "text"
    ) {
      return this.addMessage({ type: "text", role: "assistant", text });
    }

    // Update the last message
    const newContent = lastMessage.text + text;

    const newMessages = [
      ...this.messages.slice(0, -1),
      {
        role: lastMessage.role,
        type: "text",
        text: newContent,
      } as TextChatMessage,
    ];

    return new ChatHistory(newMessages);
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }
}
