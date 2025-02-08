import type { TypedWebSocket } from "./types";

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private ws: TypedWebSocket | null = null;
  private isRecording = false;

  constructor(websocket: TypedWebSocket) {
    this.ws = websocket;
  }

  async startRecording() {
    if (this.isRecording) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
        },
      });

      this.mediaRecorder = new MediaRecorder(this.stream);

      this.mediaRecorder.ondataavailable = async (event: BlobEvent) => {
        if (event.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
          const arrayBuffer = await event.data.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const base64 = btoa(String.fromCharCode(...uint8Array));

          this.ws.send({
            type: "audio",
            audio: base64,
            role: "user",
          });
        }
      };

      this.mediaRecorder.start(1000); // Send chunks every second
      this.isRecording = true;
    } catch (err) {
      console.error("Error starting recording:", err);
      throw err;
    }
  }

  stopRecording() {
    if (!this.isRecording) return;

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    this.mediaRecorder = null;
    this.isRecording = false;
  }

  getRecordingState() {
    return this.isRecording;
  }
}
