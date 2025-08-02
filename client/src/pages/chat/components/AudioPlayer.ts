import { SERVER_SAMPLE_RATE, BYTES_PER_SAMPLE } from "../../../types";

export type Base64AudioBuffer = {
  data: string; // audio data encoded in base64
  mime_type: string;
};

export class AudioPlayer {
  private audioContext: AudioContext;
  private scheduledSources: AudioBufferSourceNode[] = [];
  private nextStartTime: number = 0;

  constructor() {
    this.audioContext = new AudioContext({ sampleRate: SERVER_SAMPLE_RATE });
  }

  private async loadAudioBuffer(
    audioData: Uint8Array,
    mimeType: string
  ): Promise<AudioBuffer> {
    try {
      // Use the Web Audio API's decodeAudioData to handle various formats
      const arrayBuffer = audioData.buffer.slice(0);
      // @ts-ignore - ArrayBufferLike compatibility issue
      return await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error("Error decoding audio data:", error);
      throw new Error(`Failed to decode audio data of type ${mimeType}`);
    }
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

  private async decodeAudioData(
    audioData: Base64AudioBuffer
  ): Promise<AudioBuffer> {
    // Convert base64 to ArrayBuffer
    const binaryString = atob(audioData.data);
    const rawData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      rawData[i] = binaryString.charCodeAt(i);
    }

    // Handle PCM or other formats
    return audioData.mime_type === "audio/pcm"
      ? this.convertPCMToAudioBuffer(rawData)
      : await this.loadAudioBuffer(rawData, audioData.mime_type);
  }

  public async addAudioToQueue(audioData: Base64AudioBuffer): Promise<void> {
    const audioBuffer = await this.decodeAudioData(audioData);

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    // Reset or update the next start time
    if (this.nextStartTime <= this.audioContext.currentTime) {
      this.nextStartTime = this.audioContext.currentTime;
    }

    source.start(this.nextStartTime);
    this.scheduledSources.push(source);
    this.nextStartTime += audioBuffer.duration;
  }

  // Add `buffers` to the audio queue and return a promise that resolves when all buffers have been played.
  public playAudioBlocking(buffers: Base64AudioBuffer[]): Promise<void> {
    return new Promise(async (resolve) => {
      console.log("Playing audio buffers:", buffers);
      this.stop();

      for (const buffer of buffers) {
        await this.addAudioToQueue(buffer);
      }

      console.log("Scheduled audio buffers:", this.scheduledSources);

      // Listen for the last buffer to complete
      if (this.scheduledSources.length > 0) {
        console.log("Listening for last audio buffer to complete.");
        const lastSource =
          this.scheduledSources[this.scheduledSources.length - 1];
        lastSource.addEventListener("ended", () => {
          console.log("All audio buffers played.");
          resolve();
        });
      } else {
        console.log("No audio buffers to play.");
        resolve();
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
  }

  public resume() {
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }
}
