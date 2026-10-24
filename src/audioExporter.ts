import { Mp3Encoder } from '@breezystack/lamejs';

export interface TrimOptions {
  start: number;
  end: number;
  vol?: number;
  fadeIn?: number;
  fadeOut?: number;
}

/**
 * Renders a trimmed slice of an AudioBuffer with exact volume and linear fadeIn/fadeOut envelopes.
 */
export async function renderTrimmedAudio(
  origBuffer: AudioBuffer,
  options: TrimOptions
): Promise<AudioBuffer> {
  const sampleRate = origBuffer.sampleRate;
  const numChannels = origBuffer.numberOfChannels;
  const origDur = origBuffer.duration;

  const start = Math.max(0, Math.min(options.start, origDur));
  const rawEnd = (options.end > start && options.end <= origDur) ? options.end : origDur;
  const duration = Math.max(0.05, rawEnd - start);
  const totalFrames = Math.max(1, Math.ceil(duration * sampleRate));

  const OfflineCtxClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const offlineCtx = new OfflineCtxClass(numChannels, totalFrames, sampleRate);

  const source = offlineCtx.createBufferSource();
  source.buffer = origBuffer;

  const gain = offlineCtx.createGain();
  const vol = options.vol !== undefined ? Math.max(0, Math.min(2, options.vol)) : 1.0;
  const fadeIn = Math.max(0, Math.min(options.fadeIn ?? 0, duration));
  const fadeOut = Math.max(0, Math.min(options.fadeOut ?? 0, duration));

  // Base gain envelope
  if (fadeIn > 0) {
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(vol, fadeIn);
  } else {
    gain.gain.setValueAtTime(vol, 0);
  }

  if (fadeOut > 0) {
    const fadeOutStart = Math.max(fadeIn, duration - fadeOut);
    gain.gain.setValueAtTime(vol, fadeOutStart);
    gain.gain.linearRampToValueAtTime(0, duration);
  }

  source.connect(gain);
  gain.connect(offlineCtx.destination);

  source.start(0, start, duration);

  return await offlineCtx.startRendering();
}

/**
 * Encodes an AudioBuffer into 16-bit PCM WAV (RIFF/WAVE container).
 */
export function audioBufferToWav(buffer: AudioBuffer): Uint8Array {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numFrames = buffer.length;
  const dataByteCount = numFrames * blockAlign;
  const bufferLength = 44 + dataByteCount;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataByteCount, true);
  writeString(8, 'WAVE');

  // fmt subchunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data subchunk
  writeString(36, 'data');
  view.setUint32(40, dataByteCount, true);

  // Extract channel data
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  // Write interleaved 16-bit signed PCM samples
  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Uint8Array(arrayBuffer);
}

/**
 * Encodes an AudioBuffer into MP3 using pure-JS lamejs.
 */
export function audioBufferToMp3(buffer: AudioBuffer, kbps = 192): Uint8Array {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const encoder = new Mp3Encoder(channels, sampleRate, kbps);

  const numSamples = buffer.length;
  const leftF = buffer.getChannelData(0);
  const leftInt16 = new Int16Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, leftF[i]));
    leftInt16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  let rightInt16: Int16Array | undefined;
  if (channels > 1) {
    const rightF = buffer.getChannelData(1);
    rightInt16 = new Int16Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, rightF[i]));
      rightInt16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
  }

  const mp3Chunks: Uint8Array[] = [];
  const chunkSize = 1152;
  for (let i = 0; i < numSamples; i += chunkSize) {
    const leftChunk = leftInt16.subarray(i, i + chunkSize);
    const rightChunk = rightInt16 ? rightInt16.subarray(i, i + chunkSize) : undefined;
    const mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf && mp3buf.length > 0) {
      mp3Chunks.push(mp3buf);
    }
  }

  const endBuf = encoder.flush();
  if (endBuf && endBuf.length > 0) {
    mp3Chunks.push(endBuf);
  }

  const totalLength = mp3Chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of mp3Chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Triggers a browser file download for a given Blob.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {}
  }, 2000);
}
