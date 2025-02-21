import ReactDOM from "react-dom/client";
import App from "./App";
import { useEffect } from "react";
import { useAppStore, initAppStore } from "./stores/app";

const InitStore = ({ children }: { children: React.ReactNode }) => {
  const appLoading = useAppStore((state) => state.appLoading);
  const appError = useAppStore((state) => state.appError);
  const setAppError = useAppStore((state) => state.setAppError);
  const setLanguages = useAppStore((state) => state.setLanguages);
  const setNativeLanguage = useAppStore((state) => state.setNativeLanguage);
  const setScenarios = useAppStore((state) => state.setScenarios);
  const setPracticeLanguage = useAppStore((state) => state.setPracticeLanguage);

  useEffect(() => {
    const init = async () => {
      await initAppStore({
        setLanguages,
        setNativeLanguage,
        setScenarios,
        setPracticeLanguage,
        setAppError,
      });
    };
    init();
  }, []);

  if (appLoading) {
    return <div>Loading...</div>;
  } else if (appError) {
    return <div>Error initializing app {appError}</div>;
  }

  return <>{children}</>;
};

export default InitStore;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <InitStore>
    <App />
  </InitStore>
);
