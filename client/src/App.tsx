import { ErrorBoundary } from "./ErrorBoundary";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
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
import { useState } from "react";

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Configuration Required
          </h2>
          <p className="text-gray-600 mb-4">
            Please configure your API key and language settings to continue
          </p>
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
  onNavigate?: () => void;
}

const NavLink = ({ to, children, onNavigate }: NavLinkProps) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  const handleClick = () => {
    if (onNavigate) {
      onNavigate();
    }
  };

  const className = (isActive: boolean) => `
    block px-4 py-2 rounded-md transition-colors w-full md:w-auto
    ${
      isActive
        ? "bg-indigo-600 text-white"
        : "text-gray-600 hover:bg-indigo-50 hover:text-indigo-600"
    }
  `;

  return (
    <Link to={to} className={className(isActive)} onClick={handleClick}>
      {children}
    </Link>
  );
};

const NavBar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isReady = useAppStore((state) => state.isReady);

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-4xl mx-auto px-6 py-4">
        {/* Mobile menu button */}
        <div className="flex items-center justify-between lg:hidden">
          <Link to="/" className="text-indigo-600 font-semibold">
            MultiVox
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-gray-500 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <span className="sr-only">Open menu</span>
            {mobileMenuOpen ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <Bars3Icon className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile menu */}
        <div
          className={`${
            mobileMenuOpen ? "block" : "hidden"
          } lg:hidden mt-4 space-y-2 pb-3`}
        >
          <NavLink to="/" onNavigate={() => setMobileMenuOpen(false)}>
            Home
          </NavLink>
          <NavLink to="/config" onNavigate={() => setMobileMenuOpen(false)}>
            Config
          </NavLink>
          {isReady() && (
            <>
              <NavLink
                to="/scenarios"
                onNavigate={() => setMobileMenuOpen(false)}
              >
                Practice
              </NavLink>
              <NavLink
                to="/translate"
                onNavigate={() => setMobileMenuOpen(false)}
              >
                Translator
              </NavLink>
            </>
          )}
          <NavLink to="/vocabulary" onNavigate={() => setMobileMenuOpen(false)}>
            Vocabulary
          </NavLink>
          <NavLink to="/flashcards" onNavigate={() => setMobileMenuOpen(false)}>
            Flashcards
          </NavLink>
        </div>

        {/* Desktop menu */}
        <div className="hidden lg:flex items-center space-x-4">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/config">Config</NavLink>
          {isReady() && (
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
            <Route path="/translate" element={<Translate />} />
            <Route path="/config" element={<Config />} />
            <Route path="/vocabulary" element={<VocabularyList />} />
            <Route path="/flashcards" element={<FlashcardGenerator />} />
            <Route path="/demo" element={<Demo />} />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
