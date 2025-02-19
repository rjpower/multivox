// Audio sample rates and formats
export const CLIENT_SAMPLE_RATE = 16000;
export const SERVER_SAMPLE_RATE = 24000;
export const BYTES_PER_SAMPLE = 2; // 16-bit = 2 bytes

export type MessageRole = "user" | "assistant" | "system";

export interface TranslateRequest {
  text: string;
  target_language: string;
  source_language?: string;
  api_key?: string;
}

export interface DictionaryEntry {
  source_text: string;
  translated_text: string;
  notes?: string;
}

export interface VocabularyEntry extends DictionaryEntry {
  context_source: string;
  context_translated: string;
}

export interface TranslateResponse {
  source_text: string;
  translated_text: string;
  chunked: string[];
  dictionary: Record<string, DictionaryEntry>;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  instructions: string;
}

export interface Language {
  code: string;
  name: string;
}

export interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

// Websocket messages
interface BaseWebSocketMessage {
  role: MessageRole;
  end_of_turn: boolean;
}

export interface HintOption {
  source_text: string;
  translated_text: string;
}

export interface InitializeWebSocketMessage extends BaseWebSocketMessage {
  role: "system";
  type: "initialize";
  text: string;
}

export interface ErrorWebSocketMessage extends BaseWebSocketMessage {
  type: "error";
  text: string;
}

export interface HintWebSocketMessage extends BaseWebSocketMessage {
  type: "hint";
  hints: HintOption[];
}

export interface TextWebSocketMessage extends BaseWebSocketMessage {
  type: "text";
  text: string;
}

export interface TranscriptionWebSocketMessage extends BaseWebSocketMessage {
  type: "transcription";
  source_text: string;
  translated_text: string;
  chunked: string[];
  dictionary: Record<string, DictionaryEntry>;
}

export interface AudioWebSocketMessage extends BaseWebSocketMessage {
  type: "audio";
  audio: string; // Base64 encoded audio data
  mime_type: string;
}

export interface TranslationWebSocketMessage extends BaseWebSocketMessage {
  type: "translation";
  source_text: string;
  translated_text: string;
  chunked: string[];
  dictionary: Record<string, DictionaryEntry>;
}

export type WebSocketMessage =
  | InitializeWebSocketMessage
  | ErrorWebSocketMessage
  | TextWebSocketMessage
  | TranscriptionWebSocketMessage
  | AudioWebSocketMessage
  | HintWebSocketMessage
  | TranslationWebSocketMessage;

export enum WebSocketState {
  DISCONNECTED = "DISCONNECTED",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
}
