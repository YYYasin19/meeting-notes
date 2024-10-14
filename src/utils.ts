import { WaveFile } from "wavefile";

export async function createAudioArray(audio: File) {
  let arrayBuffer = await audio.arrayBuffer();
  let audioBuffer = await new AudioContext().decodeAudioData(arrayBuffer);

  // Check if the audioBuffer is valid
  if (!audioBuffer || !(audioBuffer instanceof AudioBuffer)) {
    throw new Error("Invalid AudioBuffer");
  }

  let audioArray;
  if (audioBuffer.numberOfChannels === 2) {
    // For stereo audio, mix down to mono
    const SCALING_FACTOR = Math.sqrt(2);
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);

    audioArray = new Float32Array(left.length);
    for (let i = 0; i < audioBuffer.length; ++i) {
      audioArray[i] = (SCALING_FACTOR * (left[i] + right[i])) / 2;
    }
  } else {
    // For mono audio, use the first channel
    audioArray = audioBuffer.getChannelData(0);
  }

  return audioArray;
}

export async function wavAudioFromUrl(
  input: string | Float32Array
): Promise<Float32Array> {
  let buffer: Uint8Array;
  if (typeof input === "string") {
    let response = await fetch(input);
    let arrayBuffer = await response.arrayBuffer();
    buffer = new Uint8Array(arrayBuffer);
  } else {
    buffer = new Uint8Array(input);
  }

  // Read .wav file and convert it to required format
  let wav = new WaveFile(buffer);
  wav.toBitDepth("32f"); // Pipeline expects input as a Float32Array
  wav.toSampleRate(16000); // Whisper expects audio with a sampling rate of 16000
  let audioData = wav.getSamples();
  if (Array.isArray(audioData)) {
    if (audioData.length > 1) {
      const SCALING_FACTOR = Math.sqrt(2);

      // Merge channels (into first channel to save memory)
      for (let i = 0; i < audioData[0].length; ++i) {
        audioData[0][i] =
          (SCALING_FACTOR * (audioData[0][i] + audioData[1][i])) / 2;
      }
    }

    // Select first channel
    audioData = audioData[0];
  }

  return new Float32Array(audioData); // Convert to Float32Array before returning
}
