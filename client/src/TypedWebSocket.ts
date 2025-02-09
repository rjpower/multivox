import type { WebSocketMessage } from "./types";

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

  public close() {
    this.ws.close();
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
