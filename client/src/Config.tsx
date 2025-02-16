import { useState, useEffect } from "react";
import { useAppStore } from "./store";
import { Link, useLocation } from "react-router-dom";
import { ApiKeyStatus } from "./stores/app";
import { CheckIcon, PlusIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

const StatusIcon = ({ isComplete }: { isComplete: boolean }) => 
  isComplete ? (
    <CheckIcon className="h-5 w-5 mr-2 text-green-500" />
  ) : (
    <PlusIcon className="h-5 w-5 mr-2 text-gray-400" />
  );

const ApiKeyInput = () => {
  const geminiApiKey = useAppStore((state) => state.geminiApiKey);
  const setGeminiApiKey = useAppStore((state) => state.setGeminiApiKey);
  const apiKeyStatus = useAppStore((state) => state.apiKeyStatus);
  const apiKeyError = useAppStore((state) => state.apiKeyError);
  const [apiKey, setApiKey] = useState(geminiApiKey || "");

  useEffect(() => {
    if (geminiApiKey) {
      setApiKey(geminiApiKey);
    }
  }, [geminiApiKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await setGeminiApiKey(apiKey);
  };

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <div className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-2">
          Gemini API Key
        </div>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onBlur={handleSubmit}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="Enter your Gemini API key"
        />
      </div>

      <div className="text-sm text-gray-600 mb-6">
        <p className="mb-2">
          A Gemini API key is required to use this application as the rate
          limits for the live Gemini API are low while it is in preview.
          You can get a <i>free</i> API key on the{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-800"
          >
            Google AI Studio
          </a>{" "}
          page. Your API key is stored locally in your browser and is
          never stored on the server. It is only used to make API calls to
          Google's Gemini service.
        </p>
      </div>

      <div className="mb-4">
        {apiKeyStatus === ApiKeyStatus.CHECKING && (
          <div className="text-sm text-blue-600">
            Validating API key...
          </div>
        )}
        {apiKeyStatus === ApiKeyStatus.VALID && (
          <div className="text-sm text-green-600">
            API key validated successfully!
          </div>
        )}
        {apiKeyStatus === ApiKeyStatus.INVALID && (
          <div className="text-sm text-red-600">
            Server response: {apiKeyError || "Invalid API key"}
          </div>
        )}
      </div>
    </div>
  );
};

const ConfigurationStatus = () => {
  const isReady = useAppStore((state) => state.isReady);
  const selectedLanguage = useAppStore((state) => state.selectedLanguage);
  const apiKeyStatus = useAppStore((state) => state.apiKeyStatus);

  return (
    <div
      className={`bg-white rounded-lg shadow-md p-6 ${
        isReady ? "border-green-200" : "border-gray-200"
      } border-2`}
    >
      <div className="flex flex-col h-full justify-between">
        <div>
          <div className="flex items-center space-x-4 mb-4">
            <div
              className={`h-12 w-12 rounded-full flex items-center justify-center ${
                isReady ? "bg-green-100" : "bg-gray-100"
              }`}
            >
              <StatusIcon isComplete={isReady} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {isReady ? "You're all set!" : "Configuration needed"}
              </h2>
              <p className="text-gray-600">
                {apiKeyStatus === ApiKeyStatus.VALID && selectedLanguage
                  ? "You are ready to practice!"
                  : "Please configure your API key and select a language"}
              </p>
            </div>
          </div>

          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center">
              <StatusIcon isComplete={!!selectedLanguage} />
              Language: {selectedLanguage ? "Selected" : "Required"}
            </div>
            <div className="flex items-center">
              <StatusIcon isComplete={apiKeyStatus === ApiKeyStatus.VALID} />
              API Key:{" "}
              {apiKeyStatus === ApiKeyStatus.VALID ? "Configured" : "Required"}
            </div>
          </div>
        </div>

        {apiKeyStatus === ApiKeyStatus.VALID && selectedLanguage && (
          <Link
            to="/scenarios"
            className="mt-6 w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Start practicing
            <ArrowRightIcon className="ml-2 h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
};

const ResetOptions = () => (
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
);

const LanguageSelector = ({ className = "" }: { className?: string }) => {
  const languages = useAppStore((state) => state.languages);
  const selectedLanguage = useAppStore((state) => state.selectedLanguage);
  const setSelectedLanguage = useAppStore((state) => state.setSelectedLanguage);

  return (
    <select
      value={selectedLanguage}
      onChange={(e) => setSelectedLanguage(e.target.value)}
      className={className}
    >
      <option value="" disabled>
        Select a language
      </option>
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.name}
        </option>
      ))}
    </select>
  );
};

const LoadingSpinner = () => (
  <div className="flex justify-center items-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

export const Config = () => {
  const location = useLocation();
  const message = location.state?.message;
  const isLoading = useAppStore((state) => state.appLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {message && (
          <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700">
            {message}
          </div>
        )}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Configuration</h1>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-[60%] bg-white rounded-lg shadow-md p-6">
            <form onSubmit={(e) => e.preventDefault()}>
              <h2 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-2">
                Practice Language
              </h2>
              <div className="mb-8">
                <LanguageSelector className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                <p className="mt-1 text-sm text-gray-500">
                  Select the language you want to practice with
                </p>
              </div>
              <ApiKeyInput />
            </form>
          </div>
          <div className="lg:w-96">
            <ConfigurationStatus />
          </div>
        </div>
        <ResetOptions />
      </div>
    </div>
  );
};
