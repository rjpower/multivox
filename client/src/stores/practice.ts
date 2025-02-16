import { create } from "zustand";
import { WebSocketMessage, WebSocketState } from "../types";
import { AudioPlayer } from "../AudioPlayer";
import { AudioRecorder } from "../AudioRecorder";
import { ChatHistory } from "../ChatHistory";
import { translateText, initializeWebSocket } from "../practiceUtils";
import { TypedWebSocket } from "../TypedWebSocket";

export enum PracticeState {
  WAITING = "WAITING",
  TRANSLATING = "TRANSLATING",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
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
  
  setPracticeState: (state: PracticeState) => void;
  setModality: (modality: "text" | "audio") => void;
  setCustomInstructions: (instructions: string | null) => void;
  connect: (text: string, language: string) => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  sendMessage: (text: string) => void;
  reset: () => void;
}

function handleWebSocketMessage(
  set: (fn: (state: PracticeStore) => Partial<PracticeStore>) => void
) {
  return (message: WebSocketMessage) => {
    if (message.type == "audio") {
      const store = usePracticeStore.getState();
      if (store.audioPlayer) {
        store.audioPlayer.addAudioToQueue(message.audio);
      }
    }
    set((state) => ({
      chatHistory: state.chatHistory.handleMessage(message),
    }));
  };
}

export const usePracticeStore = create<PracticeStore>()((set, get) => ({
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

  setPracticeState: (state: PracticeState) =>
    set({ practiceState: state }),

  setModality: (modality) =>
    set({ modality }),

  setCustomInstructions: (instructions) =>
    set({ customInstructions: instructions }),

  connect: async (text, language) => {
    const store = get();
    try {
      set({ practiceState: PracticeState.TRANSLATING });
      
      const translation = await translateText({
        text,
        target_language: language,
      });

      set({
        practiceState: PracticeState.CONNECTING,
        translatedInstructions: translation,
      });

      const ws = await initializeWebSocket(
        language,
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
          role: "assistant",
          text: translation,
        }),
      });

      ws.send({
        type: "initialize",
        text: translation,
        role: "assistant",
      });
    } catch (error) {
      set({
        translatedInstructions: null,
        practiceState: PracticeState.WAITING,
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
          chatHistory: store.chatHistory.handleMessage({
            type: "audio",
            role: "user",
            audio: "",
          }),
        });
      }
    } catch (err) {
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
      }),
    });

    store.connection.send({
      type: "text",
      text,
      role: "user",
    });
  },

  reset: () => {
    const store = get();
    if (typeof store.audioPlayer?.stop === "function") {
      store.audioPlayer.stop();
    }
    if (typeof store.connection?.close === "function") {
      store.connection.close();
    }
    if (typeof store.recorder?.stopRecording === "function") {
      store.recorder.stopRecording();
    }
    set({
      isRecording: false,
      wsState: WebSocketState.DISCONNECTED,
      practiceState: PracticeState.WAITING,
      connection: null,
      recorder: null,
      translatedInstructions: null,
      customInstructions: null,
      chatHistory: new ChatHistory(),
    });
  },
}));
