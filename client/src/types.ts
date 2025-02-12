// Audio sample rates and formats
export const CLIENT_SAMPLE_RATE = 16000;
export const SERVER_SAMPLE_RATE = 24000;
export const BYTES_PER_SAMPLE = 2; // 16-bit = 2 bytes

export interface TranslateRequest {
  text: string;
  target_language: string;
  source_language?: string;
}

export interface VocabularyEntry {
  native: string;
  translation: string;
  notes?: string;
}


export interface DictionaryEntry {
  english: string;
  native: string;
  notes?: string;
}

export interface TranscribeResponse {
  transcription: string;
  chunked: string[];
  dictionary: Record<string, DictionaryEntry>;
  translation: string;
}

export interface TranslateResponse {
  translation: string;
  chunked: string[];
  dictionary: Record<string, DictionaryEntry>;
  original: string;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  instructions: string;
}

export type MessageRole = "user" | "assistant";
export type MessageType = "text" | "audio" | "transcription" | "hint";
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
  placeholder: "🔊" | "🎤"; // Different icons for playback vs recording
};

export type HintMessageContent = {
  type: "hint";
  hints: HintOption[];
};

export type TranslateMessageContent = {
  type: "translate";
  original: string;
  translation: string;
  dictionary: Record<string, DictionaryEntry>;
  chunked: string[];
};

export interface Language {
  code: string;
  name: string;
}

export interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export type MessageContent =
  | TextMessageContent
  | TranslateMessageContent
  | TranscriptionMessageContent
  | AudioMessageContent
  | HintMessageContent;

interface BaseWebSocketMessage {
  role: MessageRole;
  end_of_turn?: boolean;
}

export interface HintOption {
  native: string;
  translation: string;
}

export interface HintWebSocketMessage extends BaseWebSocketMessage {
  type: "hint";
  hints: HintOption[];
}

export interface TextWebSocketMessage extends BaseWebSocketMessage {
  type: "text";
  text: string;
  mode?: TextMode;
}

export interface TranscriptionWebSocketMessage extends BaseWebSocketMessage {
  type: "transcription";
  transcription: TranscribeResponse;
}

export interface AudioWebSocketMessage extends BaseWebSocketMessage {
  type: "audio";
  audio: string; // Base64 encoded audio data
}

export interface TranslateWebSocketMessage extends BaseWebSocketMessage {
  type: "translate";
  original: string;
  translation: string;
  chunked: string[];
  dictionary: Record<string, DictionaryEntry>;
}

export type WebSocketMessage =
  | TextWebSocketMessage
  | TranscriptionWebSocketMessage
  | AudioWebSocketMessage
  | HintWebSocketMessage
  | TranslateWebSocketMessage;


export enum WebSocketState {
  DISCONNECTED = "DISCONNECTED",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
}
