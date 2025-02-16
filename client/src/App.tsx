import { ErrorBoundary } from "./ErrorBoundary";
import {
  Link,
  Route,
  BrowserRouter as Router,
  Routes,
  useLocation,
} from "react-router-dom";
import { Config } from "./Config";
import Landing from "./Landing";
import { Practice } from "./Practice";
import { ScenarioSelect } from "./ScenarioSelect";
import { useAppStore } from "./store";
import { Translate } from "./Translate";
import { VocabularyList } from "./VocabularyList";
import { Demo } from "./Demo";
import FlashcardGenerator from "./FlashcardGenerator";

interface RequireApiKeyProps {
  children: React.ReactNode;
}

const RequireReady = ({ children }: RequireApiKeyProps) => {
  const isReady = useAppStore((state) => state.isReady);
  const isLoading = useAppStore((state) => state.appLoading);
  console.log(
    "Is Ready:",
    useAppStore((state) => state.isReady),
    useAppStore((state) => state.appLoading),
    useAppStore((state) => state.geminiApiKey),
    useAppStore((state) => state.selectedLanguage)
  );

  if (isLoading) {
    return null;
  }

  if (!isReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Configuration Required</h2>
          <p className="text-gray-600 mb-4">Please configure your API key and language settings to continue</p>
          <Link 
            to="/config" 
            className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Go to Configuration
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
  className?: (props: { isActive: boolean }) => string;
}

const NavLink = ({ to, children, className }: NavLinkProps) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  const defaultClassName = ({
    isActive,
  }: {
    isActive: boolean;
  }) => `
    px-4 py-2 rounded-md transition-colors
    ${isActive ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-indigo-50 hover:text-indigo-600"}
  `;

  return (
    <Link
      to={to}
      className={className ? className({ isActive }) : defaultClassName({ isActive })}
    >
      {children}
    </Link>
  );
};

const NavBar = () => {
  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex items-center space-x-4">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/config">Config</NavLink>
          {useAppStore((state) => state.isReady) && (
            <>
              <NavLink to="/scenarios">Practice</NavLink>
              <NavLink to="/translate">Translator</NavLink>
            </>
          )}
          <NavLink to="/vocabulary">Vocabulary</NavLink>
          <NavLink to="/flashcards">Flashcards</NavLink>
        </div>
      </div>
    </nav>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-gray-100">
          <NavBar />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/demo" element={<Demo />} />
            <Route
              path="/scenarios"
              element={
                <RequireReady>
                  <ScenarioSelect />
                </RequireReady>
              }
            />
            <Route
              path="/practice/:scenarioId"
              element={
                <RequireReady>
                  <Practice />
                </RequireReady>
              }
            />
            <Route
              path="/translate"
              element={
                <RequireReady>
                  <Translate />
                </RequireReady>
              }
            />
            <Route path="/config" element={<Config />} />
            <Route path="/vocabulary" element={<VocabularyList />} />
            <Route path="/flashcards" element={<FlashcardGenerator />} />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
