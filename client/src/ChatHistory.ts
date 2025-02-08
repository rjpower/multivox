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

  getMessages(): ChatMessage[] {
    return this.messages;
  }
}
