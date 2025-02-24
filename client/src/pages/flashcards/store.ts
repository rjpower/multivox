import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { freezeAtom } from "jotai/utils";

interface Message {
  timestamp: string;
  text: string;
  type?: "error" | "success" | undefined;
  url?: string;
}

export const EXAMPLE_WORDS = `cat
dog
boy
girl
running
explanatory
self-explanatory
comprehensive
comprehensible
reprehensible
comparable
similarity
`;

const initialFieldMapping = {
  term_field: "",
  reading_field: "",
  meaning_field: "",
  context_native_field: "",
  context_en_field: "",
  separator: ",",
};

// Base atoms
export const modalVisibleAtom = atom(false);
export const messagesAtom = freezeAtom(atom<Message[]>([]));
export const spinnerAtom = atom(true);
export const submittingAtom = atom(false);
export const csvPreviewAtom = atom<any | null>(null);
export const websocketAtom = atom<WebSocket | null>(null);
export const contentAtom = atom("");
export const analyzeErrorAtom = atom<string | null>(null);
export const inputModeAtom = atom<"csv" | "srt">("csv");
export const fieldMappingAtom = atom(initialFieldMapping);
export const formatAtom = atom<"apkg" | "pdf">("pdf");
export const includeAudioAtom = atom(false);
export const downloadUrlAtom = atom<string | null>(null);

export const useFormValid = () => {
  const content = useAtomValue(contentAtom);
  const inputMode = useAtomValue(inputModeAtom);
  const csvPreview = useAtomValue(csvPreviewAtom);
  const fieldMapping = useAtomValue(fieldMappingAtom);

  if (!content) return false;
  if (inputMode === "csv") {
    if (!csvPreview) return false;
    return !!(fieldMapping.term_field || fieldMapping.meaning_field);
  }
  return true;
};

export const useCSVAnalysis = () => {
  const setContent = useSetAtom(contentAtom);
  const setAnalyzeError = useSetAtom(analyzeErrorAtom);
  const setCsvPreview = useSetAtom(csvPreviewAtom);
  const setFieldMapping = useSetAtom(fieldMappingAtom);
  const content = useAtomValue(contentAtom);

  const analyze = async (practiceLanguage: string, nativeLanguage: string) => {
    if (!content) {
      setAnalyzeError("Please paste some CSV content first");
      return;
    }
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/flashcards/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          source_language: practiceLanguage,
          target_language: nativeLanguage,
        }),
      });
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setCsvPreview(result);

      if (result.suggestions?.suggested_mapping) {
        const mapping = result.suggestions.suggested_mapping;
        setFieldMapping({
          term_field: mapping.term || "",
          reading_field: mapping.reading || "",
          meaning_field: mapping.meaning || "",
          context_native_field: mapping.context_native || "",
          context_en_field: mapping.context_en || "",
          separator: result.separator,
        });
      }
    } catch (err: any) {
      setAnalyzeError(err.message);
      setCsvPreview(null);
    }
  };

  return {
    analyze,
    setContent,
    loadExample: () => setContent(EXAMPLE_WORDS),
  };
};

// Generation process
export const useGeneration = () => {
  const setModalVisible = useSetAtom(modalVisibleAtom);
  const [messages, setMessages] = useAtom(messagesAtom);
  const [spinner, setSpinner] = useAtom(spinnerAtom);
  const [downloadUrl, setDownloadUrl] = useAtom(downloadUrlAtom);

  const setWebsocket = useSetAtom(websocketAtom);
  const setSubmitting = useSetAtom(submittingAtom);
  const format = useAtomValue(formatAtom);
  const includeAudio = useAtomValue(includeAudioAtom);
  const content = useAtomValue(contentAtom);
  const inputMode = useAtomValue(inputModeAtom);
  const fieldMapping = useAtomValue(fieldMappingAtom);

  const resetGeneration = () => {
    setMessages([]);
    setSpinner(false);
    setDownloadUrl(null);
    setSubmitting(false);
    setWebsocket(null);
  };

  const logMessage = (text: string, type?: "error" | "success") => {
    setMessages((messages) => [
      ...messages,
      {
        timestamp: new Date().toISOString(),
        text,
        type,
      },
    ].slice(-100));
  };

  const startGeneration = (sourceLanguage: string, targetLanguage: string) => {
    setSubmitting(true);
    setModalVisible(true);
    setMessages([]);
    logMessage("Starting processing...");

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(
        `${protocol}//${window.location.host}/api/flashcards/generate`
      );
      setWebsocket(ws);

      ws.onopen = () => {
        setSpinner(false);
        const request = {
          content,
          format,
          include_audio: includeAudio,
          source_language: sourceLanguage,
          target_language: targetLanguage,
          mode: inputMode,
          field_mapping:
            inputMode === "csv"
              ? {
                  term: fieldMapping.term_field,
                  reading: fieldMapping.reading_field,
                  meaning: fieldMapping.meaning_field,
                  context_native: fieldMapping.context_native_field,
                  context_en: fieldMapping.context_en_field,
                }
              : null,
        };
        ws.send(JSON.stringify(request));
      };

      ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        logMessage(data.text, data.type);
        setSpinner(data.type !== "success");
        if (data.url) {
          setDownloadUrl(data.url);
        }
      };
    } catch (err: any) {
      logMessage(`Error: ${err.message}`, "error");
      setSubmitting(false);
    }
  };

  return { messages, spinner, downloadUrl, startGeneration, resetGeneration};
};
