import { atom, Atom, SetStateAction, useAtomValue, useSetAtom } from "jotai";
import { freezeAtom } from "jotai/utils";

import {
  TranslateRequest,
  TranslateResponse,
  WebSocketMessage,
  WebSocketState,
} from "../../types";
import { AudioPlayer } from "./components/AudioPlayer";
import { AudioRecorder } from "./components/AudioRecorder";
import { TypedWebSocket } from "./components/TypedWebSocket";

export enum PracticeState {
  WAITING = "WAITING",
  TRANSLATING = "TRANSLATING",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
}

// Jotai Atoms
const isRecordingAtom = atom(false);
const practiceStateAtom = atom(PracticeState.WAITING);
const wsStateAtom = atom(WebSocketState.DISCONNECTED);
const translatedInstructionsAtom = atom<string | null>(null);
const customInstructionsAtom = atom<string | null>(null);
const chatHistoryAtom = freezeAtom(atom<WebSocketMessage[]>([]));
const connectionAtom = freezeAtom(atom<TypedWebSocket | null>(null));

const recorderAtom = atom<AudioRecorder | null>(null);
const audioPlayerAtom = atom(new AudioPlayer());

type SetAtom<Args extends any[], Result> = (...args: Args) => Result;
type MessagesUpdater = SetAtom<[SetStateAction<WebSocketMessage[]>], void>;

export async function initializeWebSocket(
  practiceLanguage: string,
  nativeLanguage: string,
  modality: string,
  setChatHistory: MessagesUpdater,
  audioPlayer: AudioPlayer
): Promise<TypedWebSocket> {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new TypedWebSocket(
    `${protocol}//${
      window.location.host
    }/api/practice?practice_language=${encodeURIComponent(
      practiceLanguage
    )}&native_language=${encodeURIComponent(
      nativeLanguage
    )}&modality=${modality}`
  );

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  ws.onclose = (event) => {
    console.log("WebSocket closed:", event.code, event.reason);
    setChatHistory((prev) => [
      ...prev,
      {
        type: "error",
        text: "Connection lost. Please refresh the page to reconnect.",
        role: "system",
        end_of_turn: true,
      },
    ]);
  };

  ws.onmessage = (message: WebSocketMessage) => {
    if (message.type === "audio") {
      audioPlayer.addAudioToQueue({
        data: message.audio,
        mime_type: message.mime_type,
      });
    }
    setChatHistory((prev) => {
      const updated = [...prev, message];
      return updated;
    });
  };

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

// Function to add error messages to chat history
export function useError() {
  const setChatHistory = useSetAtom(chatHistoryAtom);

  return ({ type, message }: { type: string; message: string }) => {
    setChatHistory((prev) => [
      ...prev,
      {
        type: "error",
        role: "system",
        text: `${type}: ${message}`,
        end_of_turn: true,
      },
    ]);
  };
}

export interface ConnectParams {
  text: string;
  practiceLanguage: string;
  nativeLanguage: string;
  modality: "text" | "audio";
}

export function useConnect() {
  const setPracticeState = useSetAtom(practiceStateAtom);
  const setTranslatedInstructions = useSetAtom(translatedInstructionsAtom);
  const setConnection = useSetAtom(connectionAtom);
  const setRecorder = useSetAtom(recorderAtom);
  const setWsState = useSetAtom(wsStateAtom);
  const setChatHistory = useSetAtom(chatHistoryAtom);
  const audioPlayer = useAtomValue(audioPlayerAtom);
  const setError = useError();

  return async ({
    text,
    practiceLanguage,
    nativeLanguage,
    modality,
  }: ConnectParams) => {
    try {
      // Reset state
      setPracticeState(PracticeState.TRANSLATING);
      setChatHistory([]);

      // Step 1: Translate the instructions
      let translation;
      try {
        translation = await translateText({
          text,
          source_language: "en",
          target_language: practiceLanguage,
          need_chunks: false,
          need_dictionary: false,
        });
      } catch (err) {
        const errorMessage = `Translation failed: ${(err as Error).message}`;
        setPracticeState(PracticeState.WAITING);
        setError({ type: "translation", message: errorMessage });
        throw new Error(errorMessage);
      }

      // Step 2: Connect to WebSocket
      setPracticeState(PracticeState.CONNECTING);
      setTranslatedInstructions(translation);

      let ws;
      try {
        ws = await initializeWebSocket(
          practiceLanguage,
          nativeLanguage,
          modality,
          setChatHistory,
          audioPlayer
        );
      } catch (err) {
        const errorMessage = `Connection failed: ${(err as Error).message}`;
        setTranslatedInstructions(null);
        setPracticeState(PracticeState.WAITING);
        setError({ type: "connection", message: errorMessage });
        throw new Error(errorMessage);
      }

      // Step 3: Setup recorder and initialize chat
      setConnection(ws);
      const newRecorder = new AudioRecorder(ws);
      setRecorder(newRecorder);
      setWsState(WebSocketState.CONNECTED);
      setPracticeState(PracticeState.ACTIVE);

      setChatHistory((prev) => [
        ...prev,
        {
          type: "initialize",
          role: "system",
          text: translation,
          end_of_turn: true,
        },
      ]);

      ws.send({
        type: "initialize",
        role: "system",
        text: translation,
        end_of_turn: true,
      });
    } catch (error) {
      // Any uncaught errors will be handled here
      console.error("Connection error:", error);
      // We don't need to do anything else here since the specific error handlers
      // already updated the state appropriately
      throw error;
    }
  };
}

export function useStartRecording() {
  const recorder = useAtomValue(recorderAtom);
  const setIsRecording = useSetAtom(isRecordingAtom);
  const setError = useError();
  const setChatHistory = useSetAtom(chatHistoryAtom);

  return async () => {
    try {
      if (recorder) {
        await recorder.startRecording();
        setIsRecording(true);
        setChatHistory((prev) => [
          ...prev,
          {
            type: "audio",
            role: "user",
            audio: "",
            mime_type: "audio/pcm",
            end_of_turn: false,
          },
        ]);
      }
    } catch (err) {
      const errorMessage =
        "Failed to access microphone. Please check your permissions.";
      setError({ type: "recording", message: errorMessage });
      console.error("Failed to start recording:", err);
    }
  };
}

export function useStopRecording() {
  const recorder = useAtomValue(recorderAtom);
  const setIsRecording = useSetAtom(isRecordingAtom);
  const setChatHistory = useSetAtom(chatHistoryAtom);

  return () => {
    if (recorder) {
      recorder.stopRecording();
      setIsRecording(false);
      setChatHistory((prev) => [
        ...prev,
        {
          type: "audio",
          role: "user",
          audio: "",
          mime_type: "audio/pcm",
          end_of_turn: true,
        },
      ]);
    }
  };
}

export function useSendMessage() {
  const connection = useAtomValue(connectionAtom);
  const setChatHistory = useSetAtom(chatHistoryAtom);

  return (text: string) => {
    if (!connection || connection.readyState !== WebSocket.OPEN) {
      console.error("WebSocket not connected");
      return;
    }

    setChatHistory((prev) => [
      ...prev,
      {
        type: "text",
        role: "user",
        text,
        end_of_turn: true,
      },
    ]);

    connection.send({
      type: "text",
      text,
      role: "user",
      end_of_turn: true,
    });
  };
}

export function useReset() {
  const audioPlayer = useAtomValue(audioPlayerAtom);
  const connection = useAtomValue(connectionAtom);
  const recorder = useAtomValue(recorderAtom);
  const setIsRecording = useSetAtom(isRecordingAtom);
  const setPracticeState = useSetAtom(practiceStateAtom);
  const setWsState = useSetAtom(wsStateAtom);
  const setTranslatedInstructions = useSetAtom(translatedInstructionsAtom);
  const setCustomInstructions = useSetAtom(customInstructionsAtom);
  const setChatHistory = useSetAtom(chatHistoryAtom);
  const setConnection = useSetAtom(connectionAtom);
  const setRecorder = useSetAtom(recorderAtom);

  return () => {
    if (typeof audioPlayer?.stop === "function") audioPlayer.stop();
    if (typeof connection?.close === "function") connection.close();
    if (typeof recorder?.stopRecording === "function") recorder.stopRecording();

    setIsRecording(false);
    setPracticeState(PracticeState.WAITING);
    setWsState(WebSocketState.DISCONNECTED);
    setTranslatedInstructions(null);
    setCustomInstructions(null);
    setChatHistory([]);
    setConnection(null);
    setRecorder(null);
  };
}

export {
  audioPlayerAtom,
  chatHistoryAtom,
  connectionAtom,
  customInstructionsAtom,
  isRecordingAtom,
  practiceStateAtom,
  recorderAtom,
  translatedInstructionsAtom,
  wsStateAtom,
};

function makeDebugStore(atoms: Record<string, Atom<any>>) {
  for (const [name, atom] of Object.entries(atoms)) {
    atom.debugLabel = name;
  }
}

makeDebugStore({
  audioPlayerAtom,
  chatHistoryAtom,
  connectionAtom,
  customInstructionsAtom,
  isRecordingAtom,
  practiceStateAtom,
  recorderAtom,
  translatedInstructionsAtom,
  wsStateAtom,
});
