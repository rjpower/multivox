import { TypedWebSocket } from "./TypedWebSocket";
import { CLIENT_SAMPLE_RATE } from "../../../types";

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private ws: TypedWebSocket | null = null;
  private isRecording = false;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(websocket: TypedWebSocket) {
    this.ws = websocket;
  }

  async startRecording() {
    if (this.isRecording) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: CLIENT_SAMPLE_RATE,
          channelCount: 1,
        },
      });

      // Create audio context first
      this.audioContext = new AudioContext({ sampleRate: CLIENT_SAMPLE_RATE });
      this.source = this.audioContext.createMediaStreamSource(this.stream);

      // Create script processor for raw PCM access
      this.processor = this.audioContext.createScriptProcessor(1024, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.isRecording || this.ws?.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);

        // Convert Float32 to Int16
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = Math.round(s * 32767);
        }

        // Convert to base64
        const pcmBytes = new Uint8Array(pcmData.buffer);
        const binary = String.fromCharCode.apply(null, Array.from(pcmBytes));
        const base64 = btoa(binary);

        this.ws.send({
          type: "audio",
          audio: base64,
          role: "user",
          mime_type: "audio/pcm",
          end_of_turn: false,
        });
      };

      // Connect the nodes
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      this.isRecording = true;
    } catch (err) {
      console.error("Error starting recording:", err);
      throw err;
    }
  }

  stopRecording() {
    if (!this.isRecording) return;

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.processor && this.audioContext) {
      this.processor.disconnect();
      this.source?.disconnect();
      this.audioContext.close();
      this.processor = null;
      this.source = null;
      this.audioContext = null;
    }

    this.isRecording = false;
  }

  getRecordingState() {
    return this.isRecording;
  }
}
