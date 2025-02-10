import { Link, useLocation } from "react-router-dom";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ScenarioList } from "./ScenarioList";
import { Translate } from "./Translate";
import { Practice } from "./Practice";
import { useState, useEffect } from "react";

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
}

const NavLink = ({ to, children }: NavLinkProps) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-md transition-colors ${
        isActive
          ? "bg-indigo-600 text-white"
          : "text-gray-600 hover:bg-indigo-50 hover:text-indigo-600"
      }`}
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
          <NavLink to="/">Scenarios</NavLink>
          <NavLink to="/translate">Translator</NavLink>
        </div>
      </div>
    </nav>
  );
};

const Home = () => {
  const [selectedLanguage, setSelectedLanguage] = useState("ja");
  const [scenarios, setScenarios] = useState([]);

  useEffect(() => {
    fetch("/api/scenarios")
      .then((res) => res.json())
      .then((data) => setScenarios(data));
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Language Practice
        </h1>

        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Practice Language
          </label>
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="ja">Japanese</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="it">Italian</option>
          </select>
        </div>

        <div className="bg-white rounded-lg shadow-md">
          <ScenarioList
            scenarios={scenarios}
            selectedLanguage={selectedLanguage}
          />
        </div>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <NavBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/practice/:scenarioId" element={<Practice />} />
          <Route path="/translate" element={<Translate />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
