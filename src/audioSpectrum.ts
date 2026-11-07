/**
 * Offline and Real-Time Deterministic Audio Spectrum & FFT Engine
 * Extracts frequency bins and oscilloscope waveforms directly from decoded AudioBuffer.
 * Guarantees 100% identical spectrum visualization for both preview playback and offline video export.
 */

export interface AudioBlockRef {
  id: number;
  start: number;
  srcIn: number;
  srcOut: number;
  dur: number;
}

export interface SpectrumData {
  freqData: Uint8Array;   // 128 frequency bins (0..255)
  timeData: Uint8Array;   // 128 waveform samples (0..255, centered at 128)
  bassAvg: number;        // 0..1 bass energy for vibration/pulse
  peakFall: Float32Array; // 128 falling peak caps (0..1)
  isActive: boolean;      // True if music is playing at t
}

const FFT_SIZE = 2048;
const NUM_BINS = 128;
const MIN_FREQ = 40;
const MAX_FREQ = 12000;

// Precompute Hann window
const HANN_WINDOW = new Float32Array(FFT_SIZE);
for (let i = 0; i < FFT_SIZE; i++) {
  HANN_WINDOW[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
}

// In-place Radix-2 Cooley-Tukey FFT
function fftRadix2(re: Float32Array, im: Float32Array) {
  const n = re.length;
  // Bit reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }

  // Butterfly passes
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wStepR = Math.cos(ang);
    const wStepI = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wr = 1.0;
      let wi = 0.0;
      for (let j = 0; j < half; j++) {
        const tr = wr * re[i + j + half] - wi * im[i + j + half];
        const ti = wr * im[i + j + half] + wi * re[i + j + half];
        re[i + j + half] = re[i + j] - tr;
        im[i + j + half] = im[i + j] - ti;
        re[i + j] += tr;
        im[i + j] += ti;
        const nextWr = wr * wStepR - wi * wStepI;
        wi = wr * wStepI + wi * wStepR;
        wr = nextWr;
      }
    }
  }
}

// Precomputed log-frequency bin boundaries
interface BinRange {
  k0: number;
  k1: number;
}
let cachedSampleRate = 0;
let cachedBinRanges: BinRange[] = [];

function getBinRanges(sampleRate: number): BinRange[] {
  if (cachedSampleRate === sampleRate && cachedBinRanges.length === NUM_BINS) {
    return cachedBinRanges;
  }
  const nyquist = sampleRate / 2;
  const maxF = Math.min(MAX_FREQ, nyquist * 0.95);
  const ranges: BinRange[] = [];

  for (let b = 0; b < NUM_BINS; b++) {
    const f0 = MIN_FREQ * Math.pow(maxF / MIN_FREQ, b / NUM_BINS);
    const f1 = MIN_FREQ * Math.pow(maxF / MIN_FREQ, (b + 1) / NUM_BINS);
    const k0 = Math.max(1, Math.floor((f0 * FFT_SIZE) / sampleRate));
    const k1 = Math.max(k0 + 1, Math.min(FFT_SIZE / 2 - 1, Math.ceil((f1 * FFT_SIZE) / sampleRate)));
    ranges.push({ k0, k1 });
  }

  cachedSampleRate = sampleRate;
  cachedBinRanges = ranges;
  return ranges;
}

// Reference peak dB cache per AudioBuffer
const peakDbCache = new WeakMap<AudioBuffer, number>();

export function getAudioBufferPeakDb(buffer: AudioBuffer): number {
  if (peakDbCache.has(buffer)) {
    return peakDbCache.get(buffer)!;
  }
  const ch0 = buffer.getChannelData(0);
  const len = ch0.length;
  const step = Math.max(1, Math.floor(len / 1000));
  let maxAbs = 0.05;
  for (let i = 0; i < len; i += step) {
    const abs = Math.abs(ch0[i]);
    if (abs > maxAbs) maxAbs = abs;
  }
  const peakDb = 20 * Math.log10(Math.max(1e-4, maxAbs));
  peakDbCache.set(buffer, peakDb);
  return peakDb;
}

// Raw spectrum cache keyed by frame
const rawSpectrumCache = new Map<number, Float32Array>();
let lastCacheBuffer: AudioBuffer | null = null;

// Reusable scratch buffers for FFT
const scratchRe = new Float32Array(FFT_SIZE);
const scratchIm = new Float32Array(FFT_SIZE);
const scratchMag = new Float32Array(FFT_SIZE / 2);

function computeRawSpectrumAt(
  buffer: AudioBuffer,
  fileSec: number,
  peakDb: number,
  sens: number
): Float32Array {
  const sampleRate = buffer.sampleRate;
  const binRanges = getBinRanges(sampleRate);
  const centerSample = Math.round(fileSec * sampleRate);
  const startSample = centerSample - (FFT_SIZE >> 1);
  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;
  const bufLen = buffer.length;

  // Windowing with Hann
  for (let i = 0; i < FFT_SIZE; i++) {
    const idx = startSample + i;
    let sample = 0;
    if (idx >= 0 && idx < bufLen) {
      sample = (ch0[idx] + ch1[idx]) * 0.5;
    }
    scratchRe[i] = sample * HANN_WINDOW[i];
    scratchIm[i] = 0;
  }

  // FFT
  fftRadix2(scratchRe, scratchIm);

  // Magnitudes
  const halfFft = FFT_SIZE >> 1;
  for (let j = 0; j < halfFft; j++) {
    scratchMag[j] = Math.hypot(scratchRe[j], scratchIm[j]) / halfFft;
  }

  // Dynamic range settings
  const maxDb = peakDb + 3;
  const minDb = maxDb - 58;
  const dbSpan = maxDb - minDb;

  const rawBins = new Float32Array(NUM_BINS);
  for (let b = 0; b < NUM_BINS; b++) {
    const { k0, k1 } = binRanges[b];
    let peakVal = 0;
    let sumVal = 0;
    let count = 0;
    for (let k = k0; k < k1; k++) {
      const m = scratchMag[k];
      if (m > peakVal) peakVal = m;
      sumVal += m;
      count++;
    }
    const val = peakVal * 0.75 + (sumVal / Math.max(1, count)) * 0.25;
    const db = 20 * Math.log10(val + 1e-6);
    let norm = (db - minDb) / dbSpan;
    if (norm < 0) norm = 0;
    if (norm > 1) norm = 1;
    rawBins[b] = Math.min(1.0, norm * sens);
  }

  return rawBins;
}

/**
 * Returns deterministic audio spectrum & oscilloscope data at timeline time t.
 * Uses 8-step backward lookahead with Attack (~0.05s) / Release (~0.25s) filter
 * to guarantee identical results regardless of playback mode or export rendering.
 */
export function getSpectrum(
  t: number,
  buffer: AudioBuffer | null,
  audioBlocks: AudioBlockRef[],
  sens = 1.2
): SpectrumData {
  const result: SpectrumData = {
    freqData: new Uint8Array(NUM_BINS),
    timeData: new Uint8Array(NUM_BINS),
    bassAvg: 0,
    peakFall: new Float32Array(NUM_BINS),
    isActive: false
  };

  // Center line for oscilloscope when silent
  result.timeData.fill(128);

  if (!buffer || !audioBlocks || !audioBlocks.length) {
    return result;
  }

  // Clear cache if audio buffer changed
  if (lastCacheBuffer !== buffer) {
    rawSpectrumCache.clear();
    lastCacheBuffer = buffer;
  }

  // Find active block at timeline t
  let activeBlock: AudioBlockRef | null = null;
  let activeFileSec = 0;

  for (const b of audioBlocks) {
    if (t >= b.start && t < b.start + b.dur) {
      activeBlock = b;
      activeFileSec = b.srcIn + (t - b.start);
      break;
    }
  }

  if (!activeBlock) {
    // Outside audio blocks: return quiet spectrum
    return result;
  }

  result.isActive = true;
  const peakDb = getAudioBufferPeakDb(buffer);

  // Deterministic 8-step lookahead filter
  // Step size dt = 1/30s
  const DT = 1 / 30;
  const NUM_STEPS = 8;
  const attackAlpha = 1 - Math.exp(-DT / 0.05);  // ~0.487
  const releaseAlpha = 1 - Math.exp(-DT / 0.25); // ~0.125

  const smoothed = new Float32Array(NUM_BINS);
  const peakFall = new Float32Array(NUM_BINS);
  const peakSpeed = new Float32Array(NUM_BINS);

  for (let s = 0; s < NUM_STEPS; s++) {
    const stepT = t - (NUM_STEPS - 1 - s) * DT;
    let stepFileSec = -1;

    for (const b of audioBlocks) {
      if (stepT >= b.start && stepT < b.start + b.dur) {
        stepFileSec = b.srcIn + (stepT - b.start);
        break;
      }
    }

    let raw: Float32Array;
    if (stepFileSec < 0) {
      raw = new Float32Array(NUM_BINS);
    } else {
      const frameKey = Math.round(stepT * 60);
      const cached = rawSpectrumCache.get(frameKey);
      if (cached) {
        raw = cached;
      } else {
        raw = computeRawSpectrumAt(buffer, stepFileSec, peakDb, sens);
        if (rawSpectrumCache.size > 2000) {
          rawSpectrumCache.clear();
        }
        rawSpectrumCache.set(frameKey, raw);
      }
    }

    if (s === 0) {
      for (let b = 0; b < NUM_BINS; b++) {
        smoothed[b] = raw[b];
        peakFall[b] = raw[b];
      }
    } else {
      for (let b = 0; b < NUM_BINS; b++) {
        const val = raw[b];
        if (val > smoothed[b]) {
          smoothed[b] += attackAlpha * (val - smoothed[b]);
        } else {
          smoothed[b] += releaseAlpha * (val - smoothed[b]);
        }

        // Peak drop physics
        if (smoothed[b] > peakFall[b]) {
          peakFall[b] = smoothed[b];
          peakSpeed[b] = 0;
        } else {
          peakSpeed[b] += 0.012;
          peakFall[b] = Math.max(0, peakFall[b] - peakSpeed[b]);
        }
      }
    }
  }

  // Populate freqData (0..255)
  for (let b = 0; b < NUM_BINS; b++) {
    result.freqData[b] = Math.min(255, Math.round(smoothed[b] * 255));
  }
  result.peakFall = peakFall;

  // Compute bass average (lowest 8 bins)
  let bassSum = 0;
  for (let b = 0; b < 8; b++) {
    bassSum += smoothed[b];
  }
  result.bassAvg = Math.min(1.0, (bassSum / 8) * sens);

  // Populate timeData (128 waveform samples centered around activeFileSec)
  const centerSample = Math.round(activeFileSec * buffer.sampleRate);
  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;
  const bufLen = buffer.length;

  for (let i = 0; i < NUM_BINS; i++) {
    const sIdx = centerSample - 64 + i * 2;
    let s = 0;
    if (sIdx >= 0 && sIdx < bufLen) {
      s = (ch0[sIdx] + ch1[sIdx]) * 0.5;
    }
    result.timeData[i] = Math.max(0, Math.min(255, Math.round(128 + s * 127 * sens)));
  }

  return result;
}
