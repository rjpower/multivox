import { ErrorBoundary } from "./ErrorBoundary";
import {
  Link,
  Navigate,
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
  const location = useLocation();

  if (!isReady) {
    return (
      <Navigate
        to="/config"
        replace
        state={{
          from: location,
          message: "Please configure your API key and language first",
        }}
      />
    );
  }

  return <>{children}</>;
};

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
  disabled?: boolean;
  className?: (props: { isActive: boolean; disabled?: boolean }) => string;
}

const NavLink = ({ to, children, disabled, className }: NavLinkProps) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  const defaultClassName = ({
    isActive,
    disabled,
  }: {
    isActive: boolean;
    disabled?: boolean;
  }) => `
    px-4 py-2 rounded-md transition-colors
    ${
      isActive
        ? "bg-indigo-600 text-white"
        : disabled
        ? "text-gray-400 hover:bg-gray-50 cursor-not-allowed"
        : "text-gray-600 hover:bg-indigo-50 hover:text-indigo-600"
    }
  `;

  return (
    <Link
      to={to}
      onClick={(e) => disabled && e.preventDefault()}
      className={
        className
          ? className({ isActive, disabled })
          : defaultClassName({ isActive, disabled })
      }
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
          <NavLink
            to="/scenarios"
            disabled={!useAppStore((state) => state.isReady)}
          >
            Practice
          </NavLink>
          <NavLink
            to="/translate"
            disabled={!useAppStore((state) => state.isReady)}
          >
            Translator
          </NavLink>
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
