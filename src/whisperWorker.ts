import { pipeline, env } from '@huggingface/transformers';

// Cấu hình môi trường Transformers.js trong Web Worker
env.allowLocalModels = false;
env.useBrowserCache = true;

interface WorkerMessageData {
  type: 'start' | 'cancel';
  audioData?: Float32Array; // 16kHz mono audio
  sampleRate?: number;
  modelKey?: 'tiny' | 'base' | 'small';
  language?: string;
  chunkDuration?: number; // 30s default
}

let activeTranscriber: any = null;
let currentModelKey = '';
let isCancelled = false;

// Bảng ánh xạ model Whisper đa ngữ chuẩn ONNX Web
const MODELS: Record<string, { id: string; sizeText: string }> = {
  tiny: { id: 'onnx-community/whisper-tiny', sizeText: '~75 MB' },
  base: { id: 'onnx-community/whisper-base', sizeText: '~145 MB' },
  small: { id: 'onnx-community/whisper-small', sizeText: '~460 MB' }
};

self.onmessage = async (e: MessageEvent<WorkerMessageData>) => {
  const { type } = e.data;

  if (type === 'cancel') {
    isCancelled = true;
    self.postMessage({ type: 'cancelled' });
    return;
  }

  if (type === 'start') {
    isCancelled = false;
    const { audioData, modelKey = 'base', language = 'vi' } = e.data;

    if (!audioData || audioData.length === 0) {
      self.postMessage({ type: 'error', error: 'Dữ liệu âm thanh trống.' });
      return;
    }

    try {
      const modelInfo = MODELS[modelKey] || MODELS.base;

      // 1. Kiểm tra hỗ trợ WebGPU
      let hasWebGPU = false;
      try {
        if ('gpu' in navigator && (navigator as any).gpu) {
          const adapter = await (navigator as any).gpu.requestAdapter();
          if (adapter) hasWebGPU = true;
        }
      } catch (err) {
        hasWebGPU = false;
      }

      self.postMessage({
        type: 'device_info',
        hasWebGPU,
        device: hasWebGPU ? 'webgpu' : 'wasm',
        modelSize: modelInfo.sizeText
      });

      // 2. Khởi tạo Pipeline nhận dạng giọng nói nếu chưa nạp hoặc đổi model
      if (!activeTranscriber || currentModelKey !== modelKey) {
        self.postMessage({
          type: 'status',
          status: 'loading_model',
          message: `Đang tải model Whisper (${modelInfo.sizeText})...`
        });

        const device = hasWebGPU ? 'webgpu' : 'wasm';
        const dtype = hasWebGPU ? 'fp32' : 'q8';

        activeTranscriber = await pipeline(
          'automatic-speech-recognition',
          modelInfo.id,
          {
            device,
            dtype,
            progress_callback: (p: any) => {
              if (isCancelled) return;
              if (p.status === 'progress' && typeof p.progress === 'number') {
                self.postMessage({
                  type: 'download_progress',
                  file: p.file || 'model',
                  progress: Math.round(p.progress)
                });
              }
            }
          }
        );
        currentModelKey = modelKey;
      }

      if (isCancelled) {
        self.postMessage({ type: 'cancelled' });
        return;
      }

      // 3. Xử lý âm thanh theo từng phân đoạn (Chunking 30s với 2.5s overlap)
      const sampleRate = 16000;
      const chunkSec = 30;
      const overlapSec = 2.5;
      const chunkSamples = chunkSec * sampleRate;
      const stepSamples = (chunkSec - overlapSec) * sampleRate;
      const totalSamples = audioData.length;
      const totalSec = totalSamples / sampleRate;

      const recognizedWords: Array<{ text: string; start: number; end: number }> = [];

      let sampleOffset = 0;
      let chunkIdx = 0;
      const totalChunks = Math.max(1, Math.ceil((totalSamples - overlapSec * sampleRate) / stepSamples));

      while (sampleOffset < totalSamples) {
        if (isCancelled) {
          self.postMessage({ type: 'cancelled' });
          return;
        }

        const chunkEnd = Math.min(sampleOffset + chunkSamples, totalSamples);
        const chunk = audioData.subarray(sampleOffset, chunkEnd);
        const chunkStartSec = sampleOffset / sampleRate;
        const chunkPercent = Math.min(99, Math.round((chunkIdx / totalChunks) * 100));

        self.postMessage({
          type: 'status',
          status: 'transcribing',
          progress: chunkPercent,
          message: `Đang nghe và nhận dạng giọng hát (${chunkPercent}%)...`
        });

        // Chạy Whisper nhận dạng kèm word timestamps
        const out: any = await activeTranscriber(chunk, {
          language: language === 'auto' ? undefined : language,
          task: 'transcribe',
          return_timestamps: 'word',
          chunk_length_s: 30,
          stride_length_s: 5
        });

        if (out) {
          // Lấy danh sách từ từ chunks hoặc words
          const wordsList: any[] = out.chunks || [];
          for (const item of wordsList) {
            const wordTxt = (item.text || '').trim();
            if (!wordTxt) continue;
            const ts = item.timestamp;
            if (Array.isArray(ts) && ts.length === 2) {
              const startT = Math.max(0, (ts[0] ?? 0) + chunkStartSec);
              const endT = Math.max(startT + 0.1, (ts[1] ?? ts[0] + 0.3) + chunkStartSec);

              // Khử trùng lặp chữ ở vùng overlap
              const prev = recognizedWords[recognizedWords.length - 1];
              if (prev && prev.text.toLowerCase() === wordTxt.toLowerCase() && Math.abs(prev.start - startT) < 1.2) {
                // Đã có từ này ở mép trước, cập nhật giờ nếu chính xác hơn
                prev.end = Math.max(prev.end, endT);
              } else {
                recognizedWords.push({
                  text: wordTxt,
                  start: parseFloat(startT.toFixed(2)),
                  end: parseFloat(endT.toFixed(2))
                });
              }
            }
          }
        }

        sampleOffset += stepSamples;
        chunkIdx++;
      }

      if (isCancelled) {
        self.postMessage({ type: 'cancelled' });
        return;
      }

      self.postMessage({
        type: 'status',
        status: 'done',
        progress: 100,
        message: 'Hoàn tất nghe nhạc, đang đối khớp lời bài hát...'
      });

      self.postMessage({
        type: 'transcribe_complete',
        words: recognizedWords,
        totalAudioSec: totalSec
      });

    } catch (err: any) {
      console.error('[WhisperWorker] Lỗi:', err);
      self.postMessage({
        type: 'error',
        error: err?.message || String(err)
      });
    }
  }
};
