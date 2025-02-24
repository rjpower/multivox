import { XMarkIcon } from "@heroicons/react/24/outline";
import { useAtom, useAtomValue } from "jotai";
import React, { useState } from "react";
import { nativeLanguageAtom, practiceLanguageAtom } from "../../stores/app";
import {
  analyzeErrorAtom,
  contentAtom,
  csvPreviewAtom,
  EXAMPLE_WORDS,
  fieldMappingAtom,
  formatAtom,
  includeAudioAtom,
  inputModeAtom,
  submittingAtom,
  useCSVAnalysis,
  useFormValid,
  useGeneration,
} from "./store";

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
  messages: Message[];
  spinner: boolean;
  downloadUrl?: string;
  onClose: () => void;
}

export const ProcessingModal: React.FC<ProcessingModalProps> = ({
  messages,
  spinner,
  onClose,
  downloadUrl,
}) => {
  return (
    <>
      <div className="modal modal-open">
        <div className="modal-box max-w-lg">
          <div className="flex items-center justify-between">
            <span>Processing your request...</span>
            <div className="flex items-center space-x-2">
              {spinner && <span className="loading loading-spinner"></span>}
              <button
                onClick={onClose}
                className="btn btn-ghost btn-circle btn-sm"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          {downloadUrl && (
            <div className="alert alert-success">
              <div className="flex justify-between items-center w-full">
                <span className="font-medium">Processing complete!</span>
                <a
                  href={downloadUrl}
                  className="btn btn-success"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download Results
                </a>
              </div>
            </div>
          )}
          <div className="h-72 overflow-y-auto text-sm flex flex-col-reverse p-4">
            <div className="flex flex-col">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`mb-1 ${
                    msg.type === "error"
                      ? "text-error"
                      : msg.type === "success"
                      ? "text-success"
                      : "text-base-content"
                  }`}
                >
                  <span className="mr-2 text-base-content text-xs">
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
    <div className="card bg-base-200">
      <div className="card-body">
        <h3 className="card-title">CSV Preview</h3>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                {headers.map((h: string, idx: number) => {
                  const mappedTo = getMappingLabel(h);
                  return (
                    <th key={idx}>
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
            <tbody className="bg-base-100 divide-y divide-gray-200">
              {previewRows.map((row: Record<string, string>, idx: number) => (
                <tr
                  key={idx}
                  className={idx % 2 === 0 ? "bg-base-100" : "bg-base-200"}
                >
                  {headers.map((h: string, i: number) => (
                    <td
                      key={i}
                      className="px-6 py-4 whitespace-nowrap text-sm text-base-content"
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
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex items-center justify-between">
          <h3 className="card-title">Suggested Mapping</h3>
          <span
            className={`badge ${
              suggestions.confidence === "high"
                ? "badge-success"
                : suggestions.confidence === "medium"
                ? "badge-warning"
                : "badge-error"
            }`}
          >
            {suggestions.confidence} confidence
          </span>
        </div>
      </div>
      <div className="p-6">
        <p className="text-sm text-base-content mb-4">
          {suggestions.reasoning}
        </p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-base-100 rounded-lg border border-base-300">
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
  const [format, setFormat] = useAtom(formatAtom);
  const [includeAudio, setIncludeAudio] = useAtom(includeAudioAtom);

  return (
    <div className="form-control gap-2">
      <label className="label">
        <span className="label-text">Output Format</span>
      </label>
      <select
        value={format}
        onChange={(e) => setFormat(e.target.value as "apkg" | "pdf")}
        className="select select-bordered w-full"
      >
        <option value="apkg">Anki Deck (.apkg)</option>
        <option value="pdf">PDF Document</option>
      </select>

      {format === "apkg" && (
        <div className="form-control">
          <label className="label cursor-pointer justify-start gap-2">
            <input
              type="checkbox"
              checked={includeAudio}
              onChange={(e) => setIncludeAudio(e.target.checked)}
              className="checkbox checkbox-primary"
            />
            <span className="label-text">Include TTS Audio</span>
          </label>
        </div>
      )}
    </div>
  );
};

const ContentInput = () => {
  const [content, setContent] = useAtom(contentAtom);
  const inputMode = useAtomValue(inputModeAtom);

  return (
    <div className="form-control">
      <label className="label">
        <span className="label-text">Paste your content:</span>
      </label>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          inputMode === "csv"
            ? "Paste CSV content here..."
            : "Paste SRT content here..."
        }
        className="textarea textarea-bordered w-full min-h-[10em]"
      ></textarea>
    </div>
  );
};

const CSVAnalysisSection = () => {
  const practiceLanguage = useAtomValue(practiceLanguageAtom);
  const nativeLanguage = useAtomValue(nativeLanguageAtom);
  const inputMode = useAtomValue(inputModeAtom);
  const analyzeError = useAtomValue(analyzeErrorAtom);
  const csvPreview = useAtomValue(csvPreviewAtom);
  const [fieldMapping, setFieldMapping] = useAtom(fieldMappingAtom);
  const { analyze, setContent } = useCSVAnalysis();

  const handleAnalyze = () => analyze(practiceLanguage!, nativeLanguage!);

  if (inputMode !== "csv") return null;

  return (
    <>
      <div className="space-y-2">
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => {
              setContent(EXAMPLE_WORDS);
            }}
            className="btn btn-neutral btn-sm"
          >
            Load Example Words
          </button>
          <button
            type="button"
            onClick={handleAnalyze}
            className="btn btn-primary btn-sm"
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
  const [inputMode, setInputMode] = useAtom(inputModeAtom);

  return (
    <div className="form-control gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <label className="label sm:w-32 p-0">
          <span className="label-text">Input Type</span>
        </label>
        <div className="join">
          <button
            type="button"
            onClick={() => setInputMode("csv")}
            className={`btn btn-sm join-item ${
              inputMode === "csv" ? "btn-primary" : ""
            }`}
          >
            CSV/Text
          </button>
          <button
            type="button"
            onClick={() => setInputMode("srt")}
            className={`btn btn-sm join-item ${
              inputMode === "srt" ? "btn-primary" : ""
            }`}
          >
            Subtitles (SRT)
          </button>
        </div>
      </div>
      <p className="text-sm opacity-70 mt-2">
        {inputMode === "csv"
          ? "Paste your vocabulary list as CSV or simple text. One term per line is fine - missing translations and examples will be generated automatically."
          : "Paste the contents of an SRT subtitle file to extract and generate flashcards from the vocabulary used in the subtitles."}
      </p>
    </div>
  );
};

const FlashcardGenerator = () => {
  const isFormValid = useFormValid();
  const [modalVisible, setModalVisible] = useState(false);
  const submitting = useAtomValue(submittingAtom);
  const { startGeneration, resetGeneration, downloadUrl, messages, spinner } =
    useGeneration();

  const nativeLanguage = useAtomValue(nativeLanguageAtom)!;
  const practiceLanguage = useAtomValue(practiceLanguageAtom)!;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startGeneration(practiceLanguage, nativeLanguage);
    setModalVisible(true);
  };

  const handleClose = () => {
    setModalVisible(false);
    resetGeneration();
  };

  return (
    <div className="space-y-8">
      <p className="text-base-content/70 mb-8">
        Generate flashcards from your vocabulary list using AI-powered
        translations and examples. Simply paste your vocabulary as CSV/text or
        subtitle (SRT) file content, and get beautifully formatted flashcards
        with translations, context sentences, and optional audio.
      </p>
      <div className="bg-base-100 rounded-lg shadow-lg p-6">
        <div className="flex flex-col sm:flex-row gap-8 mb-6">
          <FormatSettings />
          <InputTypeSelector />
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <ContentInput />
          <CSVAnalysisSection />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !isFormValid}
              className="btn btn-primary"
            >
              {submitting ? "Generating..." : "Generate Flashcards"}
            </button>
          </div>
          {modalVisible && (
            <ProcessingModal
              spinner={spinner}
              messages={messages}
              downloadUrl={downloadUrl ? downloadUrl : undefined}
              onClose={handleClose}
            />
          )}
        </form>
      </div>
    </div>
  );
};

export default FlashcardGenerator;
