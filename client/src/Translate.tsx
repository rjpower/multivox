import { useState } from "react";
import type { TranslateRequest, TranslateResponse } from "./types";
import { useAppStore } from "./store";

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
    <div>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Translation Test
        </h1>

        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Source Language
              </label>
              <select
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Target Language
              </label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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
            <label className="block text-sm font-medium text-gray-700">
              Text to Translate
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={4}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Enter text to translate..."
            />
          </div>

          <button
            onClick={handleTranslate}
            disabled={isLoading || !inputText.trim()}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? "Translating..." : "Translate"}
          </button>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-md">{error}</div>
          )}

          {translation && (
            <div className="space-y-4 p-6 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <h3 className="font-medium text-gray-900">Translation</h3>
                <p className="mt-2 text-gray-600 whitespace-pre-wrap">
                  {translation.translated_text.replace(/\n/g, "\n")}
                </p>
              </div>

              {reverseTranslation && (
                <div>
                  <h3 className="font-medium text-gray-900">
                    Back to {sourceLanguage}
                  </h3>
                  <p className="mt-2 text-gray-600 whitespace-pre-wrap">
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
