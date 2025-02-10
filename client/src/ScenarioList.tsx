import { Link } from "react-router-dom";
import type { Scenario } from "./types";

const getFirstSentence = (text: string): string => {
  // Replace newlines with spaces before extracting first sentence
  const singleLine = text.replace(/\n/g, ' ');
  const match = singleLine.match(/^[^.!?]+[.!?]/);
  return match ? match[0] : singleLine;
};

export const ScenarioList = ({ 
  scenarios, 
  selectedLanguage 
}: { 
  scenarios: Scenario[],
  selectedLanguage: string 
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Title
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {scenarios.map((scenario) => (
            <tr key={scenario.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {scenario.title}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-500">
                  {getFirstSentence(scenario.description)}
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <Link
                  to={`/practice/${scenario.id}?lang=${selectedLanguage}`}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Start Practice
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
