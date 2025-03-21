import { type ReactNode, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { Link, Route, BrowserRouter as Router, Routes, useLocation } from "react-router-dom";
import { useAtomValue } from "jotai";
import { Config } from "./pages/config";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Landing } from "./pages/landing";
import { Footer } from "./components/Footer";
import { AppLayout } from "./layouts/AppLayout";
import { Chat } from "./pages/chat";
import { FlashcardGenerator } from "./pages/flashcards";
import Journal from "./pages/journal";
import { ScenarioPreview } from "./pages/scenario";
import { ScenarioSelect } from "./pages/scenario/list";
import { Translate } from "./pages/translate";
import { VocabularyList } from "./pages/vocabulary";
import {
  AppInitializer,
  appErrorAtom,
  useAppLoading,
  useReadyForPractice,
} from "./stores/app";

const InitApp = ({ children }: { children: React.ReactNode }) => {
  const appLoading = useAppLoading();
  const appError = useAtomValue(appErrorAtom);

  return (
    <>
      <AppInitializer />
      {appLoading ? null : appError ? <div>{appError}</div> : children}
    </>
  );
};

interface RequireApiKeyProps {
  children: React.ReactNode;
}

const RequireReady = ({ children }: RequireApiKeyProps) => {
  const isReady = useReadyForPractice();
  const isLoading = useAppLoading();

  if (isLoading) {
    return null;
  }

  if (!isReady) {
    return (
      <div className="hero-content text-center">
        <div className="max-w-md">
          <h2 className="text-2xl font-bold">Configuration Required</h2>
          <p className="py-6">
            Configure your native and practice language to try this feature.
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

// Component to scroll to top when route changes
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
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
        <ScrollToTop />
        <div className="flex flex-col min-h-screen">
          <AppLayout>
            <div className="flex-grow">
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
                  path="/practice/chat"
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
                    <RequireReady>
                      <PageWrapper>
                        <FlashcardGenerator />
                      </PageWrapper>
                    </RequireReady>
                  }
                />
                <Route
                  path="/journal"
                  element={
                    <PageWrapper>
                      <Journal />
                    </PageWrapper>
                  }
                />
              </Routes>
            </div>
          </AppLayout>
          <Footer />
        </div>
      </Router>
    </ErrorBoundary>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <InitApp>
    <App />
  </InitApp>
);
