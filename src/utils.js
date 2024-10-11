export async function createAudioArray(audio) {
  let arrayBuffer = await audio.arrayBuffer();
  let audioBuffer = await new AudioContext().decodeAudioData(arrayBuffer);

  // Check if the audioBuffer is valid
  if (!audioBuffer || !(audioBuffer instanceof AudioBuffer)) {
    throw new Error('Invalid AudioBuffer');
  }

  let audioArray;
  if (audioBuffer.numberOfChannels === 2) {
    // For stereo audio, mix down to mono
    const SCALING_FACTOR = Math.sqrt(2);
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);

    audioArray = new Float32Array(left.length);
    for (let i = 0; i < audioBuffer.length; ++i) {
      audioArray[i] = SCALING_FACTOR * (left[i] + right[i]) / 2;
    }
  } else {
    // For mono audio, use the first channel
    audioArray = audioBuffer.getChannelData(0);
  }

  return audioArray;
}