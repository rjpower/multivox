import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { create } from "zustand";

export interface FlashcardFieldMapping {
  term: string;
  reading?: string;
  meaning?: string;
  context_native?: string;
  context_en?: string;
}

export interface FlashcardGenerateRequest {
  content: string;
  format: "apkg" | "pdf";
  mode: "csv" | "srt";
  include_audio: boolean;
  field_mapping?: FlashcardFieldMapping | null;
  target_language: string;
}

export interface FlashcardProgressMessage {
  text: string;
  type: "info" | "error" | "success";
}

export interface FlashcardProgressMessage {
  text: string;
}

export interface Message {
  timestamp: string;
  text: string;
  type?: "error" | "success" | undefined;
}

interface UploadStore {
  modalVisible: boolean;
  messages: Message[];
  spinner: boolean;
  submitting: boolean;
  csvPreview: any | null;
  websocket: WebSocket | null;
  showModal: () => void;
  hideModal: () => void;
  setSubmitting: (flag: boolean) => void;
  setSpinner: (flag: boolean) => void;
  logMessage: (text: string, type?: "error" | "success" | undefined) => void;
  clearMessages: () => void;
  setCsvPreview: (preview: any) => void;
  startStream: (mode: "csv" | "srt", content: string, options: any) => void;
  cleanup: () => void;
}

export const useUploadStore = create<UploadStore>((set, get) => ({
  modalVisible: false,
  messages: [],
  spinner: true,
  submitting: false,
  csvPreview: null,
  websocket: null,
  showModal: () => set({ modalVisible: true }),
  cleanup: () => {
    const { websocket } = get();
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.close();
    }
    set({ websocket: null, submitting: false, spinner: true });
  },
  hideModal: () => {
    get().cleanup();
    set({ modalVisible: false });
  },
  setSubmitting: (submitting) => set({ submitting }),
  setSpinner: (spinner) => set({ spinner }),
  logMessage: (text, type?) =>
    set((state) => {
      const timestamp = new Date().toLocaleTimeString();
      return {
        messages: [...state.messages, { timestamp, text, type }].slice(-100),
      };
    }),
  clearMessages: () => set({ messages: [] }),
  setCsvPreview: (preview) => set({ csvPreview: preview }),
  startStream: (mode, content, options) => {
    // Cleanup any existing websocket
    get().cleanup();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/api/flashcards/generate`
    );
    set({ websocket: ws });
    ws.onopen = () => {
      set({ spinner: false });
      const request: FlashcardGenerateRequest = {
        content,
        format: options.format,
        include_audio: options.includeAudio,
        target_language: options.target_language,
        mode: mode,
        field_mapping:
          mode === "csv"
            ? {
                term: options.termField,
                reading: options.readingField,
                meaning: options.meaningField,
                context_native: options.contextNativeField,
                context_en: options.contextEnField,
              }
            : null,
      };
      ws.send(JSON.stringify(request));
    };
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      set((state) => {
        const timestamp = new Date().toLocaleTimeString();
        return {
          messages: [
            ...state.messages,
            { timestamp, text: data.text, type: data.type },
          ].slice(-100),
        };
      });
    };
    ws.onclose = () => set({ spinner: true });
  },
}));

interface ProcessingModalProps {
  visible: boolean;
  messages: Message[];
  spinner: boolean;
  onClose: () => void;
}

const ProcessingModal: React.FC<ProcessingModalProps> = ({
  visible,
  messages,
  spinner,
  onClose,
}) => {
  if (!visible) return null;

  const handleClose = () => {
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black opacity-60 z-40"
        onClick={handleClose}
      ></div>
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded shadow-lg z-50">
        <div className="flex items-center justify-between p-4 bg-gray-100 border-b">
          <span>Processing your request...</span>
          <div className="flex items-center space-x-2">
            {spinner && (
              <div className="w-6 h-6 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            )}
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full p-1"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-4 h-72 overflow-y-auto font-mono text-sm">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`mb-1 ${
                msg.type === "error"
                  ? "text-red-600"
                  : msg.type === "success"
                  ? "text-green-600"
                  : "text-gray-800"
              }`}
            >
              <span className="mr-2">[{msg.timestamp}]</span>
              <span dangerouslySetInnerHTML={{ __html: msg.text }} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

interface CSVAnalysisResponse {
  headers: string[];
  preview_rows: Record<string, string>[];
  separator: string;
  suggestions?: {
    suggested_mapping: {
      term: string;
      reading?: string;
      meaning?: string;
      context_native?: string;
      context_en?: string;
    };
    confidence: "high" | "medium" | "low";
    reasoning: string;
  };
  error?: string;
}

const CSVPreviewTable = ({
  headers,
  previewRows,
  fieldMapping,
}: {
  headers: string[];
  previewRows: Record<string, string>[];
  fieldMapping: typeof initialFieldMapping;
}) => {
  const getMappingLabel = (header: string) => {
    const mappings = {
      [fieldMapping.term_field]: "Term",
      [fieldMapping.reading_field]: "Reading",
      [fieldMapping.meaning_field]: "Meaning",
      [fieldMapping.context_native_field]: "Context (JP)",
      [fieldMapping.context_en_field]: "Context (EN)",
    };
    return mappings[header];
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">CSV Preview</h3>
      </div>
      <div className="p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                {headers.map((h: string, idx: number) => {
                  const mappedTo = getMappingLabel(h);
                  return (
                    <th
                      key={idx}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      <div>{h}</div>
                      {mappedTo && (
                        <div className="text-indigo-600 font-medium mt-1">
                          ↳ {mappedTo}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {previewRows.map((row: Record<string, string>, idx: number) => (
                <tr
                  key={idx}
                  className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  {headers.map((h: string, i: number) => (
                    <td
                      key={i}
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    >
                      {row[h]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SuggestionPanel = ({
  suggestions,
}: {
  suggestions: CSVAnalysisResponse["suggestions"];
}) => {
  if (!suggestions) return null;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Suggested Mapping
          </h3>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              suggestions.confidence === "high"
                ? "bg-green-100 text-green-800"
                : suggestions.confidence === "medium"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {suggestions.confidence} confidence
          </span>
        </div>
      </div>
      <div className="p-6">
        <p className="text-sm text-gray-600 mb-4">{suggestions.reasoning}</p>
      </div>
    </div>
  );
};

const FieldMappingForm = ({
  fieldMapping,
  setFieldMapping,
  headers,
}: {
  fieldMapping: typeof initialFieldMapping;
  setFieldMapping: (mapping: typeof initialFieldMapping) => void;
  headers: string[];
}) => {
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-4">Field Mapping</h3>
      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-100 rounded">
        <div className="space-y-4">
          <FieldSelect
            label="Term Field"
            value={fieldMapping.term_field}
            onChange={(value) =>
              setFieldMapping({ ...fieldMapping, term_field: value })
            }
            options={headers}
            required
          />
          <FieldSelect
            label="Reading Field"
            value={fieldMapping.reading_field}
            onChange={(value) =>
              setFieldMapping({ ...fieldMapping, reading_field: value })
            }
            options={headers}
          />
          <FieldSelect
            label="Meaning Field"
            value={fieldMapping.meaning_field}
            onChange={(value) =>
              setFieldMapping({ ...fieldMapping, meaning_field: value })
            }
            options={headers}
          />
        </div>
        <div className="space-y-4">
          <FieldSelect
            label="Example (JP)"
            value={fieldMapping.context_native_field}
            onChange={(value) =>
              setFieldMapping({ ...fieldMapping, context_native_field: value })
            }
            options={headers}
          />
          <FieldSelect
            label="Example (EN)"
            value={fieldMapping.context_en_field}
            onChange={(value) =>
              setFieldMapping({ ...fieldMapping, context_en_field: value })
            }
            options={headers}
          />
          <div className="flex items-center gap-4">
            <label className="w-32 text-right">Separator:</label>
            <input
              type="text"
              value={fieldMapping.separator}
              onChange={(e) =>
                setFieldMapping({ ...fieldMapping, separator: e.target.value })
              }
              className="border rounded p-2"
              required
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const FieldSelect = ({
  label,
  value,
  onChange,
  options,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  required?: boolean;
}) => {
  return (
    <div className="flex items-center gap-4">
      <label className="w-32 text-right">{label}:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded p-2"
        required={required}
      >
        <option value="">(No matching column)</option>
        {options.map((opt, idx) => (
          <option key={idx} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
};

const initialFieldMapping = {
  term_field: "",
  reading_field: "",
  meaning_field: "",
  context_native_field: "",
  context_en_field: "",
  separator: ",",
};

const FlashcardGenerator = () => {
  const [inputMode, setInputMode] = useState<"csv" | "srt">("csv");
  const [content, setContent] = useState("");
  const [fieldMapping, setFieldMapping] = useState(initialFieldMapping);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [format, setFormat] = useState("apkg");
  const [includeAudio, setIncludeAudio] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("");
  const [languages, setLanguages] = useState<
    Array<{ code: string; name: string }>
  >([]);

  useEffect(() => {
    fetch("/api/flashcards/languages")
      .then((res) => res.json())
      .then((data) => {
        setLanguages(data);
        if (data.length > 0) {
          setTargetLanguage(data[0].code);
        }
      });
  }, []);
  const {
    modalVisible,
    messages,
    spinner,
    submitting,
    logMessage,
    setSubmitting,
    clearMessages,
    setCsvPreview,
    csvPreview,
    showModal,
    hideModal,
    startStream,
  } = useUploadStore();

  const handleAnalyze = async () => {
    if (!content) {
      setAnalyzeError("Please paste some CSV content first");
      return;
    }
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/flashcards/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }
      const result: CSVAnalysisResponse = await res.json();
      if (result.error) throw new Error(result.error);
      setCsvPreview(result);

      // Pre-fill field mapping if suggestions are available
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    showModal();
    clearMessages();
    logMessage("Starting processing...");

    const options = {
      format,
      includeAudio,
      target_language: targetLanguage,
      ...(inputMode === "csv"
        ? {
            termField: fieldMapping.term_field,
            readingField: fieldMapping.reading_field,
            meaningField: fieldMapping.meaning_field,
            contextNativeField: fieldMapping.context_native_field,
            contextEnField: fieldMapping.context_en_field,
            separator: fieldMapping.separator,
          }
        : {}),
    };

    try {
      startStream(inputMode, content, options);
    } catch (err: any) {
      logMessage(`Error: ${err.message}`, "error");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold mb-4">Vocabulary Card Builder</h1>
          <div className="mb-4">
            <label className="mr-2 font-medium">Input Mode:</label>
            <select
              value={inputMode}
              onChange={(e) => setInputMode(e.target.value as "csv" | "srt")}
              className="border rounded p-2"
            >
              <option value="srt">SRT</option>
              <option value="csv">CSV</option>
            </select>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-medium mb-2">
                Paste your content:
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  inputMode === "csv"
                    ? "Paste CSV content here..."
                    : "Paste SRT content here..."
                }
                className="w-full h-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              ></textarea>
            </div>
            {inputMode === "csv" && (
              <>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    Analyze CSV
                  </button>
                  {analyzeError && (
                    <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                      Error analyzing CSV: {analyzeError}
                    </div>
                  )}
                </div>
                {csvPreview && (
                  <div className="space-y-6 mt-4">
                    <CSVPreviewTable
                      headers={csvPreview.headers}
                      previewRows={csvPreview.preview_rows}
                      fieldMapping={fieldMapping}
                    />

                    <SuggestionPanel suggestions={csvPreview.suggestions} />
                    <FieldMappingForm
                      fieldMapping={fieldMapping}
                      setFieldMapping={setFieldMapping}
                      headers={csvPreview.headers}
                    />
                  </div>
                )}
              </>
            )}
            <div className="flex items-center gap-4">
              <label className="mr-2">Output Format:</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="apkg">Anki Deck</option>
                <option value="pdf">PDF</option>
              </select>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeAudio}
                  onChange={(e) => setIncludeAudio(e.target.checked)}
                />
                Include TTS Audio
              </label>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Target Language:
                </label>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Select Language</option>
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Generate Deck
                </button>
              </div>
            </div>
          </form>
          <ProcessingModal
            visible={modalVisible}
            messages={messages}
            spinner={spinner}
            onClose={hideModal}
          />
        </div>
      </div>
    </div>
  );
};

export default FlashcardGenerator;
