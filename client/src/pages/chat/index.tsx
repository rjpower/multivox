import { BookOpenIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "../../ErrorBoundary";
import { nativeLanguageAtom, practiceLanguageAtom } from "../../stores/app";
import { ChatControls } from "./components/ChatControls";
import { ChatMessages } from "./components/ChatMessages";
import { PracticeVocabulary } from "./components/PracticeVocabulary";
import { chatHistoryAtom, useConnect, useReset } from "./store";

export const Chat = () => {
  const [isVocabVisible, setIsVocabVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  const chatHistory = useAtomValue(chatHistoryAtom);
  const reset = useReset();
  const connect = useConnect();
  const practiceLanguage = useAtomValue(practiceLanguageAtom);
  const nativeLanguage = useAtomValue(nativeLanguageAtom);
  let isProcessing = false;

  // N.B. `reverse` modifies the list in place, so we need a copy.
  const lastMsg = [...chatHistory]
    .reverse()
    .find((m) => m.type == "processing");
  if (lastMsg && lastMsg.status != "completed") {
    isProcessing = true;
  }
  console.log("Rendering...", isProcessing, chatHistory, lastMsg);

  useEffect(() => {
    if (!location.state?.instructions) {
      navigate(-1);
      return;
    }

    connect(
      location.state.instructions,
      practiceLanguage!,
      nativeLanguage!
    ).catch((error) => {
      console.error("Failed to connect:", error);
      navigate(-1);
    });

    return () => reset();
  }, []);

  return (
    <ErrorBoundary>
      <div className="bg-base-100 -m-8 h-[calc(100vh-4rem)]">
        <div className="h-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-4 relative p-4">
          <div className="absolute top-4 right-4 lg:hidden">
            <button
              onClick={() => setIsVocabVisible(!isVocabVisible)}
              className="btn btn-circle btn-ghost"
            >
              <BookOpenIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 bg-base-100 rounded-lg shadow-lg flex flex-col overflow-hidden">
            <ChatMessages
              messages={chatHistory}
              onHintSelect={(text) => {
                if (inputRef.current) {
                  inputRef.current.value = text;
                  inputRef.current.focus();
                }
              }}
            />
            <ChatControls inputRef={inputRef} isProcessing={isProcessing} />
          </div>
          <div
            className={`
              fixed lg:relative top-0 right-0 h-full 
              w-80 bg-base-100 lg:bg-transparent
              transform transition-transform duration-300 ease-in-out
              ${
                isVocabVisible
                  ? "translate-x-0"
                  : "translate-x-full lg:translate-x-0"
              }
              lg:w-80 lg:shrink-0 
              z-50 lg:z-auto
            `}
          >
            <div className="lg:hidden navbar bg-base-100">
              <h3 className="navbar-start font-medium">Vocabulary</h3>
              <button
                onClick={() => setIsVocabVisible(false)}
                className="navbar-end btn btn-circle btn-ghost btn-sm"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <PracticeVocabulary messages={chatHistory} />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};
