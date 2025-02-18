import { useEffect, useState } from "react";                                                                                                                
import { Practice } from "./Practice";
import { ChatHistory } from "./ChatHistory";
import { useAppStore, usePracticeStore } from "./store";

interface StateTransition {
  currentStateIndex: number;
  nextActionId: number;
  stagedActionIds: number[];
  actionsById: Record<
    string,
    {
      action: { type: string };
      timestamp: number;
      type: string;
    }
  >;
  computedStates: Array<{
    state: any;
  }>;
}

export const Demo = () => {
  const [transitions, setTransitions] = useState<StateTransition | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Load the transitions file
    fetch("/demo.json")
      .then((res) => res.json())
      .then((data) => setTransitions(data));
  }, []);

  useEffect(() => {
    if (!transitions) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= transitions.computedStates.length) {
          return prev;
        }
        // Apply the new state
        const newState = transitions.computedStates[next].state;
        console.log(newState.practice.chatHistory.messages);
        useAppStore.setState(() => ({
          systemScenarios: newState.systemScenarios || [],
          userScenarios: newState.userScenarios || [],
          languages: newState.languages,
          practiceLanguage: newState.practiceLanguage,
          geminiApiKey: newState.geminiApiKey,
          apiKeyStatus: newState.apiKeyStatus,
          isReady: newState.isReady,
        }));
        usePracticeStore.setState({
          chatHistory: new ChatHistory(
            Array.isArray(newState.practice.chatHistory.messages) 
              ? newState.practice.chatHistory.messages 
              : []
          ),
          connection: newState.practice.connection,
          recorder: newState.practice.recorder,
          practiceState: newState.practice.practiceState,
          wsState: newState.practice.wsState,
          modality: newState.practice.modality,
          customInstructions: newState.practice.customInstructions,
          isRecording: newState.practice.isRecording,
          translatedInstructions: newState.practice.translatedInstructions
        });
        return next;
      });
    }, 100); // Transition every second

    return () => clearInterval(interval);
  }, [transitions]);

  if (!transitions) return <div>Loading transitions...</div>;

  // Check if we have the necessary data
  const hasScenarios = transitions.computedStates[currentIndex].state.systemScenarios?.length > 0;
  
  return (
    <div className="min-h-screen bg-gray-100 flex">
      <div className="flex-grow">
        {hasScenarios ? <Practice /> : <div>Loading scenarios...</div>}
      </div>
      <div className="w-96 bg-white shadow-lg p-4 overflow-y-auto">
        <div className="mb-4 text-gray-600 font-medium">
          State {currentIndex + 1} of {transitions.computedStates.length}
        </div>
        <div className="space-y-4">
          {Object.entries(transitions.computedStates[currentIndex].state).map(
            ([key, value]) => (
              <div key={key} className="border-b pb-2">
                <div className="text-sm font-medium text-gray-700 mb-1">
                  {key}
                </div>
                <div className="text-xs text-gray-600 font-mono break-all">
                  {typeof value === "object"
                    ? JSON.stringify(value, null, 2).substring(0, 200)
                    : String(value).substring(0, 200)}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};        
