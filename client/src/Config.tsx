import { useState } from "react";
import { useAppStore } from "./store";
import { Link, useLocation } from "react-router-dom";
import { ApiKeyStatus } from "./store";
import { LanguageSelector } from "./LanguageSelector";

export const Config = () => {
  const location = useLocation();
  const message = location.state?.message;
  const [apiKey, setApiKey] = useState(
    useAppStore((state) => state.geminiApiKey) || ""
  );
  const setGeminiApiKey = useAppStore((state) => state.setGeminiApiKey);
  const apiKeyStatus = useAppStore((state) => state.apiKeyStatus);
  const apiKeyError = useAppStore((state) => state.apiKeyError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await setGeminiApiKey(apiKey);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {message && (
        <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700">
          {message}
        </div>
      )}
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Configuration</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gemini API Key
            </label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Enter your Gemini API key"
            />
          </div>

          <div className="text-sm text-gray-600 mb-6">
            <p className="mb-2">
              A Gemini API key is required to use this application as the rate
              limits for the live Gemini API are low while it is in preview. You
              can get a <i>free</i> API key on the{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800"
              >
                Google AI Studio
              </a>{" "}
              page. Your API key is stored locally in your browser and is never
              stored on the server. It is only used to make API calls to
              Google's Gemini service.
            </p>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Save Configuration
            </button>
            {apiKeyStatus === ApiKeyStatus.CHECKING && (
              <div className="text-blue-600">Validating API key...</div>
            )}
            {apiKeyStatus === ApiKeyStatus.VALID && (
              <div className="text-green-600">
                API key validated successfully!
              </div>
            )}
            {apiKeyStatus === ApiKeyStatus.INVALID && (
              <div className="text-red-600">
                Server response: {apiKeyError || "Invalid API key"}
              </div>
            )}
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Practice Language</h2>
          <div className="mb-8">
            <LanguageSelector 
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Select the language you want to practice with
            </p>
          </div>
        </div>

        </div>

        <div className={`bg-white rounded-lg shadow-md p-6 ${
          useAppStore((state) => state.isReady)
            ? "border-green-200"
            : "border-gray-200"
        } border-2`}>
          <div className="flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center space-x-4 mb-4">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  useAppStore((state) => state.isReady)
                    ? "bg-green-100"
                    : "bg-gray-100"
                }`}>
                  <svg
                    className={`h-6 w-6 ${
                      useAppStore((state) => state.isReady)
                        ? "text-green-600"
                        : "text-gray-400"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {useAppStore((state) => state.isReady)
                      ? "You're all set!"
                      : "Configuration needed"}
                  </h2>
                  <p className="text-gray-600">
                    {apiKeyStatus === ApiKeyStatus.VALID && useAppStore((state) => state.selectedLanguage)
                      ? "Your API key is configured and ready to use"
                      : "Please configure your API key and select a language"}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center">
                  <svg
                    className={`h-5 w-5 mr-2 ${
                      apiKeyStatus === ApiKeyStatus.VALID ? "text-green-500" : "text-gray-400"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={apiKeyStatus === ApiKeyStatus.VALID ? "M5 13l4 4L19 7" : "M12 6v6m0 0v6m0-6h6m-6 0H6"}
                    />
                  </svg>
                  API Key: {apiKeyStatus === ApiKeyStatus.VALID ? "Configured" : "Required"}
                </div>
                <div className="flex items-center">
                  <svg
                    className={`h-5 w-5 mr-2 ${
                      useAppStore((state) => state.selectedLanguage) ? "text-green-500" : "text-gray-400"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d={useAppStore((state) => state.selectedLanguage) ? "M5 13l4 4L19 7" : "M12 6v6m0 0v6m0-6h6m-6 0H6"}
                    />
                  </svg>
                  Language: {useAppStore((state) => state.selectedLanguage) ? "Selected" : "Required"}
                </div>
              </div>
            </div>

            {apiKeyStatus === ApiKeyStatus.VALID && useAppStore((state) => state.selectedLanguage) && (
              <Link
                to="/scenarios"
                className="mt-6 w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                Start practicing
                <svg
                  className="ml-2 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Reset Options</h2>
        <div className="space-y-4">
          <div>
            <button
              type="button"
              onClick={() => useAppStore.getState().vocabulary.clear()}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Reset Vocabulary
            </button>
            <p className="mt-1 text-sm text-gray-500">
              Clears your saved vocabulary list
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => useAppStore.getState().reset()}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Reset All State
            </button>
            <p className="mt-1 text-sm text-gray-500">
              Resets all application state including API key and vocabulary
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
