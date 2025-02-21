import { XMarkIcon } from "@heroicons/react/24/outline";
import { useAppStore } from "./store";
import { useFlashcardStore } from "./stores/flashcards";
import React from "react";

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
  source_language: string;
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
  const downloadUrl = useFlashcardStore((state) => state.downloadUrl);

  if (!visible) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black opacity-60 z-40"
        onClick={onClose}
      ></div>
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded shadow-lg z-50">
        <div className="flex items-center justify-between p-4 bg-gray-100 border-b">
          <span>Processing your request...</span>
          <div className="flex items-center space-x-2">
            {spinner && (
              <div className="w-6 h-6 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            )}
            <button
              onClick={onClose}
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
        <div className="p-4 h-72 overflow-y-auto text-sm flex flex-col-reverse">
          <div className="flex flex-col">
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
  const format = useFlashcardStore((state) => state.format);
  const includeAudio = useFlashcardStore((state) => state.includeAudio);
  const setFormat = useFlashcardStore((state) => state.setFormat);
  const setIncludeAudio = useFlashcardStore((state) => state.setIncludeAudio);

  return (
    <div className="mb-6 space-y-4">
      <div>
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
  const content = useFlashcardStore((state) => state.content);
  const inputMode = useFlashcardStore((state) => state.inputMode);
  const setContent = useFlashcardStore((state) => state.setContent);

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
  const practiceLanguage = useAppStore((state) => state.practiceLanguage);
  const nativeLanguage = useAppStore((state) => state.nativeLanguage);
  const inputMode = useFlashcardStore((state) => state.inputMode);
  const analyzeError = useFlashcardStore((state) => state.analyzeError);
  const csvPreview = useFlashcardStore((state) => state.csvPreview);
  const fieldMapping = useFlashcardStore((state) => state.fieldMapping);
  const setContent = useFlashcardStore((state) => state.setContent);
  const setAnalyzeError = useFlashcardStore((state) => state.setAnalyzeError);
  const setCsvPreview = useFlashcardStore((state) => state.setCsvPreview);
  const setFieldMapping = useFlashcardStore((state) => state.setFieldMapping);
  const content = useFlashcardStore((state) => state.content);

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
        body: JSON.stringify({ 
          content,
          source_language: practiceLanguage,
          target_language: nativeLanguage
        }),
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
  const inputMode = useFlashcardStore((state) => state.inputMode);
  const setInputMode = useFlashcardStore((state) => state.setInputMode);

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
  const isFormValid = useFlashcardStore((state) => state.isFormValid());
  const modalVisible = useFlashcardStore((state) => state.modalVisible);
  const messages = useFlashcardStore((state) => state.messages);
  const spinner = useFlashcardStore((state) => state.spinner);
  const submitting = useFlashcardStore((state) => state.submitting);
  const hideModal = useFlashcardStore((state) => state.hideModal);
  const setSpinner = useFlashcardStore((state) => state.setSpinner);
  const startGeneration = useFlashcardStore((state) => state.startGeneration);

  const practiceLanguage = useAppStore((state) => state.practiceLanguage);
  const nativeLanguage = useAppStore((state) => state.nativeLanguage);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startGeneration(practiceLanguage, nativeLanguage);
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
