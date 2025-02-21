import { create } from "zustand";

import { AudioPlayer } from "../AudioPlayer";
import { AudioRecorder } from "../AudioRecorder";
import { ChatHistory } from "../ChatHistory";
import {
  TranslateRequest,
  TranslateResponse,
  WebSocketMessage,
  WebSocketState,
} from "../types";
import { TypedWebSocket } from "../TypedWebSocket";
import { devtools } from "zustand/middleware";

export enum PracticeState {
  WAITING = "WAITING",
  TRANSLATING = "TRANSLATING",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
}

export async function initializeWebSocket(
  practiceLanguage: string,
  nativeLanauge: string,
  modality: string,
  onMessage: (message: any) => void
): Promise<TypedWebSocket> {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new TypedWebSocket(
    `${protocol}//${
      window.location.host
    }/api/practice?practice_language=${encodeURIComponent(
      practiceLanguage
    )}&native_language=${encodeURIComponent(
      nativeLanauge
    )}&modality=${modality}`
  );

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  ws.onclose = (event) => {
    console.log("WebSocket closed:", event.code, event.reason);
    onMessage({
      type: "error",
      text: "Connection lost. Please refresh the page to reconnect.",
      role: "system",
    });
  };

  ws.onmessage = onMessage;

  return new Promise((resolve) => {
    ws.onopen = () => {
      console.log("WebSocket connected");
      resolve(ws);
    };
  });
}

export async function translateText(
  request: TranslateRequest
): Promise<string> {
  const response = await fetch(`/api/translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail
        ? JSON.stringify(errorData.detail)
        : `Translation failed with status ${response.status}`
    );
  }

  const data = (await response.json()) as TranslateResponse;
  return data.translated_text;
}

interface PracticeStore {
  isRecording: boolean;
  practiceState: PracticeState;
  wsState: WebSocketState;
  modality: "text" | "audio";
  translatedInstructions: string | null;
  customInstructions: string | null;
  chatHistory: ChatHistory;
  connection: TypedWebSocket | null;
  recorder: AudioRecorder | null;
  audioPlayer: AudioPlayer;
  error: {
    type: "translation" | "connection" | "recording" | null;
    message: string | null;
  };

  setPracticeState: (state: PracticeState) => void;
  setModality: (modality: "text" | "audio") => void;
  setCustomInstructions: (instructions: string | null) => void;
  connect: (
    text: string,
    practiceLanguage: string,
    nativeLanguage: string
  ) => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  sendMessage: (text: string) => void;
  reset: () => void;
  setError: (
    type: "translation" | "connection" | "recording" | null,
    message: string | null
  ) => void;
  clearError: () => void;
}

function handleWebSocketMessage(
  set: (fn: (state: PracticeStore) => Partial<PracticeStore>) => void
) {
  return (message: WebSocketMessage) => {
    if (message.type == "audio") {
      const store = usePracticeStore.getState();
      if (store.audioPlayer) {
        store.audioPlayer.addAudioToQueue({
          data: message.audio,
          mime_type: message.mime_type,
        });
      }
    }
    set((state) => ({
      chatHistory: state.chatHistory.handleMessage(message),
    }));
  };
}

export const usePracticeStore = create<PracticeStore>()(
  devtools((set, get) => {
    return {
      isRecording: false,
      practiceState: PracticeState.WAITING,
      wsState: WebSocketState.DISCONNECTED,
      modality: "audio",
      translatedInstructions: null,
      customInstructions: null,
      chatHistory: new ChatHistory(),
      connection: null,
      recorder: null,
      audioPlayer: new AudioPlayer(),
      error: {
        type: null,
        message: null,
      },

      setPracticeState: (state: PracticeState) => set({ practiceState: state }),

      setModality: (modality) => set({ modality }),

      setCustomInstructions: (instructions) =>
        set({ customInstructions: instructions }),

      setError: (
        type: "translation" | "connection" | "recording" | null,
        message: string | null
      ) => set({ error: { type, message } }),
      clearError: () => set({ error: { type: null, message: null } }),

      connect: async (
        text: string,
        practiceLanguage: string,
        nativeLanguage: string
      ) => {
        const store = get();
        try {
          set({
            practiceState: PracticeState.TRANSLATING,
            error: { type: null, message: null },
          });

          const translation = await translateText({
            text,
            source_language: "en",
            target_language: practiceLanguage,
            need_chunks: false,
            need_dictionary: false,
          }).catch((err) => {
            throw new Error(`Translation failed: ${err.message}`);
          });

          set({
            practiceState: PracticeState.CONNECTING,
            translatedInstructions: translation,
          });

          const ws = await initializeWebSocket(
            practiceLanguage,
            nativeLanguage,
            store.modality,
            handleWebSocketMessage(set)
          );
          const recorder = new AudioRecorder(ws);

          set({
            connection: ws,
            recorder,
            wsState: WebSocketState.CONNECTED,
            practiceState: PracticeState.ACTIVE,
            chatHistory: store.chatHistory.handleMessage({
              type: "initialize",
              role: "system",
              text: translation,
              end_of_turn: true,
            }),
          });

          ws.send({
            type: "initialize",
            role: "system",
            text: translation,
            end_of_turn: true,
          });
        } catch (error) {
          const err = error as Error;
          set({
            translatedInstructions: null,
            practiceState: PracticeState.WAITING,
            error: {
              type: err.message.includes("Translation failed")
                ? "translation"
                : "connection",
              message: err.message,
            },
          });
          throw error;
        }
      },

      startRecording: async () => {
        const store = get();
        try {
          if (store.recorder) {
            await store.recorder.startRecording();
            set({
              isRecording: true,
              error: { type: null, message: null },
              chatHistory: store.chatHistory.handleMessage({
                type: "audio",
                role: "user",
                audio: "",
                mime_type: "audio/pcm",
                end_of_turn: false,
              }),
            });
          }
        } catch (err) {
          set({
            error: {
              type: "recording",
              message:
                "Failed to access microphone. Please check your permissions.",
            },
          });
          console.error("Failed to start recording:", err);
        }
      },

      stopRecording: () => {
        const store = get();
        if (store.recorder) {
          store.recorder.stopRecording();
          set({
            isRecording: false,
            chatHistory: store.chatHistory.handleMessage({
              type: "audio",
              role: "user",
              audio: "",
              mime_type: "audio/pcm",
              end_of_turn: true,
            }),
          });
        }
      },

      sendMessage: (text) => {
        const store = get();
        if (
          !store.connection ||
          store.connection.readyState !== WebSocket.OPEN
        ) {
          console.error("WebSocket not connected");
          return;
        }

        set({
          chatHistory: store.chatHistory.handleMessage({
            type: "text",
            role: "user",
            text,
            end_of_turn: true,
          }),
        });

        store.connection.send({
          type: "text",
          text,
          role: "user",
          end_of_turn: true,
        });
      },

      reset: () => {
        const store = get();
        // Clean up audio player
        if (typeof store.audioPlayer?.stop === "function") {
          store.audioPlayer.stop();
        }
        // Clean up websocket connection
        if (typeof store.connection?.close === "function") {
          store.connection.close();
        }
        // Clean up recorder
        if (typeof store.recorder?.stopRecording === "function") {
          store.recorder.stopRecording();
        }
        // Reset all state to initial values
        set({
          isRecording: false,
          practiceState: PracticeState.WAITING,
          wsState: WebSocketState.DISCONNECTED,
          modality: "audio",
          translatedInstructions: null,
          customInstructions: null,
          chatHistory: new ChatHistory(),
          connection: null,
          recorder: null,
          error: {
            type: null,
            message: null,
          },
        });
      },
    };
  })
);
