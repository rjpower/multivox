export interface Scenario {
  id: string;
  title: string;
  instructions: string;
}

export type MessageRole = "user" | "assistant";
export type MessageType = "text" | "audio";
export type TextMode = "append" | "replace";

export interface WebSocketMessage {
  type: MessageType;
  text?: string;
  audio?: string; // Base64 encoded audio data
  role: MessageRole;
  mode?: TextMode;
  end_of_turn?: boolean;
}

export class TypedWebSocket {
  private ws: WebSocket;

  constructor(url: string) {
    this.ws = new WebSocket(url);
  }

  public send(message: WebSocketMessage) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  public get readyState() {
    return this.ws.readyState;
  }

  public set onopen(handler: (event: Event) => void) {
    this.ws.onopen = handler;
  }

  public set onclose(handler: (event: CloseEvent) => void) {
    this.ws.onclose = handler;
  }

  public set onerror(handler: (event: Event) => void) {
    this.ws.onerror = handler;
  }

  public set onmessage(handler: (message: WebSocketMessage) => void) {
    this.ws.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data);
      if (!message.type || !message.role) {
        console.error("Invalid message format:", message);
        return;
      }
      handler(message);
    };
  }
}
