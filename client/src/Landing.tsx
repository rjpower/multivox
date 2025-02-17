import { Link } from "react-router-dom";
import { LockClosedIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { useAppStore } from "./store";
import { APP_NAME, CONTACT_EMAIL, GITHUB_REPO } from "./constants";

function geminiApiPrompt() {
  return (
    <div className="max-w-2xl mx-auto mb-16">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-4 mb-4">
          <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
            <LockClosedIcon className="h-6 w-6 text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Quick Setup Required
          </h2>
        </div>
        <p className="text-gray-600 mb-6">
          To get started, you'll need to configure your Gemini API key. Your API
          key is stored locally in your browser and is never stored on the
          server. It is only used to make API calls to Google's Gemini service.
        </p>
        <Link
          to="/config"
          className="inline-flex items-center px-6 py-3 text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Configure API Key
          <ArrowRightIcon className="ml-2 -mr-1 h-5 w-5" />
        </Link>
      </div>
    </div>
  );
}
const Landing = () => {
  const geminiApiKey = useAppStore((state) => state.geminiApiKey);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">{APP_NAME}</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Practice real conversation, with live hints and translation to guide
            you forward!
          </p>
        </div>

        <div className="max-w-3xl mx-auto mt-16 prose prose-gray">
          <div className="text-gray-600 leading-relaxed space-y-4">
            <p>
              Practicing language on your own is frustrating, especially when
              you're early in the journey. It can be hard to think through good
              responses to situations while you're trying to get a handle on new
              vocabulary at the same time. LLMs can be good for practice, but
              I've personally struggled with them in a bilingual context, and it
              can be frustrating to get "stuck" without knowing how to move the
              conversation forward.
            </p>
            <p>
              Google recently opened up their Live API and I thought I'd use it
              as an opportunity to improve on this. This site wires up the live
              API for conversation but also provides transcription, chunking and
              hints while you chat with the LLM. The hints provide ideas for how
              to move the conversation forward if you're stuck.
            </p>
            <p>
              I've found it's a fun way to explore conversation paths, practice
              conversation, and discover new vocabulary and terms as I go. I
              hope you like it!
            </p>
          </div>

          <div className="text-center mt-12">
            {!geminiApiKey ? (
              geminiApiPrompt()
            ) : (
              <Link
                to="/scenarios"
                className="inline-flex items-center px-6 py-3 text-lg font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                Start practicing
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
            )}
          </div>
        </div>

        <footer className="mt-16 text-center text-sm text-gray-500">
          <p className="mb-4">
            Send feedback to{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-blue-600 hover:text-blue-800"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            or via{" "}
            <a
              href={GITHUB_REPO}
              className="text-blue-600 hover:text-blue-800"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Landing;
