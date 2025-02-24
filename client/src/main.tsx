import { useEffect, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { Link, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { Config } from "./Config";
import { ErrorBoundary } from "./ErrorBoundary";
import { Landing } from "./Landing";
import { AppLayout } from "./layouts/AppLayout";
import { Chat } from "./pages/chat";
import FlashcardGenerator from "./pages/flashcards";
import { ScenarioPreview } from "./pages/scenario";
import { ScenarioSelect } from "./pages/scenarios";
import { Translate } from "./pages/translate";
import { VocabularyList } from "./pages/vocabulary";
import { initAppStore, useAppStore } from "./stores/app";

const InitApp = ({ children }: { children: React.ReactNode }) => {
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

interface RequireApiKeyProps {
  children: React.ReactNode;
}

const RequireReady = ({ children }: RequireApiKeyProps) => {
  const isReady = useAppStore((state) => state.isReady);
  const isLoading = useAppStore((state) => state.appLoading);

  if (isLoading) {
    return null;
  }

  if (!isReady()) {
    return (
      <div className="hero-content text-center">
        <div className="max-w-md">
          <h2 className="text-2xl font-bold">Configuration Required</h2>
          <p className="py-6">
            Please configure your API key and language settings to continue
          </p>
          <Link to="/config" className="btn btn-primary">
            Go to Configuration
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const PageWrapper = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-base-100 p-8">
      <div className="max-w-7xl mx-auto">{children}</div>
    </div>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <Router>
        <AppLayout>
          <Routes>
            <Route
              path="/"
              element={
                <PageWrapper>
                  <Landing />
                </PageWrapper>
              }
            />
            <Route
              path="/scenarios"
              element={
                <RequireReady>
                  <PageWrapper>
                    <ScenarioSelect />
                  </PageWrapper>
                </RequireReady>
              }
            />
            <Route
              path="/practice/:scenarioId"
              element={
                <RequireReady>
                  <PageWrapper>
                    <ScenarioPreview />
                  </PageWrapper>
                </RequireReady>
              }
            />
            <Route
              path="/practice/:scenarioId/chat"
              element={
                <RequireReady>
                  <PageWrapper>
                    <Chat />
                  </PageWrapper>
                </RequireReady>
              }
            />
            <Route
              path="/translate"
              element={
                <PageWrapper>
                  <Translate />
                </PageWrapper>
              }
            />
            <Route
              path="/config"
              element={
                <PageWrapper>
                  <Config />
                </PageWrapper>
              }
            />
            <Route
              path="/vocabulary"
              element={
                <PageWrapper>
                  <VocabularyList />
                </PageWrapper>
              }
            />
            <Route
              path="/flashcards"
              element={
                <PageWrapper>
                  <FlashcardGenerator />
                </PageWrapper>
              }
            />
          </Routes>
        </AppLayout>
      </Router>
    </ErrorBoundary>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <InitApp>
    <App />
  </InitApp>
);
