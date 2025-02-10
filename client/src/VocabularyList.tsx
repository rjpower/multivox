import { useState, useEffect } from "react";
import { DictionaryEntry } from "./types";

interface VocabularyItem {
  term: string;
  entry: DictionaryEntry;
}

export const VocabularyList = ({ 
  messages 
}: { 
  messages: Array<{ 
    content: { 
      type: string; 
      transcription?: { 
        dictionary: Record<string, DictionaryEntry> 
      } 
    } 
  }> 
}) => {
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);

  useEffect(() => {
    // Collect unique vocabulary items from all transcription messages
    const vocabMap = new Map<string, DictionaryEntry>();
    
    messages.forEach(msg => {
      if (msg.content.type === "transcription" && msg.content.transcription) {
        Object.entries(msg.content.transcription.dictionary).forEach(([term, entry]) => {
          vocabMap.set(term, entry);
        });
      }
    });

    // Convert to sorted array
    const sortedVocab = Array.from(vocabMap.entries())
      .map(([term, entry]) => ({ term, entry }))
      .sort((a, b) => a.term.localeCompare(b.term));

    setVocabulary(sortedVocab);
  }, [messages]);

  if (vocabulary.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 max-h-[600px] overflow-y-auto">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">Vocabulary</h3>
      <div className="space-y-3">
        {vocabulary.map(({ term, entry }) => (
          <div
            key={term}
            className="group hover:bg-indigo-50 p-2 rounded-md transition-colors"
          >
            <div className="text-md font-medium text-gray-900">{term}</div>
            <div className="text-sm text-gray-600">{entry.english}</div>
            {entry.notes && (
              <div className="text-xs text-gray-500 italic group-hover:block">
                {entry.notes}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
