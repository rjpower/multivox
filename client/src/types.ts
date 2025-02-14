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

// Chat message type for the chat window
export type MessageRole = "user" | "assistant";
export type MessageType =
  | "initialize"
  | "text"
  | "audio"
  | "transcription"
  | "translation"
  | "error"
  | "hint";

export interface ChatMessageBase {
  type: MessageType;
  role: MessageRole;
}

export interface InitializeChatMessage extends ChatMessageBase {
  type: "initialize";
  text: string;
}

export interface TextChatMessage extends ChatMessageBase {
  type: "text";
  text: string;
}

export interface TranscriptionChatMessage extends ChatMessageBase {
  type: "transcription";
  transcription: string;
  chunked: string[];
  dictionary: Record<string, DictionaryEntry>;
  translation: string;
}

export interface AudioChatMessage extends ChatMessageBase {
  type: "audio";
  timestamp: number;
  placeholder: "🔊" | "🎤"; // Different icons for playback vs recording
}

export interface HintChatMessage extends ChatMessageBase {
  type: "hint";
  hints: HintOption[];
}

export interface ErrorChatMessage extends ChatMessageBase {
  type: "error";
  text: string;
}

export interface TranslateChatMessage extends ChatMessageBase {
  type: "translation";
  original: string;
  translation: string;
  dictionary: Record<string, DictionaryEntry>;
  chunked: string[];
}

export type ChatMessage =
  | ErrorChatMessage
  | InitializeChatMessage
  | TextChatMessage
  | TranslateChatMessage
  | TranscriptionChatMessage
  | AudioChatMessage
  | HintChatMessage;

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
  end_of_turn?: boolean;
}

export interface HintOption {
  native: string;
  translation: string;
}

export interface InitializeWebSocketMessage extends BaseWebSocketMessage {
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
  transcription: TranscribeResponse;
}

export interface AudioWebSocketMessage extends BaseWebSocketMessage {
  type: "audio";
  audio: string; // Base64 encoded audio data
}

export interface TranslationWebSocketMessage extends BaseWebSocketMessage {
  type: "translation";
  original: string;
  translation: string;
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
