import { BookOpenIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "../../components/ErrorBoundary";
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
  const searchParams = new URLSearchParams(location.search);

  const encodedInstructions = searchParams.get("instructions");
  const practiceLanguageParam = searchParams.get("practiceLanguage");
  const nativeLanguageParam = searchParams.get("nativeLanguage");
  const modalityParam = searchParams.get("modality") as "text" | "audio";

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

  // Track if we've already attempted to connect
  const [hasAttemptedConnect, setHasAttemptedConnect] = useState(false);
  const setChatHistory = useSetAtom(chatHistoryAtom);

  useEffect(() => {
    // Only attempt to connect once
    console.log("Connecting: ", hasAttemptedConnect);
    if (hasAttemptedConnect) return;
    setHasAttemptedConnect(true);

    if (!encodedInstructions) {
      navigate("/scenarios");
      return;
    }

    const instructions = decodeURIComponent(encodedInstructions);

    // Use URL params if provided, otherwise fall back to atom values
    const practiceLanguageToUse = practiceLanguageParam || practiceLanguage;
    const nativeLanguageToUse = nativeLanguageParam || nativeLanguage;

    if (!practiceLanguageToUse || !nativeLanguageToUse) {
      throw new Error("Missing language configuration");
    }

    connect({
      text: instructions,
      practiceLanguage: practiceLanguageToUse,
      nativeLanguage: nativeLanguageToUse,
      modality: modalityParam,
    }).catch((error) => {
      console.error("Failed to connect:", error);
      // Show error message in chat instead of redirecting
      setChatHistory([
        {
          type: "error",
          role: "system",
          text: `Failed to start conversation: ${error.message}`,
          end_of_turn: true,
        },
      ]);
    });

    return () => reset();
  }, [
    encodedInstructions,
    practiceLanguageParam,
    nativeLanguageParam,
    modalityParam,
  ]);

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
                className="btn btn-circle btn-ghost btn-sm"
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
