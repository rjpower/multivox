export class AudioPlayer {
  private audioContext: AudioContext;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying = false;
  private currentSource: AudioBufferSourceNode | null = null;

  constructor() {
    this.audioContext = new AudioContext();
  }

  private convertPCMToAudioBuffer(pcmData: Uint8Array): AudioBuffer {
    // Create an audio buffer (mono channel, 24kHz sample rate)
    const audioBuffer = this.audioContext.createBuffer(1, pcmData.length / 2, 24000);
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
      return;
    }

    this.isPlaying = true;
    const audioBuffer = this.audioQueue.shift()!;
    
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    
    source.onended = () => {
      this.currentSource = null;
      this.playNextInQueue();
    };

    this.currentSource = source;
    source.start();
  }

  public stop() {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
    this.isPlaying = false;
    this.audioQueue = [];
  }

  public resume() {
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}
