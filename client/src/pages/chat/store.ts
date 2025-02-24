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

export async function initializeWebSocket(
  practiceLanguage: string,
  nativeLanguage: string,
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
      nativeLanguage
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

// Jotai Atoms
const isRecordingAtom = atom(false);
const practiceStateAtom = atom(PracticeState.WAITING);
const wsStateAtom = atom(WebSocketState.DISCONNECTED);
const modalityAtom = atom<"text" | "audio">("audio");
const translatedInstructionsAtom = atom<string | null>(null);
const customInstructionsAtom = atom<string | null>(null);
const chatHistoryAtom = freezeAtom(atom<WebSocketMessage[]>([]));
const connectionAtom = freezeAtom(atom<TypedWebSocket | null>(null));

const recorderAtom = atom<AudioRecorder | null>(null);
const audioPlayerAtom = atom(new AudioPlayer());

const errorAtom = atom<{
  type: "translation" | "connection" | "recording" | null;
  message: string | null;
}>({ type: null, message: null });

type SetAtom<Args extends any[], Result> = (...args: Args) => Result;
type MessagesUpdater = SetAtom<[SetStateAction<WebSocketMessage[]>], void>;

function createWebSocketHandler(
  setChatHistory: MessagesUpdater,
  audioPlayer: AudioPlayer
) {
  return (message: WebSocketMessage) => {
    console.log("Received message: ", message);
    if (message.type === "audio") {
      audioPlayer.addAudioToQueue({
        data: message.audio,
        mime_type: message.mime_type,
      });
    }
    setChatHistory((prev) => {
      const updated = [...prev, message];
      return updated;
      // return updated.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    });
  };
}

export function useConnect() {
  const setPracticeState = useSetAtom(practiceStateAtom);
  const setError = useSetAtom(errorAtom);
  const setTranslatedInstructions = useSetAtom(translatedInstructionsAtom);
  const setConnection = useSetAtom(connectionAtom);
  const setRecorder = useSetAtom(recorderAtom);
  const setWsState = useSetAtom(wsStateAtom);
  const setChatHistory = useSetAtom(chatHistoryAtom);
  const modality = useAtomValue(modalityAtom);
  const audioPlayer = useAtomValue(audioPlayerAtom);

  return async (
    text: string,
    practiceLanguage: string,
    nativeLanguage: string
  ) => {
    try {
      setPracticeState(PracticeState.TRANSLATING);
      setError({ type: null, message: null });

      const translation = await translateText({
        text,
        source_language: "en",
        target_language: practiceLanguage,
        need_chunks: false,
        need_dictionary: false,
      }).catch((err) => {
        throw new Error(`Translation failed: ${err.message}`);
      });

      setPracticeState(PracticeState.CONNECTING);
      setTranslatedInstructions(translation);

      const ws = await initializeWebSocket(
        practiceLanguage,
        nativeLanguage,
        modality,
        createWebSocketHandler(setChatHistory, audioPlayer)
      );

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
      const err = error as Error;
      setTranslatedInstructions(null);
      setPracticeState(PracticeState.WAITING);
      setError({
        type: err.message.includes("Translation failed")
          ? "translation"
          : "connection",
        message: err.message,
      });
      throw error;
    }
  };
}

export function useStartRecording() {
  const recorder = useAtomValue(recorderAtom);
  const setIsRecording = useSetAtom(isRecordingAtom);
  const setError = useSetAtom(errorAtom);
  const setChatHistory = useSetAtom(chatHistoryAtom);

  return async () => {
    try {
      if (recorder) {
        await recorder.startRecording();
        setIsRecording(true);
        setError({ type: null, message: null });
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
      setError({
        type: "recording",
        message: "Failed to access microphone. Please check your permissions.",
      });
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
  const setModality = useSetAtom(modalityAtom);
  const setTranslatedInstructions = useSetAtom(translatedInstructionsAtom);
  const setCustomInstructions = useSetAtom(customInstructionsAtom);
  const setChatHistory = useSetAtom(chatHistoryAtom);
  const setConnection = useSetAtom(connectionAtom);
  const setRecorder = useSetAtom(recorderAtom);
  const setError = useSetAtom(errorAtom);

  return () => {
    if (typeof audioPlayer?.stop === "function") audioPlayer.stop();
    if (typeof connection?.close === "function") connection.close();
    if (typeof recorder?.stopRecording === "function") recorder.stopRecording();

    setIsRecording(false);
    setPracticeState(PracticeState.WAITING);
    setWsState(WebSocketState.DISCONNECTED);
    setModality("audio");
    setTranslatedInstructions(null);
    setCustomInstructions(null);
    setChatHistory([]);
    setConnection(null);
    setRecorder(null);
    setError({ type: null, message: null });
  };
}

// Export atoms for direct use if needed (e.g., simple setters)
export {
  audioPlayerAtom,
  chatHistoryAtom,
  connectionAtom,
  customInstructionsAtom,
  errorAtom,
  isRecordingAtom,
  modalityAtom,
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
  errorAtom,
  isRecordingAtom,
  modalityAtom,
  practiceStateAtom,
  recorderAtom,
  translatedInstructionsAtom,
  wsStateAtom,
});
