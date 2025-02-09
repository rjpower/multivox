import {
  TextMode,
  MessageRole,
  TranscribeResponse,
  MessageContent,
  TextMessageContent,
} from "./types";

export interface ChatMessage {
  role: MessageRole;
  content: MessageContent;
}

export class ChatHistory {
  private messages: ChatMessage[] = [];

  constructor(initialMessages: ChatMessage[] = []) {
    this.messages = initialMessages;
  }

  addMessage(role: MessageRole, content: MessageContent): ChatHistory {
    // For audio messages, replace the last audio message if it exists and has the same role
    if (content.type === "audio") {
      const lastMessageIndex = this.messages.length - 1;
      const lastMessage = this.messages[lastMessageIndex];

      if (
        lastMessage &&
        lastMessage.role === role &&
        lastMessage.content.type === "audio"
      ) {
        // Replace the last audio message
        return new ChatHistory([
          ...this.messages.slice(0, lastMessageIndex),
          { role, content },
        ]);
      }
    }

    // For non-audio messages or if no matching audio message found, append
    return new ChatHistory([...this.messages, { role, content }]);
  }

  addTextMessage(role: MessageRole, text: string): ChatHistory {
    return this.addMessage(role, { type: "text", text });
  }

  addTranscriptionMessage(
    role: MessageRole,
    transcription: TranscribeResponse
  ): ChatHistory {
    return this.addMessage(role, { type: "transcription", transcription });
  }

  addAudioMessage(
    role: MessageRole,
    isRecording: boolean = false
  ): ChatHistory {
    return this.addMessage(role, {
      type: "audio",
      placeholder: isRecording ? "🎤" : "🔊",
    });
  }

  updateLastAssistantMessage(
    text: string,
    mode: TextMode = "append"
  ): ChatHistory {
    const lastMessage = this.messages[this.messages.length - 1];

    // If no messages or last message isn't from assistant, add as new
    if (!lastMessage || lastMessage.role !== "assistant") {
      return this.addTextMessage("assistant", text);
    }

    // Only update if it's a text message
    if (lastMessage.content.type !== "text") {
      return this.addTextMessage("assistant", text);
    }

    // Update the last message based on mode
    const newContent =
      mode === "append" ? lastMessage.content.text + text : text;

    const newMessages = [
      ...this.messages.slice(0, -1),
      {
        role: lastMessage.role,
        content: { type: "text", text: newContent } as TextMessageContent,
      },
    ];

    return new ChatHistory(newMessages);
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }
}
