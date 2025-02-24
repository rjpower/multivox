import { useState } from "react";
import type { TranslateRequest, TranslateResponse } from "../../types";
import { useAppStore } from "../../stores/app";

export const Translate = () => {
  const [inputText, setInputText] = useState("");
  const languages = useAppStore((state) => state.languages);
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("ja");
  const [translation, setTranslation] = useState<TranslateResponse | null>(
    null
  );
  const [reverseTranslation, setReverseTranslation] =
    useState<TranslateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTranslate = async () => {
    if (!inputText.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const request: TranslateRequest = {
        text: inputText,
        source_language: sourceLanguage,
        target_language: targetLanguage,
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

      const reverseRequest: TranslateRequest = {
        text: data.translated_text,
        source_language: targetLanguage,
        target_language: sourceLanguage,
        need_chunks: true,
        need_dictionary: true,
      };

      const reverseResponse = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reverseRequest),
      });

      if (!reverseResponse.ok) {
        throw new Error(`HTTP error! status: ${reverseResponse.status}`);
      }

      const reverseData: TranslateResponse = await reverseResponse.json();
      setReverseTranslation(reverseData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-4">
            Test Translation to/from a language
          </h1>
          <p className="text-base-content/70">
            Try out translations between any supported language pair, with
            back-translation to verify accuracy.
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
                onChange={(e) => setSourceLanguage(e.target.value)}
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
                onChange={(e) => setTargetLanguage(e.target.value)}
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
              onChange={(e) => setInputText(e.target.value)}
              rows={4}
              className="textarea textarea-bordered w-full"
              placeholder="Enter text to translate..."
            />
          </div>

          <button
            onClick={handleTranslate}
            disabled={isLoading || !inputText.trim()}
            className="btn btn-primary w-full"
          >
            {isLoading ? "Translating..." : "Translate"}
          </button>

          {error && <div className="alert alert-error">{error}</div>}

          {translation && (
            <div className="space-y-6">
              <div className="bg-base-200 rounded-lg p-6 space-y-4">
                <h3 className="text-xl font-semibold">Translation</h3>
                <p className="whitespace-pre-wrap">
                  {translation.translated_text.replace(/\n/g, "\n")}
                </p>
              </div>

              {reverseTranslation && (
                <div className="bg-base-200 rounded-lg p-6 space-y-4">
                  <h3 className="text-xl font-semibold">
                    Back to {sourceLanguage}
                  </h3>
                  <p className="whitespace-pre-wrap">
                    {reverseTranslation.translated_text.replace(/\n/g, "\n")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
