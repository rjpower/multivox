import { SERVER_SAMPLE_RATE, BYTES_PER_SAMPLE } from "./types";

export class AudioPlayer {
  private audioContext: AudioContext;
  private scheduledSources: AudioBufferSourceNode[] = [];
  private nextStartTime: number = 0;

  constructor() {
    this.audioContext = new AudioContext({ sampleRate: SERVER_SAMPLE_RATE });
  }

  private convertPCMToAudioBuffer(pcmData: Uint8Array): AudioBuffer {
    // Validate input length matches our 16-bit sample expectation
    if (pcmData.length % BYTES_PER_SAMPLE !== 0) {
      throw new Error(
        `Invalid PCM data length ${pcmData.length}. Must be multiple of ${BYTES_PER_SAMPLE} bytes for 16-bit samples.`
      );
    }

    // Create an audio buffer (mono channel)
    const numSamples = pcmData.length / BYTES_PER_SAMPLE;
    const audioBuffer = this.audioContext.createBuffer(
      1,
      numSamples,
      SERVER_SAMPLE_RATE
    );
    const channelData = audioBuffer.getChannelData(0);

    // Convert 16-bit PCM to float32
    const dataView = new DataView(pcmData.buffer);
    for (let i = 0; i < pcmData.length; i += 2) {
      // Read as signed 16-bit little-endian
      const sample = dataView.getInt16(i, true);
      // Convert to float32 (-1.0 to 1.0)
      channelData[i / 2] = sample / 32767.0;
    }

    // Log some debug info about the audio data
    const maxSample = Math.max(...Array.from(channelData));
    const minSample = Math.min(...Array.from(channelData));
    console.log("Audio buffer stats:", {
      sampleRate: audioBuffer.sampleRate,
      length: audioBuffer.length,
      duration: audioBuffer.duration,
      maxSample,
      minSample,
    });

    return audioBuffer;
  }

  public async addAudioToQueue(audioData: string) {
    try {
      // Convert base64 to ArrayBuffer
      const binaryString = atob(audioData);
      const pcmData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        pcmData[i] = binaryString.charCodeAt(i);
      }

      // Convert PCM to AudioBuffer
      const audioBuffer = this.convertPCMToAudioBuffer(pcmData);

      // Create and schedule the source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      // If this is the first buffer or we're restarting or if scheduled time is in the past
      if (
        this.nextStartTime === 0 ||
        this.nextStartTime < this.audioContext.currentTime
      ) {
        // If we're starting fresh or if the next scheduled time is in the past,
        // start from the current time
        this.nextStartTime = this.audioContext.currentTime;
      }

      // Schedule this buffer to play at the exact time the previous one ends
      source.start(this.nextStartTime);
      this.scheduledSources.push(source);

      // Calculate the next start time based on the current buffer's duration
      this.nextStartTime += audioBuffer.duration;
      console.log("Scheduled audio at:", this.nextStartTime);
    } catch (error) {
      console.error("Error processing audio:", error);
    }
  }

  private isPlaying = false;

  public playBuffers(buffers: string[]): Promise<void> {
    return new Promise((resolve) => {
      if (this.isPlaying) {
        this.stop();
      }

      this.isPlaying = true;

      const lastSource = this.audioContext.createBufferSource();
      lastSource.onended = () => {
        this.isPlaying = false;
        resolve();
      };

      for (const buffer of buffers) {
        if (!this.isPlaying) break;
        this.addAudioToQueue(buffer);
      }
    });
  }

  public stop() {
    // Stop all scheduled sources
    for (const source of this.scheduledSources) {
      source.stop();
    }
    this.scheduledSources = [];
    this.nextStartTime = 0;
    this.isPlaying = false;
  }

  public resume() {
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }
}
