import { SERVER_SAMPLE_RATE, BYTES_PER_SAMPLE } from "./types";

export class AudioPlayer {
  private audioContext: AudioContext;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private nextStartTime: number = 0;

  constructor() {
    this.audioContext = new AudioContext({ sampleRate: SERVER_SAMPLE_RATE });
  }

  private convertPCMToAudioBuffer(pcmData: Uint8Array): AudioBuffer {
    // Validate input length matches our 16-bit sample expectation
    if (pcmData.length % BYTES_PER_SAMPLE !== 0) {
      throw new Error(`Invalid PCM data length ${pcmData.length}. Must be multiple of ${BYTES_PER_SAMPLE} bytes for 16-bit samples.`);
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
    console.log('Audio buffer stats:', {
      sampleRate: audioBuffer.sampleRate,
      length: audioBuffer.length,
      duration: audioBuffer.duration,
      maxSample,
      minSample
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
      this.audioQueue.push(audioBuffer);
      
      // Start playing if not already playing
      if (!this.isPlaying) {
        this.playNextInQueue();
      }
    } catch (error) {
      console.error('Error processing audio:', error);
    }
  }


  private playNextInQueue() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      this.nextStartTime = 0;
      return;
    }

    this.isPlaying = true;
    const audioBuffer = this.audioQueue.shift()!;

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    // If this is the first buffer or we're restarting
    if (this.nextStartTime === 0) {
      this.nextStartTime = this.audioContext.currentTime;
    }

    // Schedule this buffer to play at the exact time the previous one ends
    source.start(this.nextStartTime);

    // Calculate the next start time based on the current buffer's duration
    this.nextStartTime += audioBuffer.duration;

    // Schedule the next buffer slightly before this one ends
    const timeUntilNext = audioBuffer.duration - 0.02;
    setTimeout(() => {
      this.currentSource = null;
      this.playNextInQueue();
    }, timeUntilNext * 1000);

    this.currentSource = source;
  }

  public stop() {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
    this.isPlaying = false;
    this.audioQueue = [];
    this.nextStartTime = 0;
  }

  public resume() {
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}
