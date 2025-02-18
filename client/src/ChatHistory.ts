import { WebSocketMessage } from "./types";

export class ChatHistory {
  private messages: WebSocketMessage[] = [];

  constructor(initialMessages: WebSocketMessage[] = []) {
    this.messages = initialMessages;
  }

  handleMessage(message: WebSocketMessage): ChatHistory {
    return new ChatHistory([...this.messages, message]);
  }

  getMessages(): WebSocketMessage[] {
    return this.messages;
  }
}
