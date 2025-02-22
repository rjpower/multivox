import { Link } from "react-router-dom";
import { LockClosedIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { useAppStore } from "./store";
import { APP_NAME, CONTACT_EMAIL, GITHUB_REPO } from "./constants";

function configPrompt() {
  return (
    <div className="max-w-2xl mx-auto mb-16">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex items-center gap-4">
            <div className="avatar placeholder">
              <div className="bg-primary text-primary-content rounded-full w-12">
                <LockClosedIcon className="h-6 w-6" />
              </div>
            </div>
            <h2 className="card-title text-2xl">
              Quick Setup Required
            </h2>
          </div>
          <p className="py-4">
            To get started, you'll need to specify your preferred native language
            and practice language.
          </p>
          <div className="card-actions">
            <Link
              to="/config"
              className="btn btn-primary"
            >
              Configure Language Settings
              <ArrowRightIcon className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
const Landing = () => {
  const isReady = useAppStore((state) => state.isReady);
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-base-200">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-6">{APP_NAME}</h1>
          <p className="text-xl opacity-70 max-w-2xl mx-auto leading-relaxed">
            Practice real conversation, with live hints and translation to guide
            you forward!
          </p>
        </div>

        <div className="max-w-3xl mx-auto mt-16 prose">
          <div className="leading-relaxed space-y-4 opacity-70">
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
            {!isReady ? (
              configPrompt()
            ) : (
              <Link
                to="/scenarios"
                className="btn btn-primary btn-lg"
              >
                Start practicing
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
            )}
          </div>
        </div>

        <footer className="mt-16 text-center text-sm opacity-50">
          <p className="mb-4">
            Send feedback to{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="link link-primary"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            or via{" "}
            <a
              href={GITHUB_REPO}
              className="link link-primary"
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
