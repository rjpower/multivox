import React from "react";
import { useAtom } from "jotai";
import {
  CheckIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  ArrowPathIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useJournal, JournalAnalysisResponse, CorrectionSpan } from "./store";
import { practiceLanguageAtom, nativeLanguageAtom } from "../../stores/app";

// Component to display a corrected text with error highlights
const CorrectedText: React.FC<{
  text: string;
  spans: CorrectionSpan[];
}> = ({ text, spans }) => {
  if (!spans || spans.length === 0) {
    return <div className="whitespace-pre-wrap">{text}</div>;
  }

  // Sort spans by start position to correctly process them in order
  const sortedSpans = [...spans].sort((a, b) => a.start - b.start);

  // Build an array of text segments and correction spans
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;

  sortedSpans.forEach((span, index) => {
    // Add text before this span
    if (span.start > lastIndex) {
      segments.push(
        <span key={`text-${index}`}>
          {text.substring(lastIndex, span.start)}
        </span>
      );
    }

    // Add the highlighted correction span
    segments.push(
      <span
        key={`correction-${index}`}
        className={`relative group cursor-help ${getTypeColor(span.type)}`}
      >
        {text.substring(span.start, span.end)}
        <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-base-200 p-3 rounded shadow-lg z-10 w-72 border border-base-300">
          <div className="flex justify-between items-center mb-1">
            <span className="font-semibold text-base-content">Suggestion:</span>
            <span className="text-xs px-2 py-0.5 rounded bg-base-300">{span.type}</span>
          </div>
          <p className="text-md font-medium mb-2 text-primary">{span.suggestion}</p>
          <p className="text-sm border-t border-base-300 pt-2 mt-1">{span.explanation}</p>
        </div>
      </span>
    );

    lastIndex = span.end;
  });

  // Add the remaining text after the last span
  if (lastIndex < text.length) {
    segments.push(
      <span key="text-final">{text.substring(lastIndex)}</span>
    );
  }

  return <div className="whitespace-pre-wrap">{segments}</div>;
};

// Correction type colors helper
const getTypeColor = (type: string): string => {
  switch (type.toLowerCase()) {
    case "grammar":
      return "bg-red-100 text-red-800 underline decoration-red-500 decoration-wavy border-b border-red-500";
    case "spelling":
      return "bg-amber-100 text-amber-800 underline decoration-amber-500 decoration-wavy border-b border-amber-500";
    case "style":
      return "bg-blue-100 text-blue-800 underline decoration-blue-500 decoration-wavy border-b border-blue-500";
    case "vocabulary":
      return "bg-purple-100 text-purple-800 underline decoration-purple-500 decoration-wavy border-b border-purple-500";
    default:
      return "bg-gray-100 text-gray-800 underline decoration-gray-500 decoration-wavy border-b border-gray-500";
  }
};

// Component for corrections side pane
const CorrectionsPane: React.FC<{
  analysisResult: JournalAnalysisResponse;
  originalText: string;
  onApplyCorrections: () => void;
  onApplySingleCorrection: (span: CorrectionSpan) => void;
}> = ({ analysisResult, originalText, onApplyCorrections, onApplySingleCorrection }) => {
  if (!analysisResult) return null;

  return (
    <div className="bg-base-200 p-4 rounded-lg h-full overflow-y-auto">
      <h3 className="text-lg font-medium mb-2">Feedback</h3>
      <div className="mb-4 p-3 bg-base-300 rounded">
        <p className="italic">{analysisResult.feedback}</p>
      </div>

      {/* Correction type legend */}
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        <span className="px-2 py-1 bg-red-100 text-red-800 rounded">Grammar</span>
        <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded">Spelling</span>
        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">Style</span>
        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">Vocabulary</span>
      </div>

      <h3 className="text-lg font-medium mb-2">Corrections</h3>
      
      {/* List of individual corrections */}
      <div className="mb-4 space-y-2">
        {analysisResult.spans.map((span, index) => (
          <div key={index} className="p-2 bg-base-300 rounded flex justify-between items-center">
            <div>
              <span className={`px-2 py-0.5 rounded text-xs mr-2 ${getTypeColor(span.type).replace('underline decoration-wavy border-b', '')}`}>
                {span.type}
              </span>
              <span className="font-medium">{originalText.substring(span.start, span.end)}</span>
              {" → "}
              <span className="text-primary">{span.suggestion}</span>
            </div>
            <button 
              onClick={() => onApplySingleCorrection(span)}
              className="btn btn-xs btn-ghost"
              title="Apply this correction"
            >
              <CheckIcon className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      
      <h3 className="text-lg font-medium mb-2">Preview</h3>
      <CorrectedText text={originalText} spans={analysisResult.spans} />
      
      <div className="mt-4">
        <button
          onClick={onApplyCorrections}
          className="btn btn-primary btn-sm"
        >
          <CheckIcon className="h-4 w-4 mr-2" />
          Apply All Corrections
        </button>
      </div>
    </div>
  );
};

// Component for the sidebar with journal entries list
const JournalSidebar: React.FC = () => {
  const { entries, activeEntryId, setActiveEntryId, createEntry, deleteEntry } = useJournal();

  return (
    <div className="w-full md:w-64 bg-base-200 h-full p-4 border-r border-base-300">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">Journal Entries</h2>
        <button
          onClick={createEntry}
          className="btn btn-sm btn-circle btn-ghost"
          title="New Entry"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      </div>
      <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-12rem)]">
        {entries.length === 0 ? (
          <div className="text-center py-4 text-base-content/60">
            No entries yet. Create one to get started!
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={`p-2 rounded cursor-pointer ${
                activeEntryId === entry.id
                  ? "bg-primary/10 border-l-4 border-primary"
                  : "hover:bg-base-300"
              }`}
              onClick={() => {
                setActiveEntryId(entry.id);
              }}
            >
              <h3 className="font-medium truncate">{entry.title}</h3>
              <p className="text-xs text-base-content/60 truncate">
                {new Date(entry.date).toLocaleDateString()}
              </p>
              <p className="text-sm truncate">
                {entry.content.substring(0, 60)}
                {entry.content.length > 60 ? "..." : ""}
              </p>
              <div className="flex justify-end mt-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Are you sure you want to delete this entry?")) {
                      deleteEntry(entry.id);
                    }
                  }}
                  className="btn btn-xs btn-ghost"
                >
                  <TrashIcon className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Editor component
const JournalEditor: React.FC = () => {
  const {
    activeEntry,
    setActiveEntryContent,
    setActiveEntryTitle,
    analyzeEntry,
    analysisResult,
    loadingAnalysis,
    saveCorrection,
  } = useJournal();
  
  const [practiceLanguage] = useAtom(practiceLanguageAtom);
  const [nativeLanguage] = useAtom(nativeLanguageAtom);
  const [copied, setCopied] = useState(false);

  // Handle when there's no active entry selected
  if (!activeEntry) {
    return (
      <div className="flex-1 flex items-center justify-center bg-base-100 p-6">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">No Journal Entry Selected</h3>
          <p className="mb-4">Select an entry from the sidebar or create a new one.</p>
        </div>
      </div>
    );
  }


  // Handle requesting analysis
  const handleAnalyze = () => {
    analyzeEntry(activeEntry.content, practiceLanguage!, nativeLanguage!);
  };

  const handleSave = () => {
    if (activeEntry) {
      setActiveEntryContent(activeEntry.content);
      setActiveEntryTitle(activeEntry.title);
    }
  }

  // Handle applying all corrections
  const handleApplyCorrections = () => {
    if (analysisResult) {
      saveCorrection(activeEntry.id, analysisResult);
    }
  };

  // Handle applying a single correction
  const handleApplySingleCorrection = (span: CorrectionSpan) => {
    if (!activeEntry || !activeEntry.content) return;
    
    // Create a new content string with just this correction applied
    const before = activeEntry.content.substring(0, span.start);
    const after = activeEntry.content.substring(span.end);
    const newContent = before + span.suggestion + after;
    
    // Update the entry content
    setActiveEntryContent(newContent);
  };

  // Handle copy to clipboard
  const handleCopy = () => {
    const textToCopy = analysisResult 
      ? analysisResult.improved_text 
      : activeEntry.correctedContent || activeEntry.content;
      
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col bg-base-100 h-full">
      {/* Header with controls */}
      <div className="p-4 border-b border-base-300 flex justify-between items-center">
        <div className="flex-1">
          <input
            type="text"
            value={activeEntry.title}
            onChange={(e) => setActiveEntryTitle(e.target.value)}
            className="input input-sm w-full max-w-md"
            placeholder="Entry title"
          />
          <div className="text-xs text-base-content/60 mt-1">
            Last edited: {new Date(activeEntry.lastEdited).toLocaleString()}
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleCopy}
            className="btn btn-sm btn-ghost"
            title={copied ? "Copied!" : "Copy to clipboard"}
          >
            {copied ? (
              <ClipboardDocumentCheckIcon className="h-4 w-4" />
            ) : (
              <ClipboardDocumentIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col md:flex-row h-full">
          {/* Main content panel */}
          <div className={`p-4 flex-1 ${analysisResult ? 'md:w-1/2' : 'w-full'}`}>
            <textarea
              value={activeEntry.content}
              onChange={(e) => setActiveEntryContent(e.target.value)}
              className="textarea textarea-bordered w-full h-full min-h-[300px]"
              placeholder="Write your journal entry here..."
            />
          </div>
          
          {/* Corrections panel (visible in both edit and view modes) */}
          {analysisResult && (
            <div className="md:w-1/2 p-4">
              <CorrectionsPane 
                analysisResult={analysisResult}
                originalText={activeEntry.content}
                onApplyCorrections={handleApplyCorrections}
                onApplySingleCorrection={handleApplySingleCorrection}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="p-4 border-t border-base-300 flex justify-between items-center">
        <div className="flex space-x-2">
          <button
            onClick={handleSave}
            className="btn btn-sm btn-success"
          >
            Save Changes
          </button>
        </div>
        
        <div>
          <button
            onClick={handleAnalyze}
            className="btn btn-sm btn-primary"
            disabled={
              loadingAnalysis || 
              !activeEntry.content.trim()
            }
          >
            {loadingAnalysis ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckIcon className="h-4 w-4 mr-2" />
            )}
            Analyze Writing
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Journal component
const Journal: React.FC = () => {
  const { createEntry, entries } = useJournal();

  // Create a default entry if there are none
  React.useEffect(() => {
    if (entries.length === 0) {
      createEntry();
    }
  }, [createEntry, entries.length]);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-16rem)]">
      <JournalSidebar />
      <JournalEditor />
    </div>
  );
};

export default Journal;

// Missing useState import
function useState<T>(initialState: T): [T, (newState: T) => void] {
  return React.useState<T>(initialState);
}
