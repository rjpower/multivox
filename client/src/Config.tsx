import { useAppStore } from "./stores/app";
import { Link, useLocation } from "react-router-dom";
import {
  CheckIcon,
  XMarkIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

const StatusBadge = ({
  isComplete,
  label,
}: {
  isComplete: boolean;
  label: string;
}) => (
  <div
    className={`badge gap-2 ${isComplete ? "badge-success" : "badge-error"}`}
  >
    {isComplete ? (
      <CheckIcon className="h-4 w-4" />
    ) : (
      <XMarkIcon className="h-4 w-4" />
    )}
    {label}
  </div>
);

const ConfigurationStatus = () => {
  const isReady = useAppStore((state) => state.isReady());
  const nativeLanguage = useAppStore((state) => state.nativeLanguage);
  const practiceLanguage = useAppStore((state) => state.practiceLanguage);

  return (
    <>
      <div className="stats shadow">
        <div className="stat">
          <div className="stat-figure ">
            {isReady ? (
              <div className="avatar">
                <div className="w-16 rounded-full">
                  <CheckIcon className="h-8 w-8 m-4 " />
                </div>
              </div>
            ) : (
              <div className="avatar placeholder">
                <div className="w-16 rounded-full bg-neutral-focus text-neutral-content">
                  <XMarkIcon className="h-8 w-8 m-4" />
                </div>
              </div>
            )}
          </div>
          <div className="stat-title">Status</div>
          <div className="stat-value ">{isReady ? "Ready!" : "Setup"}</div>
          <div className="stat-desc">
            {isReady
              ? "You can start practicing"
              : "Complete configuration below"}
          </div>
        </div>
      </div>

      <div className="divider">Configuration Status</div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span>Native Language</span>
          <StatusBadge
            isComplete={!!nativeLanguage}
            label={nativeLanguage ? "Selected" : "Required"}
          />
        </div>
        <div className="flex items-center justify-between">
          <span>Practice Language</span>
          <StatusBadge
            isComplete={!!practiceLanguage}
            label={practiceLanguage ? "Selected" : "Required"}
          />
        </div>
      </div>

      {isReady && (
        <div className="card-actions justify-end mt-6">
          <Link to="/scenarios" className="btn btn-primary btn-block gap-2">
            Start practicing
            <ArrowRightIcon className="h-5 w-5" />
          </Link>
        </div>
      )}
    </>
  );
};

const LanguageSelector = ({
  className = "",
  value,
  onChange,
}: {
  className?: string;
  value: string;
  onChange: (value: string) => void;
}) => {
  const languages = useAppStore((state) => state.languages);

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
  const message = location.state?.message;
  const isLoading = useAppStore((state) => state.appLoading);
  const nativeLanguage = useAppStore((state) => state.nativeLanguage);
  const setNativeLanguage = useAppStore((state) => state.setNativeLanguage);
  const practiceLanguage = useAppStore((state) => state.practiceLanguage);
  const setPracticeLanguage = useAppStore((state) => state.setPracticeLanguage);

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

      <div className="flex flex-col lg:flex-row gap-6">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="card bg-base-200 flex-1"
        >
          <div className="card-body">
            <h2 className="card-title">Language Settings</h2>
            <div className="grid gap-6">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">
                    Native Language
                  </span>
                </label>
                <LanguageSelector
                  value={nativeLanguage}
                  onChange={setNativeLanguage}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">
                    Practice Language
                  </span>
                </label>
                <LanguageSelector
                  value={practiceLanguage}
                  onChange={setPracticeLanguage}
                />
              </div>
            </div>

            <div className="divider"></div>

            <div className="flex flex-col gap-4">
              <h3 className="text-error font-semibold">Reset Options</h3>
              <div className="flex flex-col lg:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => useAppStore.getState().vocabulary.clear()}
                  className="btn btn-error gap-2"
                >
                  <XMarkIcon className="h-5 w-5" />
                  Reset Vocabulary
                </button>
                <button
                  type="button"
                  onClick={() => useAppStore.getState().reset()}
                  className="btn btn-error gap-2"
                >
                  <XMarkIcon className="h-5 w-5" />
                  Reset All Settings
                </button>
              </div>
            </div>
          </div>
        </form>

        <div className="card bg-base-200 lg:w-96 w-full">
          <div className="card-body">
            <ConfigurationStatus />
          </div>
        </div>
      </div>
    </>
  );
};
