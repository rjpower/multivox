import { useAppStore } from "./store";
import { TypedWebSocket } from "./TypedWebSocket";
import { TranslateRequest } from "./types";

export async function initializeWebSocket(
  language: string,
  modality: string,
  onMessage: (message: any) => void
): Promise<TypedWebSocket> {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const apiKey = useAppStore.getState().geminiApiKey;
  if (!apiKey) {
    throw new Error("Gemini API key is required");
  }

  const ws = new TypedWebSocket(
    `${protocol}//${
      window.location.host
    }/api/practice?target_language=${encodeURIComponent(language)}&modality=${modality}&api_key=${encodeURIComponent(
      apiKey
    )}`
  );

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  ws.onclose = (event) => {
    console.log("WebSocket closed:", event.code, event.reason);
  };

  ws.onmessage = onMessage;

  return new Promise((resolve) => {
    ws.onopen = () => {
      console.log("WebSocket connected");
      resolve(ws);
    };
  });
}

export async function translateText(request: TranslateRequest): Promise<string> {
  const apiKey = useAppStore.getState().geminiApiKey;
  if (!apiKey) {
    throw new Error("Gemini API key is required");
  }

  const response = await fetch(
    `/api/translate?api_key=${encodeURIComponent(
      apiKey
    )}&target_language=${encodeURIComponent(request.target_language)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  const data = await response.json();
  return data.translation;
}
