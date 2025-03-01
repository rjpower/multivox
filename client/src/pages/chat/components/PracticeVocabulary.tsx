import { useMemo } from "react";
import { VocabularyEntry, WebSocketMessage } from "../../../types";
import { PracticeVocabulary as PracticeVocabularyUI } from "../../../components/PracticeVocabulary";

export const PracticeVocabulary = ({
  messages,
}: {
  messages: Array<WebSocketMessage>;
}) => {
  const vocabulary = useMemo(() => {
    const vocabMap = new Map<string, VocabularyEntry>();

    messages.forEach((msg) => {
      if (msg.type === "transcription" && msg.dictionary) {
        Object.entries(msg.dictionary).forEach(([term, entry]) => {
          vocabMap.set(term, {
            ...entry,
            context_source: msg.source_text,
            context_translated: msg.translated_text,
          });
        });
      }
      if (msg.type === "translation" && msg.dictionary) {
        Object.entries(msg.dictionary).forEach(([term, entry]) => {
          vocabMap.set(term, {
            ...entry,
            context_source: msg.source_text,
            context_translated: msg.translated_text,
          });
        });
      }
    });

    // Convert to sorted array
    return Array.from(vocabMap.values())
      .sort((a, b) => a.source_text.localeCompare(b.source_text));
  }, [messages]);

  return <PracticeVocabularyUI vocabulary={vocabulary} />;
};
