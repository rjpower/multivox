// Audio sample rates and formats
export const CLIENT_SAMPLE_RATE = 16000;
export const SERVER_SAMPLE_RATE = 24000;
export const BYTES_PER_SAMPLE = 2; // 16-bit = 2 bytes

export interface TranslateRequest {
  text: string;
  language: string;
}

export interface VocabularyEntry {
  native: string;
  translation: string;
  notes?: string;
}


export interface DictionaryEntry {
  translation: string;
  notes?: string;
}

export interface TranscribeResponse {
  transcription: string;
  chunked: string[];
  dictionary: Record<string, DictionaryEntry>;
  translation: string;
}

export interface Scenario {
  id: string;
  title: string;
  instructions: string;
}

export type MessageRole = "user" | "assistant";
export type MessageType = "text" | "audio" | "transcription";
export type TextMode = "append" | "replace";

export type TextMessageContent = {
  type: "text";
  text: string;
};

export type TranscriptionMessageContent = {
  type: "transcription";
  transcription: TranscribeResponse;
};

export type AudioMessageContent = {
  type: "audio";
  placeholder: "🔊" | "🎤";  // Different icons for playback vs recording
};

export type MessageContent = 
  | TextMessageContent 
  | TranscriptionMessageContent 
  | AudioMessageContent;

interface BaseWebSocketMessage {
  role: MessageRole;
  end_of_turn?: boolean;
}

interface TextWebSocketMessage extends BaseWebSocketMessage {
  type: "text";
  text: string;
  mode?: TextMode;
}

interface TranscriptionWebSocketMessage extends BaseWebSocketMessage {
  type: "transcription";
  transcription: TranscribeResponse;
}

interface AudioWebSocketMessage extends BaseWebSocketMessage {
  type: "audio";
  audio: string; // Base64 encoded audio data
}

export type WebSocketMessage = 
  | TextWebSocketMessage 
  | TranscriptionWebSocketMessage 
  | AudioWebSocketMessage;

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
