import { useState } from "react";
import type { TranslateRequest, TranslateResponse } from "./types";
import { useAppStore } from "./store";

export const Translate = () => {
  const [inputText, setInputText] = useState("");
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
        target_language: targetLanguage,
      };

      const apiKey = useAppStore.getState().geminiApiKey;
      if (!apiKey) {
        throw new Error("Gemini API key is required");
      }

      const response = await fetch(
        `/api/translate?api_key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TranslateResponse = await response.json();
      setTranslation(data);

      // Now translate back to English
      const reverseRequest: TranslateRequest = {
        text: data.translation,
        target_language: "en",
      };

      const reverseResponse = await fetch(
        `/api/translate?api_key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reverseRequest),
        }
      );

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
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Target Language
            </label>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="ja">Japanese</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
            </select>
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
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <h3 className="font-medium text-gray-900">Translation</h3>
                <p className="mt-2 text-gray-600 whitespace-pre-wrap">
                  {translation.translation.replace(/\n/g, "\n")}
                </p>
              </div>

              {reverseTranslation && (
                <div>
                  <h3 className="font-medium text-gray-900">Back to English</h3>
                  <p className="mt-2 text-gray-600 whitespace-pre-wrap">
                    {reverseTranslation.translation.replace(/\n/g, "\n")}
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
