import { create } from 'zustand'
import { ChatHistory } from './ChatHistory'
import { TypedWebSocket } from './TypedWebSocket'
import { WebSocketState } from './types'
import { AudioRecorder } from "./AudioRecorder";
import { AudioPlayer } from "./AudioPlayer";

import { devtools } from "zustand/middleware";

interface PracticeState {
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;

  reset: () => void;

  wsState: WebSocketState;
  setWsState: (state: WebSocketState) => void;

  modality: "text" | "audio";
  setModality: (modality: "text" | "audio") => void;

  translatedInstructions: string | null;
  setTranslatedInstructions: (instructions: string | null) => void;
  translateInstructions: (text: string, language: string) => Promise<void>;
  
  customInstructions: string | null;
  setCustomInstructions: (instructions: string | null) => void;

  chatHistory: ChatHistory;
  setChatHistory: (history: ChatHistory) => void;
  updateChatHistory: (updater: (prev: ChatHistory) => ChatHistory) => void;

  connection: TypedWebSocket | null;
  setConnection: (ws: TypedWebSocket | null) => void;

  recorder: AudioRecorder | null;
  setRecorder: (recorder: AudioRecorder | null) => void;

  audioPlayer: AudioPlayer;

  // Session methods
  connect: (language: string) => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  sendMessage: (text: string) => void;
}

export const usePracticeStore = create(
  devtools<PracticeState>((set, get) => ({
    isRecording: false,
    setIsRecording: (recording) => set({ isRecording: recording }),

    wsState: WebSocketState.DISCONNECTED,
    setWsState: (state) => set({ wsState: state }),

    modality: "audio",
    setModality: (modality) => set({ modality }),

    translatedInstructions: null,
    setTranslatedInstructions: (instructions) =>
      set({ translatedInstructions: instructions }),
      
    customInstructions: null,
    setCustomInstructions: (instructions) => 
      set({ customInstructions: instructions }),
    translateInstructions: async (text: string, language: string) => {
      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language }),
        });
        const data = await response.json();
        set({ translatedInstructions: data.translation });
      } catch (error) {
        console.error("Translation failed:", error);
        set({ translatedInstructions: null });
      }
    },

    chatHistory: new ChatHistory(),
    setChatHistory: (history) => set({ chatHistory: history }),
    updateChatHistory: (updater) =>
      set((state) => ({ chatHistory: updater(state.chatHistory) })),

    connection: null,
    setConnection: (ws) => set({ connection: ws }),

    recorder: null,
    setRecorder: (recorder) => set({ recorder }),

    audioPlayer: new AudioPlayer(),

    connect: async (language: string) => {
      const state = get();
      if (state.wsState !== WebSocketState.DISCONNECTED) {
        return;
      }

      set({ wsState: WebSocketState.CONNECTING });
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new TypedWebSocket(
        `${protocol}//${window.location.host}/api/practice?lang=${language}&modality=${state.modality}`
      );

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
        if (state.wsState !== WebSocketState.DISCONNECTED) {
          set({
            connection: null,
            wsState: WebSocketState.DISCONNECTED,
          });
        }
      };

      ws.onmessage = (message) => {
        switch (message.type) {
          case "hint":
            if (message.hints) {
              set((state) => ({
                chatHistory: state.chatHistory.addHintMessage(
                  message.role,
                  message.hints
                ),
              }));
            }
            break;
          case "text":
            if (message.text) {
              set((state) => ({
                chatHistory:
                  message.role === "assistant"
                    ? state.chatHistory.updateLastAssistantMessage(
                        message.text!,
                        message.mode ?? "append"
                      )
                    : state.chatHistory.addTextMessage(
                        message.role,
                        message.text!
                      ),
              }));
            }
            break;
          case "translate":
            set((state) => ({
              chatHistory: state.chatHistory.addTranslateMessage(
                message.role,
                message.original,
                message.translation,
                message.chunked,
                message.dictionary
              ),
            }));
            break;
          case "transcription":
            set((state) => ({
              chatHistory: state.chatHistory.addTranscriptionMessage(
                message.role,
                message.transcription!
              ),
            }));
            break;
          case "audio":
            if (message.audio) {
              // Add to chat history first so UI updates
              set((state) => ({
                chatHistory: state.chatHistory.addAudioMessage(message.role),
              }));
              // Then queue the audio for playback
              if (get().audioPlayer) {
                get().audioPlayer.addAudioToQueue(message.audio);
              }
            }
            break;
        }
      };

      return new Promise<void>((resolve) => {
        ws.onopen = () => {
          console.log("WebSocket connected");
          set({
            recorder: new AudioRecorder(ws),
            connection: ws,
            wsState: WebSocketState.CONNECTED,
          });
          resolve();
        };
      });
    },

    startRecording: async () => {
      const state = get();
      try {
        if (state.recorder) {
          await state.recorder.startRecording();
          set({ isRecording: true });
          set((state) => ({
            chatHistory: state.chatHistory.addAudioMessage("user", true),
          }));
        }
      } catch (err) {
        console.error("Failed to start recording:", err);
      }
    },

    stopRecording: () => {
      const state = get();
      if (state.recorder) {
        state.recorder.stopRecording();
        set({ isRecording: false });
        set((state) => ({
          chatHistory: state.chatHistory.addAudioMessage("user", false),
        }));
      }
    },

    sendMessage: (text: string) => {
      const state = get();
      if (!state.connection || state.connection.readyState !== WebSocket.OPEN) {
        console.error("WebSocket not connected");
        return;
      }

      set((state) => ({
        chatHistory: state.chatHistory.addTextMessage("user", text),
      }));
      state.connection.send({
        type: "text",
        text,
        role: "user",
      });
    },

    reset: () => {
      const state = get();
      state.audioPlayer.stop();
      if (state.connection) {
        state.connection.close();
      }
      if (state.recorder) {
        state.recorder.stopRecording();
      }
      set({
        isRecording: false,
        wsState: WebSocketState.DISCONNECTED,
        connection: null,
        recorder: null,
        translatedInstructions: null,
        chatHistory: new ChatHistory(),
      });
    },
  }))
);
