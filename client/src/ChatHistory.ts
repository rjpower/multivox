import { MessageRole, TextMode } from './types';

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export class ChatHistory {
  private messages: ChatMessage[] = [];

  constructor(initialMessages: ChatMessage[] = []) {
    this.messages = initialMessages;
  }

  addMessage(role: MessageRole, content: string): ChatHistory {
    return new ChatHistory([...this.messages, { role, content }]);
  }

  updateLastAssistantMessage(content: string, mode: TextMode = 'append'): ChatHistory {
    const lastMessage = this.messages[this.messages.length - 1];
    
    // If no messages or last message isn't from assistant, add as new
    if (!lastMessage || lastMessage.role !== 'assistant') {
      return this.addMessage('assistant', content);
    }

    // Update the last message based on mode
    const newContent = mode === 'append' 
      ? lastMessage.content + content
      : content;

    const newMessages = [...this.messages.slice(0, -1), 
      { ...lastMessage, content: newContent }
    ];
    
    return new ChatHistory(newMessages);
  }

  addAudioAnnotation(role: MessageRole): ChatHistory {
    const lastMessage = this.messages[this.messages.length - 1];
    
    // If no messages or last message isn't from the same role, add as new
    if (!lastMessage || lastMessage.role !== role) {
      return this.addMessage(role, "🔊 Audio message");
    }

    // Append audio notation to existing message if it doesn't already end with one
    if (!lastMessage.content.endsWith("🔊")) {
      const newContent = lastMessage.content + " 🔊";
      const newMessages = [...this.messages.slice(0, -1),
        { ...lastMessage, content: newContent }
      ];
      return new ChatHistory(newMessages);
    }

    return this;
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }
}
