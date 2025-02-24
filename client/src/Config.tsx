import { useAtom, useAtomValue } from "jotai";
import {
  languagesAtom,
  nativeLanguageAtom,
  practiceLanguageAtom,
  useReadyForPractice,
  useAppLoading,
  reset,
  useVocabulary,
} from "./stores/app";
import { Link, useLocation } from "react-router-dom";
import { XMarkIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

const LanguageSelector = ({
  className = "",
  value,
  onChange,
}: {
  className?: string;
  value: string;
  onChange: (value: string) => void;
}) => {
  const languages = useAtomValue(languagesAtom);
  console.log("Language: ", value);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`select select-bordered ${className}`}
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
    <span className="loading loading-spinner loading-lg "></span>
  </div>
);

export const Config = () => {
  const location = useLocation();
  const isReady = useReadyForPractice();
  const message = location.state?.message;
  const isLoading = useAppLoading();
  const [nativeLanguage, setNativeLanguage] = useAtom(nativeLanguageAtom);
  const [practiceLanguage, setPracticeLanguage] = useAtom(practiceLanguageAtom);
  const { clear } = useVocabulary();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <>
      {message && <div className="alert alert-warning mb-4">{message}</div>}

      {!isReady && (
        <div className="alert alert-warning mb-6">
          <XMarkIcon className="h-5 w-5" />
          <span>Please select both languages to continue</span>
        </div>
      )}

      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title mb-6">Language Settings</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Native Language</span>
              </label>
              <LanguageSelector
                value={nativeLanguage || ""}
                onChange={setNativeLanguage}
                className="w-full"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">
                  Practice Language
                </span>
              </label>
              <LanguageSelector
                value={practiceLanguage || ""}
                onChange={setPracticeLanguage}
                className="w-full"
              />
            </div>
          </div>

          <div className="divider"></div>

          <div className="flex flex-col gap-4">
            <h3 className="text-error font-semibold">Reset Options</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={clear}
                className="btn btn-error btn-outline gap-2"
              >
                <XMarkIcon className="h-5 w-5" />
                Reset Vocabulary
              </button>
              <button
                type="button"
                onClick={reset}
                className="btn btn-error btn-outline gap-2"
              >
                <XMarkIcon className="h-5 w-5" />
                Reset All Settings
              </button>
            </div>
          </div>

          {isReady && (
            <>
              <div className="divider"></div>
              <Link to="/scenarios" className="btn btn-primary gap-2">
                Start practicing
                <ArrowRightIcon className="h-5 w-5" />
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
};
