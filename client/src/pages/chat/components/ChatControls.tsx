import { MicrophoneIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";
import {
  isRecordingAtom,
  useStartRecording,
  useStopRecording,
  useSendMessage,
} from "../store"; 
import { useAtom } from "jotai"; 

export const ChatControls = ({
  inputRef,
  isProcessing,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  isProcessing: boolean;
}) => {
  const [isRecording] = useAtom(isRecordingAtom); 
  const startRecording = useStartRecording(); 
  const stopRecording = useStopRecording(); 
  const sendMessage = useSendMessage(); 

  return (
    <div className="border-t border-base-200 bg-base-100 px-4 py-2">
      {(isRecording || isProcessing) && (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-base-content/70">
          {isRecording && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-error rounded-full animate-pulse" />
              <span>Recording...</span>
            </div>
          )}
          {isProcessing && (
            <div className="flex items-center gap-2">
              <span className="loading loading-spinner loading-sm" />
              <span>Processing input...</span>
            </div>
          )}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem(
            "message"
          ) as HTMLInputElement;
          const text = input.value.trim();
          if (text) {
            sendMessage(text);
            input.value = "";
          }
        }}
        className="flex items-center gap-2"
      >
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className={`btn btn-circle ${
            isRecording ? "btn-error" : "btn-ghost"
          }`}
        >
          <MicrophoneIcon
            className={`h-5 w-5 ${isRecording ? "animate-pulse" : ""}`}
          />
        </button>

        <input
          ref={inputRef}
          type="text"
          name="message"
          placeholder="Type your message..."
          className="input input-bordered flex-1"
        />

        <button type="submit" className="btn btn-ghost btn-circle">
          <PaperAirplaneIcon className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
};