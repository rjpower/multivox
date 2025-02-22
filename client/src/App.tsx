import { ErrorBoundary } from "./ErrorBoundary";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { Link, Route, BrowserRouter as Router, Routes } from "react-router-dom";
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

  if (isLoading) {
    return null;
  }

  if (!isReady()) {
    return (
      <div className="min-h-screen hero bg-base-100">
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
      </div>
    );
  }

  return <>{children}</>;
};

const NavBar = () => {
  const isReady = useAppStore((state) => state.isReady);

  return (
    <div className="navbar bg-base-200 shadow-lg">
      <div className="navbar-start">
        <div className="dropdown">
          <label tabIndex={0} className="btn btn-ghost lg:hidden">
            <Bars3Icon className="h-5 w-5" />
          </label>
          <ul
            tabIndex={0}
            className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52"
          >
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/config">Config</Link>
            </li>
            {isReady() && (
              <>
                <li>
                  <Link to="/scenarios">Practice</Link>
                </li>
                <li>
                  <Link to="/translate">Translator</Link>
                </li>
              </>
            )}
            <li>
              <Link to="/vocabulary">Vocabulary</Link>
            </li>
            <li>
              <Link to="/flashcards">Flashcards</Link>
            </li>
          </ul>
        </div>
        <Link to="/" className="btn btn-ghost normal-case text-xl">
          MultiVox
        </Link>
      </div>
      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal px-1">
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/config">Config</Link>
          </li>
          {isReady() && (
            <>
              <li>
                <Link to="/scenarios">Practice</Link>
              </li>
              <li>
                <Link to="/translate">Translator</Link>
              </li>
            </>
          )}
          <li>
            <Link to="/vocabulary">Vocabulary</Link>
          </li>
          <li>
            <Link to="/flashcards">Flashcards</Link>
          </li>
        </ul>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-base-200">
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
