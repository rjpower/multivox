import { useState, useMemo, useEffect } from "react";
import type {
  TranslateRequest,
  TranslateResponse,
  DictionaryEntry,
} from "../../types";
import { useLanguages } from "../../stores/app";
import { PracticeVocabulary } from "../../components/PracticeVocabulary";
import { BookOpenIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useSearchParams, useNavigate } from "react-router-dom";

export const Translate = () => {
  const languages = useLanguages();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [inputText, setInputText] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("ja");
  const [translation, setTranslation] = useState<TranslateResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVocabVisible, setIsVocabVisible] = useState(false);

  // Extract vocabulary entries from the translation response
  const vocabularyEntries = useMemo(() => {
    if (!translation || !translation.dictionary) return [];

    return Object.entries(translation.dictionary).map(([, entry]) => ({
      ...entry,
      context_source: translation.source_text,
      context_translated: translation.translated_text,
    }));
  }, [translation]);

  // Load from query params on initial render
  useEffect(() => {
    const text = searchParams.get("text");
    const source = searchParams.get("source");
    const target = searchParams.get("target");

    if (text) {
      setInputText(text);
      
      if (source && languages.some(lang => lang.code === source)) {
        setSourceLanguage(source);
      }
      
      if (target && languages.some(lang => lang.code === target)) {
        setTargetLanguage(target);
      }
      
      // Auto-translate if we have text in the query params
      handleTranslate(text, source || sourceLanguage, target || targetLanguage);
    }
  }, []);

  // Update query params when translation changes
  useEffect(() => {
    if (translation) {
      setSearchParams({
        text: translation.source_text,
        source: sourceLanguage,
        target: targetLanguage
      });
    }
  }, [translation]);

  const handleTranslate = async (
    text = inputText,
    source = sourceLanguage,
    target = targetLanguage
  ) => {
    if (!text.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const request: TranslateRequest = {
        text: text,
        source_language: source,
        target_language: target,
        need_chunks: true,
        need_dictionary: true,
      };

      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TranslateResponse = await response.json();
      setTranslation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    // Clear the URL params if the input is cleared
    if (!e.target.value.trim()) {
      navigate("/translate", { replace: true });
    }
  };

  const handleSourceLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSourceLanguage(e.target.value);
    if (translation) {
      // Update URL with new source language
      setSearchParams({
        text: inputText,
        source: e.target.value,
        target: targetLanguage
      });
    }
  };

  const handleTargetLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTargetLanguage(e.target.value);
    if (translation) {
      // Update URL with new target language
      setSearchParams({
        text: inputText,
        source: sourceLanguage,
        target: e.target.value
      });
    }
  };

  return (
    <div className="min-h-screen bg-base-100 p-8">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-4 relative">
        <div className="flex-1 space-y-8">
          <div>
            <h1 className="text-3xl font-bold mb-4">
              Test Translation to/from a language
            </h1>
            <p className="text-base-content/70">
              Try out translations between any supported language pair, with
              vocabulary analysis.
            </p>
          </div>

          <div className="bg-base-100 rounded-lg shadow-lg p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="label">
                  <span className="label-text">Source Language</span>
                </label>
                <select
                  value={sourceLanguage}
                  onChange={handleSourceLanguageChange}
                  className="select select-bordered w-full"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="label">
                  <span className="label-text">Target Language</span>
                </label>
                <select
                  value={targetLanguage}
                  onChange={handleTargetLanguageChange}
                  className="select select-bordered w-full"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="label">
                <span className="label-text">Text to Translate</span>
              </label>
              <textarea
                value={inputText}
                onChange={handleInputChange}
                rows={4}
                className="textarea textarea-bordered w-full"
                placeholder="Enter text to translate..."
              />
            </div>

            <button
              onClick={() => handleTranslate()}
              disabled={isLoading || !inputText.trim()}
              className="btn btn-primary w-full"
            >
              {isLoading ? "Translating..." : "Translate"}
            </button>

            {error && <div className="alert alert-error">{error}</div>}

            {translation && (
              <div className="bg-base-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4">Translation</h3>
                <TranslationDisplay
                  chunked={translation.chunked || [translation.translated_text]}
                  dictionary={translation.dictionary || {}}
                  originalText={translation.source_text}
                  translatedText={translation.translated_text}
                />
              </div>
            )}
          </div>
        </div>

        {/* Vocabulary Panel - Mobile Toggle Button */}
        {vocabularyEntries.length > 0 && (
          <div className="absolute top-4 right-4 lg:hidden">
            <button
              onClick={() => setIsVocabVisible(!isVocabVisible)}
              className="btn btn-circle btn-ghost"
            >
              <BookOpenIcon className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Vocabulary Panel */}
        {vocabularyEntries.length > 0 && (
          <div
            className={`
              fixed lg:relative top-0 right-0 h-full 
              w-80 bg-base-100 lg:bg-transparent
              transform transition-transform duration-300 ease-in-out
              ${
                isVocabVisible
                  ? "translate-x-0"
                  : "translate-x-full lg:translate-x-0"
              }
              lg:w-80 lg:shrink-0 
              z-50 lg:z-auto
            `}
          >
            <div className="lg:hidden navbar bg-base-100">
              <h3 className="navbar-start font-medium">Vocabulary</h3>
              <button
                onClick={() => setIsVocabVisible(false)}
                className="btn btn-circle btn-ghost btn-sm"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <PracticeVocabulary vocabulary={vocabularyEntries} />
          </div>
        )}
      </div>
    </div>
  );
};

// TranslationDisplay component (will be refactored later)
interface TranslationDisplayProps {
  chunked: string[];
  dictionary: Record<string, DictionaryEntry>;
  originalText: string;
  translatedText: string;
  showTranslation?: boolean;
}

export const TranslationDisplay = ({
  chunked,
  dictionary,
  translatedText,
  showTranslation = true,
}: TranslationDisplayProps) => {
  const [showTranslatedText, setShowTranslatedText] = useState(showTranslation);

  return (
    <div className="space-y-3">
      <div className="text-sm leading-relaxed flex flex-wrap gap-2">
        {chunked.map((term: string, idx: number) => (
          <TranscriptionChunk key={idx} term={term} dictionary={dictionary} />
        ))}
      </div>
      {translatedText && (
        <button
          onClick={() => setShowTranslatedText(!showTranslatedText)}
          className="btn btn-xs btn-ghost"
        >
          {showTranslatedText ? "Hide" : "Show"} Translation
        </button>
      )}
      {showTranslatedText && translatedText && (
        <div className="text-sm opacity-70 italic">{translatedText}</div>
      )}
    </div>
  );
};

const TranscriptionChunk = ({
  term,
  dictionary,
}: {
  term: string;
  dictionary: Record<string, DictionaryEntry>;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const match = dictionary[term];

  if (!match) {
    return <span className="badge badge-lg badge-neutral">{term}</span>;
  }

  const translation = dictionary[term].source_text;

  return (
    <span
      className={`
        badge badge-lg
        cursor-pointer 
        relative
        transition-all duration-200
      `}
      onClick={() => setIsOpen(!isOpen)}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {term}
      {isOpen && (
        <div
          className="
          absolute left-1/2 transform -translate-x-1/2 z-10
          top-full mt-2
          px-3 py-2 rounded-lg shadow-lg
          bg-base-100 border border-base-300
          text-sm text-base-content
          min-w-[150px]
          whitespace-normal
        "
        >
          <div className="font-medium mb-1">{translation}</div>
        </div>
      )}
    </span>
  );
};
