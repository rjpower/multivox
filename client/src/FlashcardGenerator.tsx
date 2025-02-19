import { XMarkIcon } from "@heroicons/react/24/outline";
import { create } from "zustand";
import { useAppStore } from "./store";

const EXAMPLE_JAPANESE_WORDS = `山
空
本
猫
水
木
花
月
雨
風
時
道
海
手
目
耳
口
足
頭
心
`;

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
  url?: string;
}

interface UploadStore {
  modalVisible: boolean;
  messages: Message[];
  spinner: boolean;
  submitting: boolean;
  downloadUrl: string | null;
  csvPreview: any | null;
  websocket: WebSocket | null;
  content: string;
  analyzeError: string | null;
  inputMode: "csv" | "srt";
  fieldMapping: typeof initialFieldMapping;
  format: "apkg" | "pdf";
  includeAudio: boolean;
  targetLanguage: string;
  isFormValid: () => boolean;
  showModal: () => void;
  hideModal: () => void;
  setSubmitting: (flag: boolean) => void;
  setSpinner: (flag: boolean) => void;
  setContent: (content: string) => void;
  setAnalyzeError: (error: string | null) => void;
  setInputMode: (mode: "csv" | "srt") => void;
  setFieldMapping: (mapping: typeof initialFieldMapping) => void;
  setFormat: (format: "apkg" | "pdf") => void;
  setIncludeAudio: (include: boolean) => void;
  setTargetLanguage: (lang: string) => void;
  logMessage: (text: string, type?: "error" | "success" | undefined) => void;
  scrollToBottom: () => void;
  clearMessages: () => void;
  setCsvPreview: (preview: any) => void;
  startGeneration: () => void;
  cleanup: () => void;
}

export const useUploadStore = create<UploadStore>((set, get) => ({
  downloadUrl: "",
  modalVisible: false,
  messages: [],
  spinner: true,
  submitting: false,
  csvPreview: null,
  websocket: null,
  content: "",
  analyzeError: null,
  inputMode: "csv",
  fieldMapping: initialFieldMapping,
  format: "pdf",
  includeAudio: false,
  targetLanguage: "",

  isFormValid: () => {
    const state = get();
    if (!state.content || !state.targetLanguage) return false;

    if (state.inputMode === "csv") {
      // For CSV mode, require analysis and field mapping
      if (!state.csvPreview) return false;
      // At minimum need term field mapped
      if (!state.fieldMapping.term_field) return false;
    }

    return true;
  },

  setContent: (content: string) => set({ content }),
  setAnalyzeError: (error: string | null) => set({ analyzeError: error }),
  setInputMode: (mode: "csv" | "srt") => set({ inputMode: mode }),
  setFieldMapping: (mapping) => set({ fieldMapping: mapping }),
  setFormat: (format: "apkg" | "pdf") => set({ format }),
  setIncludeAudio: (include: boolean) => set({ includeAudio: include }),
  setTargetLanguage: (lang: string) => set({ targetLanguage: lang }),
  showModal: () => set({ modalVisible: true }),
  cleanup: () => {
    const { websocket } = get();
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.close();
    }
    // Reset everything except content
    set({
      websocket: null,
      submitting: false,
      spinner: true,
      messages: [],
      downloadUrl: null,
      csvPreview: null,
      analyzeError: null,
      fieldMapping: initialFieldMapping,
      modalVisible: false,
      inputMode: "csv",
      format: "pdf",
      includeAudio: false,
    });
  },
  hideModal: () => {
    get().cleanup();
  },
  setSubmitting: (submitting) => set({ submitting }),
  setSpinner: (spinner: boolean) => set({ spinner }),
  logMessage: (text, type?) => {
    set((state) => {
      const timestamp = new Date().toISOString();
      const newState = {
        messages: [...state.messages, { timestamp, text, type }].slice(-100),
      };
      // Schedule scroll after state update
      setTimeout(() => {
        const container = document.getElementById("message-container");
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 0);
      return newState;
    });
  },
  scrollToBottom: () => {
    const container = document.getElementById("message-container");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  },
  clearMessages: () => set({ messages: [] }),
  setCsvPreview: (preview) => set({ csvPreview: preview }),
  startGeneration: () => {
    const state = get();
    state.setSubmitting(true);
    state.showModal();
    state.clearMessages();
    state.logMessage("Starting processing...");

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(
        `${protocol}//${window.location.host}/api/flashcards/generate`
      );
      set({ websocket: ws });

      ws.onopen = () => {
        set({ spinner: false });
        const request: FlashcardGenerateRequest = {
          content: state.content,
          format: state.format,
          include_audio: state.includeAudio,
          target_language: state.targetLanguage,
          mode: state.inputMode,
          field_mapping:
            state.inputMode === "csv"
              ? {
                  term: state.fieldMapping.term_field,
                  reading: state.fieldMapping.reading_field,
                  meaning: state.fieldMapping.meaning_field,
                  context_native: state.fieldMapping.context_native_field,
                  context_en: state.fieldMapping.context_en_field,
                }
              : null,
        };
        ws.send(JSON.stringify(request));
      };

      ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        state.logMessage(data.text, data.type);
        if (data.url) {
          set({ downloadUrl: data.url });
        }
        set({ spinner: data.type !== "success" });
      };
    } catch (err: any) {
      state.logMessage(`Error: ${err.message}`, "error");
      state.setSubmitting(false);
    }
  },
}));

interface ProcessingModalProps {
  visible: boolean;
  messages: Message[];
  spinner: boolean;
  onClose: () => void;
  setSpinner: (flag: boolean) => void;
}

const ProcessingModal: React.FC<ProcessingModalProps> = ({
  visible,
  messages,
  spinner,
  onClose,
}) => {
  if (!visible) return null;

  const downloadUrl = useUploadStore((state) => state.downloadUrl);
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
        {downloadUrl && (
          <div className="p-4 bg-green-50 border-t border-b border-green-200">
            <div className="flex justify-between items-center">
              <span className="text-green-700 font-medium">
                Processing complete!
              </span>
              <a
                href={downloadUrl}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                target="_blank"
                rel="noopener noreferrer"
              >
                Download Results
              </a>
            </div>
          </div>
        )}
        <div
          className="p-4 h-72 overflow-y-auto text-sm"
          id="message-container"
        >
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
              <span className="mr-2 text-gray-500 text-xs">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <>
                <span dangerouslySetInnerHTML={{ __html: msg.text }} />
                {msg.type === "success" && msg.url && (
                  <a
                    href={msg.url}
                    className="ml-2 text-blue-600 hover:text-blue-800 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Download
                  </a>
                )}
              </>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-100 rounded">
        <div className="space-y-4 w-full">
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
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
            <label className="md:w-32 md:text-right text-sm font-medium">
              Separator:
            </label>
            <input
              type="text"
              value={fieldMapping.separator}
              onChange={(e) =>
                setFieldMapping({ ...fieldMapping, separator: e.target.value })
              }
              className="w-full md:w-auto border rounded p-2"
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
    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
      <label className="md:w-32 md:text-right text-sm font-medium">
        {label}:
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full md:w-auto border rounded p-2"
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

interface FormatSettingsProps {}

const FormatSettings: React.FC<FormatSettingsProps> = () => {
  const languages = useAppStore((state) => state.languages);
  const format = useUploadStore((state) => state.format);
  const targetLanguage = useUploadStore((state) => state.targetLanguage);
  const includeAudio = useUploadStore((state) => state.includeAudio);
  const setFormat = useUploadStore((state) => state.setFormat);
  const setTargetLanguage = useUploadStore((state) => state.setTargetLanguage);
  const setIncludeAudio = useUploadStore((state) => state.setIncludeAudio);

  return (
    <div className="mb-6 flex space-x-4">
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Output Format
        </label>
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as "apkg" | "pdf")}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="apkg">Anki Deck (.apkg)</option>
          <option value="pdf">PDF Document</option>
        </select>
      </div>

      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Target Language
        </label>
        <select
          value={targetLanguage}
          onChange={(e) => setTargetLanguage(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        >
          <option value="">Select Language</option>
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      {format === "apkg" && (
        <div className="flex-1 flex items-end">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={includeAudio}
              onChange={(e) => setIncludeAudio(e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">Include TTS Audio</span>
          </label>
        </div>
      )}
    </div>
  );
};

const ContentInput = () => {
  const content = useUploadStore((state) => state.content);
  const inputMode = useUploadStore((state) => state.inputMode);
  const setContent = useUploadStore((state) => state.setContent);

  return (
    <div>
      <label className="block font-medium mb-2">Paste your content:</label>
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
  );
};

const CSVAnalysisSection = () => {
  const inputMode = useUploadStore((state) => state.inputMode);
  const analyzeError = useUploadStore((state) => state.analyzeError);
  const csvPreview = useUploadStore((state) => state.csvPreview);
  const fieldMapping = useUploadStore((state) => state.fieldMapping);
  const setContent = useUploadStore((state) => state.setContent);
  const setAnalyzeError = useUploadStore((state) => state.setAnalyzeError);
  const setCsvPreview = useUploadStore((state) => state.setCsvPreview);
  const setFieldMapping = useUploadStore((state) => state.setFieldMapping);
  const content = useUploadStore((state) => state.content);

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

  if (inputMode !== "csv") return null;

  return (
    <>
      <div className="space-y-2">
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => {
              setContent(EXAMPLE_JAPANESE_WORDS);
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Load Example Words
          </button>
          <button
            type="button"
            onClick={handleAnalyze}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Analyze CSV
          </button>
        </div>
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
  );
};

const InputTypeSelector = () => {
  const inputMode = useUploadStore((state) => state.inputMode);
  const setInputMode = useUploadStore((state) => state.setInputMode);

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <label className="text-sm font-medium text-gray-700">Input Type</label>
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setInputMode("csv")}
            className={`px-3 py-1 text-sm rounded-md ${
              inputMode === "csv"
                ? "bg-indigo-100 text-indigo-700 font-medium"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            CSV/Text
          </button>
          <button
            type="button"
            onClick={() => setInputMode("srt")}
            className={`px-3 py-1 text-sm rounded-md ${
              inputMode === "srt"
                ? "bg-indigo-100 text-indigo-700 font-medium"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Subtitles (SRT)
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-2">
        {inputMode === "csv"
          ? "Paste your vocabulary list as CSV or simple text. One term per line is fine - missing translations and examples will be generated automatically."
          : "Paste the contents of an SRT subtitle file to extract and generate flashcards from the vocabulary used in the subtitles."}
      </p>
    </div>
  );
};

const FlashcardGenerator = () => {
  const isFormValid = useUploadStore((state) => state.isFormValid());
  const modalVisible = useUploadStore((state) => state.modalVisible);
  const messages = useUploadStore((state) => state.messages);
  const spinner = useUploadStore((state) => state.spinner);
  const submitting = useUploadStore((state) => state.submitting);
  const hideModal = useUploadStore((state) => state.hideModal);
  const setSpinner = useUploadStore((state) => state.setSpinner);
  const startGeneration = useUploadStore((state) => state.startGeneration);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startGeneration();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2">Vocabulary Card Builder</h1>
            <p className="text-gray-600">
              Generate flashcards from your vocabulary list using AI-powered
              translations and examples. Simply paste your vocabulary as
              CSV/text or subtitle (SRT) file content, and get beautifully
              formatted flashcards with translations, context sentences, and
              optional audio.
            </p>
          </div>
          <FormatSettings />
          <InputTypeSelector />
          <form onSubmit={handleSubmit} className="space-y-4">
            <ContentInput />
            <CSVAnalysisSection />
            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={submitting || !isFormValid}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {submitting ? "Generating..." : "Generate Flashcards"}
              </button>
            </div>
          </form>
          <ProcessingModal
            visible={modalVisible}
            messages={messages}
            spinner={spinner}
            onClose={hideModal}
            setSpinner={setSpinner}
          />
        </div>
      </div>
    </div>
  );
};

export default FlashcardGenerator;
