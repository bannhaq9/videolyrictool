/**
 * Lyric Video Studio core logic
 * Preserves 100% of original canvas drawing, timing, audio sync, and MediaRecorder export logic.
 */
import { renderTrimmedAudio, audioBufferToWav, audioBufferToMp3, downloadBlob } from './audioExporter';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
    claude?: any;
  }
}
export function initStudio() {
  const $ = (s: string) => document.querySelector(s) as any;
  const safeClick = (sel: string, fn: (e: any) => void) => {
    const el = $(sel);
    if (el) el.onclick = fn;
  };
  const safeChange = (sel: string, fn: (e: any) => void) => {
    const el = $(sel);
    if (el) el.onchange = fn;
  };
  const safeInput = (sel: string, fn: (e: any) => void) => {
    const el = $(sel);
    if (el) el.oninput = fn;
  };
  const safeOn = (sel: string, ev: string, fn: (e: any) => void) => {
    const el = $(sel);
    if (el) el.addEventListener(ev, fn);
  };
  const FONTS = ['Be Vietnam Pro', 'Montserrat', 'Playfair Display', 'Oswald', 'Quicksand', 'Dancing Script', 'Lobster', 'Pacifico'];
  const FX: Record<string, string> = { none: 'Đứng yên', zoomin: 'Zoom vào', zoomout: 'Zoom ra', panl: 'Lướt sang trái', panr: 'Lướt sang phải' };
  const TR_GROUPS = [
    {
      group: 'Cơ bản',
      items: [
        { key: 'none', label: 'Cắt thẳng', icon: '✂️' },
        { key: 'fade', label: 'Mờ dần (cross-fade)', icon: '◐' },
        { key: 'fadeblack', label: 'Qua đen', icon: '🌑' },
        { key: 'fadewhite', label: 'Qua trắng', icon: '🌕' }
      ]
    },
    {
      group: 'Trượt',
      items: [
        { key: 'slideleft', label: 'Trượt trái', icon: '⬅️' },
        { key: 'slideright', label: 'Trượt phải', icon: '➡️' },
        { key: 'slideup', label: 'Trượt lên', icon: '⬆️' },
        { key: 'slidedown', label: 'Trượt xuống', icon: '⬇️' },
        { key: 'push', label: 'Đẩy (push)', icon: '⏩' }
      ]
    },
    {
      group: 'Quét',
      items: [
        { key: 'wiper', label: 'Quét ngang', icon: '↔️' },
        { key: 'wiped', label: 'Quét dọc', icon: '↕️' },
        { key: 'circleopen', label: 'Mở vòng tròn', icon: '🔘' },
        { key: 'centeropen', label: 'Mở từ giữa ra', icon: '🚪' }
      ]
    },
    {
      group: 'Phóng',
      items: [
        { key: 'zoom', label: 'Zoom vào', icon: '🔍' },
        { key: 'zoomout', label: 'Zoom ra', icon: '🔎' },
        { key: 'spin', label: 'Xoay nhẹ', icon: '🌀' }
      ]
    },
    {
      group: 'Phong cách',
      items: [
        { key: 'blur', label: 'Nhòe (blur)', icon: '🌫️' },
        { key: 'flash', label: 'Flash sáng', icon: '⚡' },
        { key: 'glitch', label: 'Glitch RGB', icon: '👾' },
        { key: 'flip', label: 'Lật 3D', icon: '🃏' }
      ]
    },
    {
      group: 'Lựa chọn',
      items: [
        { key: 'random', label: 'Ngẫu nhiên', icon: '🎲' }
      ]
    }
  ];
  const TR: Record<string, string> = {};
  const TR_ICONS: Record<string, string> = {};
  TR_GROUPS.forEach(g => g.items.forEach(it => {
    TR[it.key] = it.label;
    TR_ICONS[it.key] = it.icon;
  }));
  const CONCRETE_TR = [
    'fade', 'fadeblack', 'fadewhite',
    'slideleft', 'slideright', 'slideup', 'slidedown', 'push',
    'wiper', 'wiped', 'circleopen', 'centeropen',
    'zoom', 'zoomout', 'spin',
    'blur', 'flash', 'glitch', 'flip'
  ];
  function getEffectiveTr(trName: string, clipId: number, index: number): string {
    if (trName === 'slide') return 'slideleft';
    if (trName === 'wipel') return 'wiper';
    if (trName === 'wipeu') return 'wiped';
    if (trName === 'circleclose') return 'circleopen';
    if (trName === 'mosaic') return 'glitch';
    if (trName !== 'random') return trName;
    const idx = Math.abs((clipId * 9301 + 49297 + index * 233) % CONCRETE_TR.length);
    return CONCRETE_TR[idx];
  }
  const COL: Record<string, string> = { none: 'Gốc', warm: 'Ấm', cool: 'Lạnh', bw: 'Đen trắng', punch: 'Rực rỡ' };
  const FILTERS: Record<string, string> = {
    none: 'none',
    warm: 'sepia(.25) saturate(1.2) brightness(1.03)',
    cool: 'hue-rotate(-12deg) saturate(1.1) brightness(1.02)',
    bw: 'grayscale(1)',
    punch: 'contrast(1.2) saturate(1.3)'
  };
  const SAMPLE_LYR = '[00:00.50] Sáng nay nắng lên rất hiền\n[00:03.00] Ta đi qua phố quen\n[00:05.50] Gió đưa mùi hoa sữa\n[00:08.00] Một ngày mới bắt đầu';

  interface Clip {
    id: number;
    type: 'image' | 'video';
    name: string;
    el: any;
    url: string;
    dur: number;
    srcIn: number;
    srcOut: number;
    full: number;
    fit: string;
    fx: string;
    tr: string;
    trDur: number;
    color: string;
    thumb: string;
    sample: boolean;
  }

  interface LyricItem {
    id: number;
    t: number;
    endT: number;
    text: string;
    color?: string;
    hi?: string;
    size?: number;
  }

  interface AudioBlock {
    id: number;
    start: number; // timeline start (seconds)
    srcIn: number; // slice start in audio file (seconds)
    srcOut: number; // slice end in audio file (seconds)
    dur: number; // duration (srcOut - srcIn)
  }

  const S = {
    orient: 'v',
    res: 720,
    clips: [] as Clip[],
    sel: null as number | null,
    selLyrId: null as number | null,
    audioBlocks: [] as AudioBlock[],
    selAudioId: null as number | null,
    t: 0,
    playing: false,
    sample: true,
    pps: 60,
    lyr: [] as LyricItem[],
    style: {
      font: 'Be Vietnam Pro',
      size: 7,
      weight: '700',
      color: '#ffffff',
      hi: '#ffd23f',
      karaoke: true,
      outW: 6,
      outColor: '#000000',
      shadow: true,
      box: 0,
      y: 74,
      next: true,
      upper: false,
      anim: 'fade' as 'fade' | 'rise' | 'pop' | 'type' | 'slide'
    },
    title: { text: '', dur: 3 },
    def: { dur: 4, fit: 'cover', fx: 'zoomin', tr: 'fade', trDur: 0.6 },
    syncWithMusic: false,
    syncMusicMode: 'even' as 'even' | 'extendLast',
    speed: 1.0,
    viz: {
      type: 'bars' as 'none' | 'bars' | 'mirror' | 'circle' | 'wave' | 'dots' | 'ribbon' | 'ring' | 'ecg' | 'polygon' | 'stereo' | 'flame' | 'blob' | 'mountain',
      color: '#00f0ff',
      color2: '#ff007f',
      colorMode: 'gradient' as 'solid' | 'gradient' | 'rainbow',
      y: 82,
      x: 50,
      size: 1.0,
      sens: 1.2,
      bars: 32,
      glow: true,
      logoUrl: '',
      logoImg: null as HTMLImageElement | null
    }
  };

  const A = {
    el: new Audio(),
    loaded: false,
    name: '',
    dur: 0,
    peaks: [] as number[],
    vol: 1,
    prevVol: 1,
    start: 0,
    end: 0,
    fadeIn: 0,
    fadeOut: 1,
    wfZoom: 1,
    fade: true,
    ctx: null as AudioContext | null,
    buffer: null as AudioBuffer | null,
    sourceNode: null as AudioBufferSourceNode | null,
    sourceStartSec: 0,
    sourceAudioCtxTime: 0,
    currentAudioBlockId: null as number | null,
    gain: null as GainNode | null,
    eqBass: null as BiquadFilterNode | null,
    eqMid: null as BiquadFilterNode | null,
    eqTreble: null as BiquadFilterNode | null,
    compressor: null as DynamicsCompressorNode | null,
    analyser: null as AnalyserNode | null,
    dest: null as MediaStreamAudioDestinationNode | null,
    srcNode: null as MediaElementAudioSourceNode | null,
    url: '',
    file: null as File | null,
    loadState: 'Chưa tải',
    error: '',
    isPreviewing: false,
    previewSourceNode: null as AudioBufferSourceNode | null,
    previewStartTime: 0,
    previewOffset: 0,
    isTrimPreviewing: false,
    trimSourceNode: null as AudioBufferSourceNode | null,
    trimStartTime: 0,
    rawPeaks: [] as number[]
  };
  A.el.preload = 'auto';
  A.el.crossOrigin = 'anonymous';
  A.el.preservesPitch = true;
  (A.el as any).webkitPreservesPitch = true;
  (A.el as any).mozPreservesPitch = true;

  let uid = 0, lyrUid = 0, audioUid = 0, raf = 0, t0 = 0, tbase = 0, endCb: (() => Promise<void> | void) | null = null,
      exporting = false, expCancel = false, expBlob: Blob | null = null, expName = '', expRec: MediaRecorder | null = null;
  const cv: HTMLCanvasElement = $('#cv'), ctx = cv.getContext('2d')!;
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const ease = (k: number) => k * k * (3 - 2 * k);
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const esc = (s: any) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c));
  const fmt = (t: number) => {
    t = Math.max(0, t);
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + (t % 60).toFixed(2).padStart(5, '0');
  };
  const fmtSec = (t: number) => {
    t = Math.max(0, Math.floor(t));
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  };

  let toastTimer: any = 0;
  function toast(m: string) {
    const e = $('#toast');
    if (!e) return;
    e.textContent = m;
    e.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { e.hidden = true; }, 3200);
  }

  /* ---------- kích thước khung ---------- */
  function dims() {
    const sh = S.res, lg = Math.round(S.res * 16 / 9 / 2) * 2;
    return S.orient === 'v' ? { W: sh, H: lg } : { W: lg, H: sh };
  }
  function setSize() {
    const d = dims();
    cv.width = d.W;
    cv.height = d.H;
    fitStage();
  }
  function fitStage() {
    const st = $('#stage');
    if (!st) return;
    const aw = Math.max(160, st.clientWidth > 16 ? st.clientWidth - 16 : 360);
    const ah = Math.max(160, st.clientHeight > 16 ? st.clientHeight - 16 : 360);
    const sc = Math.min(aw / cv.width, ah / cv.height);
    cv.style.width = Math.floor(cv.width * sc) + 'px';
    cv.style.height = Math.floor(cv.height * sc) + 'px';
  }

  /* ---------- clip ---------- */
  function newClip(o: Partial<Clip>): Clip {
    return Object.assign({
      id: ++uid,
      type: 'image',
      name: '',
      el: null,
      url: '',
      dur: 4,
      srcIn: 0,
      srcOut: 0,
      full: 0,
      fit: S.def.fit,
      fx: S.def.fx,
      tr: S.def.tr,
      trDur: S.def.trDur || 0.6,
      color: 'none',
      thumb: '',
      sample: false
    }, o) as Clip;
  }
  const audioTrackEnd = () => {
    if (!A.loaded || !S.audioBlocks.length) return 0;
    return S.audioBlocks.reduce((max, b) => Math.max(max, b.start + b.dur), 0);
  };

  const musicDuration = () => {
    return audioTrackEnd();
  };

  const total = () => {
    if (A.loaded && S.audioBlocks.length > 0) {
      const aEnd = audioTrackEnd();
      if (aEnd > 0) return Math.max(0.5, aEnd);
    }
    return Math.max(0.5, S.clips.reduce((a, c) => a + c.dur, 0));
  };

  function autoFitImagesToMusic(showToast = false) {
    if (!A.loaded || !S.audioBlocks.length) return;
    const targetTotal = total();
    const imgs = S.clips.filter(c => c.type === 'image');
    if (!imgs.length) return;

    const vids = S.clips.filter(c => c.type === 'video');
    const vidsDur = vids.reduce((a, c) => a + c.dur, 0);

    const rem = targetTotal - vidsDur;
    if (rem <= 0) return;

    const each = rem / imgs.length;
    let accum = 0;
    imgs.forEach((c, idx) => {
      if (idx === imgs.length - 1) {
        c.dur = Math.max(0.3, Math.round((rem - accum) * 100) / 100);
      } else {
        const d = Math.max(0.3, Math.round(each * 100) / 100);
        c.dur = d;
        accum += d;
      }
    });
    if (showToast) toast('Độ dài video tự khớp với đoạn nhạc (' + fmt(targetTotal) + ').');
  }

  function applyMusicSync(showToast = false) {
    autoFitImagesToMusic(showToast);
    refreshAll();
  }

  function getActiveAudioAt(t: number): { block: AudioBlock; fileSec: number } | null {
    if (!A.loaded || !S.audioBlocks.length) return null;
    for (const b of S.audioBlocks) {
      if (t >= b.start && t < b.start + b.dur) {
        const offset = t - b.start;
        const fileSec = b.srcIn + offset;
        return { block: b, fileSec };
      }
    }
    return null;
  }
  function locate(t: number) {
    let a = 0;
    for (let i = 0; i < S.clips.length; i++) {
      const c = S.clips[i];
      if (t < a + c.dur || i === S.clips.length - 1) return { i, local: clamp(t - a, 0, c.dur), start: a };
      a += c.dur;
    }
    return null;
  }
  function once(el: HTMLElement, ev: string) {
    return new Promise<void>((res, rej) => {
      const ok = () => { el.removeEventListener(ev, ok); el.removeEventListener('error', bad); res(); };
      const bad = () => { el.removeEventListener(ev, ok); el.removeEventListener('error', bad); rej(new Error('load')); };
      el.addEventListener(ev, ok);
      el.addEventListener('error', bad);
    });
  }
  function makeVideo(url: string) {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = url;
    v.addEventListener('seeked', () => { if (!S.playing) draw(); });
    return v;
  }
  function thumbFrom(el: any) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const x = c.getContext('2d')!;
    const w = el.videoWidth || el.naturalWidth || el.width || 1;
    const h = el.videoHeight || el.naturalHeight || el.height || 1;
    const s = Math.max(128 / w, 128 / h);
    try { x.drawImage(el, (128 - w * s) / 2, (128 - h * s) / 2, w * s, h * s); } catch (e) {}
    return c.toDataURL('image/jpeg', 0.7);
  }
  async function addImage(f: File) {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.src = url;
    try { await img.decode(); } catch (e) { await once(img, 'load'); }
    const c = newClip({ type: 'image', name: f.name, el: img, url, dur: S.def.dur });
    c.thumb = thumbFrom(img);
    S.clips.push(c);
  }
  async function addVideo(f: File) {
    const url = URL.createObjectURL(f);
    const v = makeVideo(url);
    await once(v, 'loadedmetadata');
    const d = v.duration || 1;
    const c = newClip({ type: 'video', name: f.name, el: v, url, dur: d, srcIn: 0, srcOut: d, full: d, fit: 'cover', fx: 'none', tr: S.def.tr });
    try {
      v.currentTime = Math.min(0.1, d / 2);
      await once(v, 'seeked');
      c.thumb = thumbFrom(v);
    } catch (e) {}
    S.clips.push(c);
  }
  function clearSample() {
    if (!S.sample) return;
    S.sample = false;
    S.clips = S.clips.filter(c => !c.sample);
    const lyrEl = $('#lyr') as HTMLTextAreaElement | null;
    if (lyrEl && lyrEl.value.trim() === SAMPLE_LYR) {
      lyrEl.value = '';
      S.lyr = [];
      const rawEl = $('#lyrRawInput') as HTMLTextAreaElement | null;
      if (rawEl) rawEl.value = '';
      renderLyricUI();
    }
    const sn = $('#sampleNote');
    if (sn) sn.hidden = true;
  }
  async function addFiles(files: FileList | File[]) {
    const list = [...files];
    if (!list.length) return;
    clearSample();
    let n = 0;
    for (const f of list) {
      try {
        if (f.type.startsWith('image/')) { await addImage(f); n++; }
        else if (f.type.startsWith('video/')) { await addVideo(f); n++; }
        else if (f.type.startsWith('audio/')) { await loadAudio(f); }
        else toast('Bỏ qua file không hỗ trợ: ' + f.name);
      } catch (e) {
        toast('Không đọc được file: ' + f.name);
      }
    }
    if (n && !S.sel) S.sel = S.clips[0]?.id ?? null;
    if (n) S.sel = S.clips[S.clips.length - 1].id;
    if (A.loaded) autoFitImagesToMusic();
    refreshAll();
  }
  function makeSample(i: number) {
    const pal = [
      ['#ff9a56', '#ff5e7e', '#ffd27a', '#3b2a4d'],
      ['#27c4c4', '#0b6e8a', '#e8fbff', '#0a3d52'],
      ['#6a5acd', '#d46a9f', '#ffd1a8', '#2a1f4f'],
      ['#8bd36a', '#2f9e63', '#fff6a8', '#12503a']
    ][i];
    const c = document.createElement('canvas');
    c.width = 1280; c.height = 720;
    const x = c.getContext('2d')!;
    const g = x.createLinearGradient(0, 0, 0, 720);
    g.addColorStop(0, pal[0]);
    g.addColorStop(0.62, pal[1]);
    g.addColorStop(1, pal[3]);
    x.fillStyle = g;
    x.fillRect(0, 0, 1280, 720);
    x.fillStyle = pal[2];
    x.globalAlpha = 0.95;
    x.beginPath();
    x.arc(300 + i * 220, 330, 96, 0, 7);
    x.fill();
    x.globalAlpha = 1;
    x.fillStyle = pal[3];
    x.globalAlpha = 0.55;
    x.beginPath();
    x.moveTo(0, 720);
    x.quadraticCurveTo(320, 430, 640, 560);
    x.quadraticCurveTo(940, 670, 1280, 480);
    x.lineTo(1280, 720);
    x.fill();
    x.globalAlpha = 0.85;
    x.beginPath();
    x.moveTo(0, 720);
    x.quadraticCurveTo(420, 560, 820, 650);
    x.quadraticCurveTo(1060, 700, 1280, 610);
    x.lineTo(1280, 720);
    x.fill();
    x.globalAlpha = 1;
    return c;
  }
  function loadSample() {
    ['dawn', 'sea', 'dusk', 'meadow'].forEach((_n, i) => {
      const el = makeSample(i);
      const c = newClip({
        type: 'image',
        name: i === 0 ? 'Hoa nở bên tường.jpg' : ('Ảnh mẫu ' + (i + 1)),
        el,
        dur: i === 0 ? 4 : 3,
        sample: true,
        fx: ['zoomin', 'panl', 'zoomout', 'panr'][i],
        tr: i ? 'fade' : 'none'
      });
      c.thumb = thumbFrom(el);
      S.clips.push(c);
    });
    S.sel = S.clips[0].id;
    const lyrEl = $('#lyr') as HTMLTextAreaElement | null;
    if (lyrEl) lyrEl.value = SAMPLE_LYR;
    S.lyr = parseLyr(SAMPLE_LYR);
    const rawEl = $('#lyrRawInput') as HTMLTextAreaElement | null;
    if (rawEl) rawEl.value = rawLyricLines().join('\n');
    switchLyricStep(1);

    // Tải ảnh mẫu bức tranh hoa nở từ tệp mẫu
    const imgArt = new Image();
    imgArt.crossOrigin = 'anonymous';
    imgArt.onload = () => {
      try {
        const cropC = document.createElement('canvas');
        cropC.width = 720;
        cropC.height = 1280;
        const cx = cropC.getContext('2d')!;
        cx.drawImage(imgArt, 746, 146, 126, 280, 0, 0, 720, 1280);
        if (S.sample && S.clips[0]) {
          S.clips[0].el = cropC;
          S.clips[0].thumb = thumbFrom(cropC);
          S.clips[0].name = 'Hoa nở bên tường.jpg';
          renderTimeline();
          renderMediaDrawerCards();
          draw();
        }
      } catch (e) {}
    };
    imgArt.src = '/assets/aistudio/image_3edd8ee8.png';
  }

  /* ---------- vẽ khung hình & hiệu ứng chuyển cảnh ---------- */
  const bgc = document.createElement('canvas'), bgx = bgc.getContext('2d')!;
  const buf1 = document.createElement('canvas'), bctx1 = buf1.getContext('2d')!;
  const buf2 = document.createElement('canvas'), bctx2 = buf2.getContext('2d')!;
  function syncBufSize(W: number, H: number) {
    if (buf1.width !== W || buf1.height !== H) { buf1.width = W; buf1.height = H; }
    if (buf2.width !== W || buf2.height !== H) { buf2.width = W; buf2.height = H; }
  }

  function srcSize(el: any) {
    return { w: el.videoWidth || el.naturalWidth || el.width || 1, h: el.videoHeight || el.naturalHeight || el.height || 1 };
  }

  function drawMedia(c: Clip, local: number, o: { zoom?: number; alpha?: number; dx?: number }, targetCtx: CanvasRenderingContext2D = ctx) {
    const W = cv.width, H = cv.height, el = c.el;
    if (!el) return;
    if (c.type === 'video' && el.readyState < 2) return;
    const { w, h } = srcSize(el);
    const p = c.dur > 0 ? local / c.dur : 0;
    let z = 1, px = 0;
    if (c.fx === 'zoomin') z = 1 + 0.12 * p;
    else if (c.fx === 'zoomout') z = 1.12 - 0.12 * p;
    else if (c.fx === 'panl') { z = 1.1; px = (0.5 - p) * 0.08; }
    else if (c.fx === 'panr') { z = 1.1; px = (p - 0.5) * 0.08; }
    z *= (o.zoom || 1);
    targetCtx.save();
    targetCtx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    targetCtx.translate(W / 2 + (o.dx || 0) + px * W, H / 2);
    targetCtx.scale(z, z);
    targetCtx.translate(-W / 2, -H / 2);
    if (c.color !== 'none' && 'filter' in targetCtx) (targetCtx as any).filter = FILTERS[c.color];
    try {
      if (c.fit === 'contain') {
        bgc.width = W > H ? 64 : 36;
        bgc.height = W > H ? 36 : 64;
        const s0 = Math.max(bgc.width / w, bgc.height / h);
        bgx.drawImage(el, (bgc.width - w * s0) / 2, (bgc.height - h * s0) / 2, w * s0, h * s0);
        targetCtx.imageSmoothingEnabled = true;
        targetCtx.imageSmoothingQuality = 'high';
        targetCtx.drawImage(bgc, 0, 0, W, H);
        targetCtx.fillStyle = 'rgba(0,0,0,.35)';
        targetCtx.fillRect(0, 0, W, H);
        const s = Math.min(W / w, H / h);
        targetCtx.drawImage(el, (W - w * s) / 2, (H - h * s) / 2, w * s, h * s);
      } else {
        const s = Math.max(W / w, H / h);
        targetCtx.drawImage(el, (W - w * s) / 2, (H - h * s) / 2, w * s, h * s);
      }
    } catch (e) {}
    targetCtx.restore();
  }

  function renderTransition(trType: string, prev: Clip, c: Clip, local: number, trd: number, clipIndex = 0) {
    const W = cv.width, H = cv.height;
    syncBufSize(W, H);
    const p = clamp(local / trd, 0, 1);
    const k = ease(p);
    const effTr = getEffectiveTr(trType, c.id || 1, clipIndex);
    const prevTime = prev.dur + local;

    if (effTr === 'none') {
      drawMedia(c, local, {}, ctx);
      return;
    }
    if (effTr === 'fade') {
      drawMedia(prev, prevTime, {}, ctx);
      drawMedia(c, local, { alpha: k }, ctx);
      return;
    }
    if (effTr === 'fadeblack') {
      if (k < 0.5) {
        const a = 1 - k * 2;
        drawMedia(prev, prevTime, { alpha: a }, ctx);
      } else {
        const a = (k - 0.5) * 2;
        drawMedia(c, local, { alpha: a }, ctx);
      }
      return;
    }
    if (effTr === 'fadewhite') {
      if (k < 0.5) {
        drawMedia(prev, prevTime, {}, ctx);
        ctx.fillStyle = 'rgba(255,255,255,' + (k * 2) + ')';
        ctx.fillRect(0, 0, W, H);
      } else {
        drawMedia(c, local, {}, ctx);
        ctx.fillStyle = 'rgba(255,255,255,' + ((1 - k) * 2) + ')';
        ctx.fillRect(0, 0, W, H);
      }
      return;
    }
    if (effTr === 'slideleft') {
      drawMedia(prev, prevTime, { dx: -W * 0.15 * k }, ctx);
      drawMedia(c, local, { dx: W * (1 - k) }, ctx);
      const seamX = W * (1 - k);
      ctx.save();
      const shadowG = ctx.createLinearGradient(seamX - 22, 0, seamX, 0);
      shadowG.addColorStop(0, 'rgba(0,0,0,0)');
      shadowG.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = shadowG;
      ctx.fillRect(seamX - 22, 0, 22, H);
      ctx.restore();
      return;
    }
    if (effTr === 'slideright') {
      drawMedia(prev, prevTime, { dx: W * 0.15 * k }, ctx);
      drawMedia(c, local, { dx: -W * (1 - k) }, ctx);
      const seamX = W * k;
      ctx.save();
      const shadowG = ctx.createLinearGradient(seamX, 0, seamX + 22, 0);
      shadowG.addColorStop(0, 'rgba(0,0,0,0.45)');
      shadowG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shadowG;
      ctx.fillRect(seamX, 0, 22, H);
      ctx.restore();
      return;
    }
    if (effTr === 'slideup') {
      drawMedia(prev, prevTime, {}, ctx);
      ctx.save();
      ctx.translate(0, H * (1 - k));
      drawMedia(c, local, {}, ctx);
      ctx.restore();
      const seamY = H * (1 - k);
      ctx.save();
      const shadowG = ctx.createLinearGradient(0, seamY - 22, 0, seamY);
      shadowG.addColorStop(0, 'rgba(0,0,0,0)');
      shadowG.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = shadowG;
      ctx.fillRect(0, seamY - 22, W, 22);
      ctx.restore();
      return;
    }
    if (effTr === 'slidedown') {
      drawMedia(prev, prevTime, {}, ctx);
      ctx.save();
      ctx.translate(0, -H * (1 - k));
      drawMedia(c, local, {}, ctx);
      ctx.restore();
      const seamY = H * k;
      ctx.save();
      const shadowG = ctx.createLinearGradient(0, seamY, 0, seamY + 22);
      shadowG.addColorStop(0, 'rgba(0,0,0,0.45)');
      shadowG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shadowG;
      ctx.fillRect(0, seamY, W, 22);
      ctx.restore();
      return;
    }
    if (effTr === 'push') {
      drawMedia(prev, prevTime, { dx: -W * k }, ctx);
      drawMedia(c, local, { dx: W * (1 - k) }, ctx);
      const seamX = W * (1 - k);
      ctx.save();
      const shadowG = ctx.createLinearGradient(seamX - 20, 0, seamX, 0);
      shadowG.addColorStop(0, 'rgba(0,0,0,0)');
      shadowG.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = shadowG;
      ctx.fillRect(seamX - 20, 0, 20, H);
      ctx.restore();
      return;
    }
    if (effTr === 'zoom') {
      drawMedia(prev, prevTime, { alpha: 1 - k * 0.35 }, ctx);
      drawMedia(c, local, { alpha: k, zoom: 0.65 + 0.35 * k }, ctx);
      return;
    }
    if (effTr === 'zoomout') {
      drawMedia(prev, prevTime, { zoom: 1 - 0.25 * k, alpha: 1 - k }, ctx);
      drawMedia(c, local, { zoom: 1.35 - 0.35 * k, alpha: k }, ctx);
      return;
    }
    if (effTr === 'wiper') {
      drawMedia(prev, prevTime, {}, ctx);
      bctx2.clearRect(0, 0, W, H);
      drawMedia(c, local, {}, bctx2);
      const f = Math.max(30, W * 0.06);
      const sx = -f + (W + f * 2) * k;
      bctx2.save();
      bctx2.globalCompositeOperation = 'destination-in';
      const g = bctx2.createLinearGradient(sx - f, 0, sx + f, 0);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      bctx2.fillStyle = '#000';
      if (sx - f > 0) bctx2.fillRect(0, 0, sx - f, H);
      bctx2.fillStyle = g;
      bctx2.fillRect(Math.max(0, sx - f), 0, f * 2, H);
      bctx2.restore();
      ctx.drawImage(buf2, 0, 0);
      return;
    }
    if (effTr === 'wiped') {
      drawMedia(prev, prevTime, {}, ctx);
      bctx2.clearRect(0, 0, W, H);
      drawMedia(c, local, {}, bctx2);
      const f = Math.max(30, H * 0.06);
      const sy = -f + (H + f * 2) * k;
      bctx2.save();
      bctx2.globalCompositeOperation = 'destination-in';
      const g = bctx2.createLinearGradient(0, sy - f, 0, sy + f);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      bctx2.fillStyle = '#000';
      if (sy - f > 0) bctx2.fillRect(0, 0, W, sy - f);
      bctx2.fillStyle = g;
      bctx2.fillRect(0, Math.max(0, sy - f), W, f * 2);
      bctx2.restore();
      ctx.drawImage(buf2, 0, 0);
      return;
    }
    if (effTr === 'circleopen') {
      drawMedia(prev, prevTime, {}, ctx);
      bctx2.clearRect(0, 0, W, H);
      drawMedia(c, local, {}, bctx2);
      const maxR = Math.hypot(W / 2, H / 2) * 1.05;
      const r = maxR * k;
      const f = 25;
      bctx2.save();
      bctx2.globalCompositeOperation = 'destination-in';
      if (r - f > 0) {
        bctx2.fillStyle = '#000';
        bctx2.beginPath();
        bctx2.arc(W / 2, H / 2, r - f, 0, Math.PI * 2);
        bctx2.fill();
      }
      const g = bctx2.createRadialGradient(W / 2, H / 2, Math.max(0, r - f), W / 2, H / 2, r + f);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      bctx2.fillStyle = g;
      bctx2.beginPath();
      bctx2.arc(W / 2, H / 2, r + f, 0, Math.PI * 2);
      bctx2.fill();
      bctx2.restore();
      ctx.drawImage(buf2, 0, 0);
      return;
    }
    if (effTr === 'centeropen') {
      drawMedia(prev, prevTime, {}, ctx);
      bctx2.clearRect(0, 0, W, H);
      drawMedia(c, local, {}, bctx2);
      const halfW = (W / 2) * k;
      bctx2.save();
      bctx2.globalCompositeOperation = 'destination-in';
      bctx2.fillStyle = '#000';
      bctx2.fillRect(W / 2 - halfW, 0, halfW * 2, H);
      bctx2.restore();
      ctx.drawImage(buf2, 0, 0);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 * (1 - k)) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2 - halfW, 0); ctx.lineTo(W / 2 - halfW, H);
      ctx.moveTo(W / 2 + halfW, 0); ctx.lineTo(W / 2 + halfW, H);
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (effTr === 'spin') {
      bctx1.clearRect(0, 0, W, H);
      drawMedia(prev, prevTime, {}, bctx1);
      bctx2.clearRect(0, 0, W, H);
      drawMedia(c, local, {}, bctx2);
      ctx.save();
      if (k < 0.5) {
        const p1 = k * 2;
        ctx.globalAlpha = 1 - p1;
        ctx.translate(W / 2, H / 2);
        ctx.rotate(-0.14 * p1);
        ctx.scale(1 - 0.12 * p1, 1 - 0.12 * p1);
        ctx.drawImage(buf1, -W / 2, -H / 2);
      } else {
        const p2 = (k - 0.5) * 2;
        ctx.globalAlpha = p2;
        ctx.translate(W / 2, H / 2);
        ctx.rotate(0.14 * (1 - p2));
        ctx.scale(0.88 + 0.12 * p2, 0.88 + 0.12 * p2);
        ctx.drawImage(buf2, -W / 2, -H / 2);
      }
      ctx.restore();
      return;
    }
    if (effTr === 'flip') {
      bctx1.clearRect(0, 0, W, H);
      drawMedia(prev, prevTime, {}, bctx1);
      bctx2.clearRect(0, 0, W, H);
      drawMedia(c, local, {}, bctx2);
      ctx.save();
      if (k < 0.5) {
        const p1 = k * 2;
        const sx = Math.cos(p1 * (Math.PI / 2));
        ctx.translate(W / 2, H / 2);
        ctx.scale(Math.max(0.001, sx), 1);
        ctx.drawImage(buf1, -W / 2, -H / 2);
        ctx.fillStyle = 'rgba(0,0,0,' + (p1 * 0.45) + ')';
        ctx.fillRect(-W / 2, -H / 2, W, H);
      } else {
        const p2 = (k - 0.5) * 2;
        const sx = Math.sin(p2 * (Math.PI / 2));
        ctx.translate(W / 2, H / 2);
        ctx.scale(Math.max(0.001, sx), 1);
        ctx.drawImage(buf2, -W / 2, -H / 2);
        ctx.fillStyle = 'rgba(0,0,0,' + ((1 - p2) * 0.45) + ')';
        ctx.fillRect(-W / 2, -H / 2, W, H);
      }
      ctx.restore();
      return;
    }
    if (effTr === 'flash') {
      if (k < 0.5) drawMedia(prev, prevTime, {}, ctx);
      else drawMedia(c, local, {}, ctx);
      const flashA = Math.sin(k * Math.PI);
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,' + (flashA * 0.95) + ')';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      return;
    }
    if (effTr === 'blur') {
      const hasFilter = typeof ctx.filter === 'string';
      if (hasFilter) {
        const blurPx = Math.sin(k * Math.PI) * 26;
        ctx.save();
        ctx.filter = 'blur(' + blurPx.toFixed(1) + 'px)';
        if (k < 0.5) {
          drawMedia(prev, prevTime, {}, ctx);
        } else {
          drawMedia(c, local, {}, ctx);
        }
        ctx.restore();
      } else {
        if (k < 0.5) {
          const s = 1 - 0.22 * (k * 2);
          drawMedia(prev, prevTime, { zoom: s, alpha: 1 - k }, ctx);
        } else {
          const s = 0.78 + 0.22 * ((k - 0.5) * 2);
          drawMedia(c, local, { zoom: s, alpha: k }, ctx);
        }
      }
      return;
    }
    if (effTr === 'glitch') {
      bctx1.clearRect(0, 0, W, H);
      drawMedia(prev, prevTime, {}, bctx1);
      bctx2.clearRect(0, 0, W, H);
      drawMedia(c, local, {}, bctx2);

      ctx.drawImage(buf1, 0, 0);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.drawImage(buf2, 0, 0);
      ctx.restore();

      const intensity = Math.sin(k * Math.PI);
      if (intensity > 0.05) {
        const shiftX = Math.round(intensity * 16 * Math.sin(k * 24));
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = intensity * 0.7;
        bctx1.save();
        bctx1.globalCompositeOperation = 'source-in';
        bctx1.fillStyle = '#ff1144';
        bctx1.fillRect(0, 0, W, H);
        bctx1.restore();
        ctx.drawImage(buf1, shiftX, 0);

        bctx2.save();
        bctx2.globalCompositeOperation = 'source-in';
        bctx2.fillStyle = '#00f0ff';
        bctx2.fillRect(0, 0, W, H);
        bctx2.restore();
        ctx.drawImage(buf2, -shiftX, 0);
        ctx.restore();

        const numSlices = 5;
        for (let s = 0; s < numSlices; s++) {
          const sy = ((s * 0.23 + k * 1.7) % 1) * (H - 50);
          const sh = 10 + (s % 3) * 14;
          const sliceDx = Math.sin(k * 35 + s * 13) * 22 * intensity;
          ctx.drawImage(cv, 0, sy, W, sh, sliceDx, sy, W, sh);
        }
      }
      return;
    }

    // Default fallback
    drawMedia(prev, prevTime, {}, ctx);
    drawMedia(c, local, { alpha: k }, ctx);
  }

  /* ---------- Xem thử hiệu ứng chuyển cảnh trên 2 ảnh mẫu ---------- */
  let previewTrRaf = 0;
  let isPreviewingTr = false;
  const samplePrevClip1 = newClip({ type: 'image', name: 'Mẫu 1', el: makeSample(0), dur: 4, fx: 'none' });
  const samplePrevClip2 = newClip({ type: 'image', name: 'Mẫu 2', el: makeSample(1), dur: 4, fx: 'none' });

  function stopTransitionPreview() {
    if (isPreviewingTr) {
      cancelAnimationFrame(previewTrRaf);
      isPreviewingTr = false;
      draw();
    }
  }

  function previewTransition(trName: string, trDur: number) {
    if (S.playing) pause();
    if (isPreviewingTr) cancelAnimationFrame(previewTrRaf);
    isPreviewingTr = true;
    const dur = clamp(trDur || 0.6, 0.1, 3);
    const holdPre = 0.35, holdPost = 0.55;
    const totalDur = holdPre + dur + holdPost;
    const startT = performance.now();
    const effTrLabel = TR[trName] || trName;

    const frame = () => {
      if (!isPreviewingTr) return;
      const elapsed = (performance.now() - startT) / 1000;
      const W = cv.width, H = cv.height;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      if (elapsed < holdPre) {
        drawMedia(samplePrevClip1, 1.0, {}, ctx);
      } else if (elapsed < holdPre + dur) {
        const local = elapsed - holdPre;
        renderTransition(trName, samplePrevClip1, samplePrevClip2, local, dur, 1);
      } else if (elapsed < totalDur) {
        drawMedia(samplePrevClip2, 1.0, {}, ctx);
      } else {
        isPreviewingTr = false;
        draw();
        return;
      }

      // Huy hiệu thông báo hiệu ứng đang xem thử
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 1.5;
      ctx.font = '600 ' + Math.max(13, Math.round(W * 0.034)) + 'px "Be Vietnam Pro", sans-serif';
      const text = '▶ Xem thử: ' + effTrLabel + ' (' + dur.toFixed(1) + 's)';
      const tw = ctx.measureText(text).width;
      const bw = tw + 28, bh = Math.max(26, Math.round(W * 0.065));
      const bx = (W - bw) / 2, by = Math.round(H * 0.06);
      if ((ctx as any).roundRect) (ctx as any).roundRect(bx, by, bw, bh, 6);
      else ctx.rect(bx, by, bw, bh);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, W / 2, by + bh / 2);
      ctx.restore();

      previewTrRaf = requestAnimationFrame(frame);
    };

    previewTrRaf = requestAnimationFrame(frame);
  }

  function renderFrame(t: number) {
    if (isPreviewingTr) return;
    const W = cv.width, H = cv.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const L = locate(t);
    if (L) {
      const c = S.clips[L.i], prev = S.clips[L.i - 1];
      const maxTrd = prev ? Math.max(0.1, Math.min(3.0, prev.dur * 0.5, c.dur * 0.5)) : 0;
      const trd = prev ? Math.min(c.trDur, maxTrd) : 0;
      if (prev && c.tr !== 'none' && L.local < trd && trd > 0) {
        renderTransition(c.tr, prev, c, L.local, trd, L.i);
      } else {
        drawMedia(c, L.local, {}, ctx);
      }
    } else {
      ctx.fillStyle = '#9fb3b8';
      ctx.font = '500 ' + Math.round(W * 0.045) + 'px "Be Vietnam Pro",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Thêm ảnh hoặc video để bắt đầu', W / 2, H / 2);
    }
    drawVisualizer(t);
    drawTitle(t);
    drawLyrics(t);
  }
  const draw = () => renderFrame(S.t);

  /* ---------- chữ ---------- */
  function wrap(text: string, maxW: number) {
    const words = text.split(/\s+/).filter(Boolean), lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }
  function drawText(text: string, yc: number, fs: number, prog: number | null, alpha: number, opt?: { color?: string; hi?: string }) {
    const W = cv.width, H = cv.height, st = S.style;
    const textColor = opt?.color || st.color;
    const hiColor = opt?.hi || st.hi;
    if (st.upper) text = text.toUpperCase();
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = st.weight + ' ' + fs + 'px "' + st.font + '", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.lineJoin = 'round';
    const maxW = W * (W > H ? 0.8 : 0.88);
    const lines = wrap(text, maxW);
    const lh = fs * 1.28, th = lines.length * lh;
    let y = yc - th / 2 + lh / 2;
    if (st.box > 0) {
      const bw = Math.max(...lines.map(l => ctx.measureText(l).width)) + fs * 1.1;
      const bh = th + fs * 0.6;
      ctx.fillStyle = 'rgba(0,0,0,' + st.box + ')';
      ctx.beginPath();
      if ((ctx as any).roundRect) (ctx as any).roundRect((W - bw) / 2, yc - bh / 2, bw, bh, fs * 0.35);
      else ctx.rect((W - bw) / 2, yc - bh / 2, bw, bh);
      ctx.fill();
    }
    const totalChars = lines.reduce((a, l) => a + l.length, 0) || 1;
    let done = prog == null ? Infinity : prog * totalChars;
    for (const line of lines) {
      const lw = ctx.measureText(line).width, x = (W - lw) / 2;
      const sh = () => {
        if (st.shadow) {
          ctx.shadowColor = 'rgba(0,0,0,.55)';
          ctx.shadowBlur = fs * 0.18;
          ctx.shadowOffsetY = fs * 0.06;
        }
      };
      if (st.outW > 0) {
        ctx.save();
        sh();
        ctx.lineWidth = st.outW * fs / 45;
        ctx.strokeStyle = st.outColor;
        ctx.strokeText(line, x, y);
        ctx.restore();
      }
      ctx.save();
      if (st.outW <= 0) sh();
      ctx.fillStyle = textColor;
      ctx.fillText(line, x, y);
      ctx.restore();
      if (prog != null) {
        const n = line.length, take = clamp(done, 0, n);
        if (take > 0) {
          const f = Math.floor(take);
          const wpre = ctx.measureText(line.slice(0, f)).width;
          const wnext = f < n ? ctx.measureText(line.slice(0, f + 1)).width : wpre;
          const pw = wpre + (wnext - wpre) * (take - f);
          ctx.save();
          ctx.beginPath();
          ctx.rect(x - fs * 0.3, y - lh / 2, pw + fs * 0.3, lh);
          ctx.clip();
          ctx.fillStyle = hiColor;
          ctx.fillText(line, x, y);
          ctx.restore();
        }
        done -= n;
      }
      y += lh;
    }
    ctx.restore();
    return th;
  }
  function drawLyrics(t: number) {
    const ly = S.lyr;
    if (!ly.length) return;
    const st = S.style;
    let idx = -1;
    for (let i = 0; i < ly.length; i++) {
      if (ly[i].t <= t) idx = i;
      else break;
    }
    if (idx < 0) return;
    const cur = ly[idx], nxt = ly[idx + 1];
    if (!cur.text) return;
    const lineEnd = (cur.endT && cur.endT > cur.t) ? cur.endT : (nxt ? nxt.t : cur.t + 4);
    if (t > lineEnd && (!nxt || nxt.t > lineEnd)) return;
    const fs = (cur.size && cur.size > 0 ? cur.size : st.size) / 100 * Math.min(cv.width, cv.height);
    const yc = cv.height * st.y / 100;
    const fillDur = Math.max(0.2, lineEnd - cur.t);
    const prog = st.karaoke ? clamp((t - cur.t) / fillDur, 0, 1) : null;

    // Hiệu ứng chữ khi dòng lyric bắt đầu hiện (~0.3 giây)
    const age = Math.max(0, t - cur.t);
    const enterDur = 0.3;
    const k = clamp(age / enterDur, 0, 1);
    let a = k;
    let animYc = yc;
    let animDx = 0;
    let animScale = 1;
    let textToDraw = cur.text;

    const animType = st.anim || 'fade';
    if (k < 1) {
      if (animType === 'rise') {
        animYc += (1 - k) * fs * 0.45;
        a = k;
      } else if (animType === 'pop') {
        const bounce = k < 0.65 ? 0.65 + (k / 0.65) * 0.5 : 1.15 - ((k - 0.65) / 0.35) * 0.15;
        animScale = bounce;
        a = clamp(k * 2, 0, 1);
      } else if (animType === 'type') {
        const count = Math.max(1, Math.floor(cur.text.length * k));
        textToDraw = cur.text.slice(0, count);
        a = 1;
      } else if (animType === 'slide') {
        animDx = -(1 - k) * cv.width * 0.22;
        a = k;
      } else {
        a = k;
      }
    }

    if (animScale !== 1 || animDx !== 0) {
      ctx.save();
      ctx.translate(cv.width / 2 + animDx, animYc);
      ctx.scale(animScale, animScale);
      ctx.translate(-cv.width / 2, -animYc);
    }
    const th = drawText(textToDraw, animYc, fs, prog, a, { color: cur.color, hi: cur.hi });
    if (animScale !== 1 || animDx !== 0) {
      ctx.restore();
    }
  }
  function drawTitle(t: number) {
    const ti = S.title;
    if (!ti.text || t >= ti.dur) return;
    const a = Math.min(clamp(t / 0.3, 0, 1), clamp((ti.dur - t) / 0.4, 0, 1));
    const fs = S.style.size / 100 * Math.min(cv.width, cv.height) * 1.45;
    drawText(ti.text, cv.height * 0.2, fs, null, a);
  }

  /* ---------- hiệu ứng sóng nhạc đa phong cách ---------- */
  const vizPeakFall = new Float32Array(128);
  const vizPeakSpeed = new Float32Array(128);

  function drawVisualizer(t: number) {
    const vz = S.viz;
    if (!vz || vz.type === 'none' || !A.loaded || !S.audioBlocks || !S.audioBlocks.length) return;
    const W = cv.width, H = cv.height;

    // Lấy dữ liệu phân tích từ AnalyserNode hoặc mô phỏng nhịp khi tạm dừng / xem trước
    const isLive = (S.playing || exporting || A.isPreviewing || A.isTrimPreviewing) && !!A.analyser;
    const binCount = A.analyser ? A.analyser.frequencyBinCount : 128;
    const freqData = new Uint8Array(binCount);
    const timeData = new Uint8Array(binCount);

    if (isLive && A.analyser) {
      A.analyser.getByteFrequencyData(freqData);
      A.analyser.getByteTimeDomainData(timeData);
    } else {
      // Sóng xem trước trực quan sinh động khi đang tạm dừng / tua
      for (let i = 0; i < binCount; i++) {
        const p = i / binCount;
        const bassWave = Math.sin(t * 3.6) * 0.35 + 0.65;
        const wave = Math.sin(i * 0.22 + t * 4.2) * 0.35 + 0.65;
        const decay = Math.pow(Math.max(0.01, 1 - p), 0.72);
        freqData[i] = Math.min(255, Math.floor(210 * decay * wave * bassWave));
        timeData[i] = Math.floor(128 + Math.sin(i * 0.14 + t * 4.8) * 42 * Math.sin(p * Math.PI));
      }
    }

    // Tính toán năng lượng dải trầm (Bass Energy) để tạo độ nảy / rung chấn
    let bassSum = 0;
    const bassBins = Math.min(8, binCount);
    for (let b = 0; b < bassBins; b++) bassSum += freqData[b];
    const bassAvg = (bassSum / (bassBins * 255)) * vz.sens;

    ctx.save();

    // Hiệu ứng phát sáng Neon
    if (vz.glow) {
      ctx.shadowColor = vz.color;
      ctx.shadowBlur = Math.round(16 * vz.size);
    }

    // Hàm tạo màu (đơn sắc, gradient, hoặc cầu vồng)
    const getColor = (prog: number, x1: number, y1: number, x2: number, y2: number) => {
      if (vz.colorMode === 'solid') return vz.color;
      if (vz.colorMode === 'rainbow') {
        const hue = Math.round(((prog * 360) + (t * 55)) % 360);
        return 'hsl(' + hue + ', 95%, 60%)';
      }
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, vz.color);
      grad.addColorStop(1, vz.color2);
      return grad;
    };

    const cx = W * (vz.x / 100);
    const cy = H * (vz.y / 100);

    // 1. THANH EQUALIZER (CỘT ĐỨNG & ĐỐI XỨNG)
    if (vz.type === 'bars' || vz.type === 'mirror') {
      const numBars = clamp(vz.bars || 32, 16, 64);
      const totalW = Math.min(W * 0.94, W * 0.82 * vz.size);
      const startX = cx - totalW / 2;
      const barSlot = totalW / numBars;
      const barW = Math.max(3, barSlot * 0.72);
      const maxH = H * 0.24 * vz.size;
      const isMirror = vz.type === 'mirror';

      for (let i = 0; i < numBars; i++) {
        const freqIdx = Math.floor(Math.pow(i / numBars, 1.3) * (binCount * 0.65));
        const rawVal = freqData[Math.min(binCount - 1, freqIdx)] || 0;
        const normalized = (rawVal / 255) * vz.sens;
        const barH = Math.max(isMirror ? 6 : 4, normalized * maxH);

        // Vật lý hạt đỉnh rơi (falling peak caps)
        if (normalized > vizPeakFall[i]) {
          vizPeakFall[i] = normalized;
          vizPeakSpeed[i] = 0;
        } else {
          vizPeakSpeed[i] += 0.007;
          vizPeakFall[i] = Math.max(0, vizPeakFall[i] - vizPeakSpeed[i]);
        }

        const bx = startX + i * barSlot + (barSlot - barW) / 2;
        const prog = i / (numBars - 1 || 1);

        if (isMirror) {
          const by = cy - barH / 2;
          ctx.fillStyle = getColor(prog, bx, cy - maxH / 2, bx, cy + maxH / 2);
          ctx.beginPath();
          if ((ctx as any).roundRect) (ctx as any).roundRect(bx, by, barW, barH, barW / 2);
          else ctx.rect(bx, by, barW, barH);
          ctx.fill();

          // Hạt đỉnh trên và dưới
          const pkTop = cy - (vizPeakFall[i] * maxH) / 2 - 3;
          const pkBot = cy + (vizPeakFall[i] * maxH) / 2 + 1;
          ctx.fillRect(bx, pkTop, barW, 2);
          ctx.fillRect(bx, pkBot, barW, 2);
        } else {
          const by = cy - barH;
          ctx.fillStyle = getColor(prog, bx, cy - maxH, bx, cy);
          ctx.beginPath();
          if ((ctx as any).roundRect) (ctx as any).roundRect(bx, by, barW, barH, [barW / 2, barW / 2, 0, 0]);
          else ctx.rect(bx, by, barW, barH);
          ctx.fill();

          // Hạt đỉnh rơi lơ lửng trên đầu cột
          const pkY = cy - vizPeakFall[i] * maxH - 3;
          ctx.fillStyle = getColor(prog, bx, pkY, bx + barW, pkY);
          ctx.fillRect(bx, pkY, barW, Math.max(2, 2.5 * vz.size));

          // Phản xạ mờ nhẹ dưới sàn
          ctx.save();
          ctx.globalAlpha = 0.22;
          ctx.fillStyle = vz.color;
          ctx.fillRect(bx, cy + 2, barW, Math.min(barH * 0.35, 24));
          ctx.restore();
        }
      }

      if (!isMirror) {
        ctx.strokeStyle = vz.color;
        ctx.lineWidth = Math.max(2, 2.5 * vz.size);
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(startX - 8, cy);
        ctx.lineTo(startX + totalW + 8, cy);
        ctx.stroke();
      }

    // 2. MA TRẬN HẠT LED (STACKED DOTS MATRIX)
    } else if (vz.type === 'dots') {
      const numBars = clamp(vz.bars || 32, 16, 48);
      const totalW = Math.min(W * 0.94, W * 0.82 * vz.size);
      const startX = cx - totalW / 2;
      const barSlot = totalW / numBars;
      const maxH = H * 0.24 * vz.size;
      const dotR = Math.max(2, Math.min(6, (barSlot * 0.65) / 2));
      const dotStep = dotR * 2 + 3.5;
      const totalDots = Math.floor(maxH / dotStep);

      for (let i = 0; i < numBars; i++) {
        const freqIdx = Math.floor(Math.pow(i / numBars, 1.25) * (binCount * 0.65));
        const rawVal = freqData[Math.min(binCount - 1, freqIdx)] || 0;
        const normalized = (rawVal / 255) * vz.sens;
        const activeDots = Math.floor(normalized * totalDots);

        if (normalized > vizPeakFall[i]) {
          vizPeakFall[i] = normalized;
          vizPeakSpeed[i] = 0;
        } else {
          vizPeakSpeed[i] += 0.007;
          vizPeakFall[i] = Math.max(0, vizPeakFall[i] - vizPeakSpeed[i]);
        }

        const bx = startX + i * barSlot + barSlot / 2;
        const prog = i / (numBars - 1 || 1);

        for (let d = 0; d < totalDots; d++) {
          const dy = cy - d * dotStep - dotR;
          const isActive = d < activeDots;
          ctx.save();
          if (isActive) {
            ctx.fillStyle = getColor(prog, bx - dotR, cy - maxH, bx + dotR, cy);
            ctx.globalAlpha = 0.95;
          } else {
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.globalAlpha = 0.4;
          }
          ctx.beginPath();
          ctx.arc(bx, dy, dotR, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Hạt LED đỉnh rơi chậm
        const pkIdx = Math.floor(vizPeakFall[i] * totalDots);
        if (pkIdx > 0 && pkIdx < totalDots) {
          const pkY = cy - pkIdx * dotStep - dotR;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(bx, pkY, dotR + 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

    // 3. DẢI LỤA NEON UỐN LƯỢN ĐA TẦNG (NEON SILK RIBBON)
    } else if (vz.type === 'ribbon') {
      const totalW = Math.min(W * 0.96, W * 0.9 * vz.size);
      const startX = cx - totalW / 2;
      const numPts = 36;
      const step = totalW / (numPts - 1);
      const maxAmp = H * 0.16 * vz.size * vz.sens;

      // Vẽ 3 dải lụa sóng đan xen (Bass, Mid, Treble)
      const layers = [
        { color: vz.color, freqScale: 0.25, timeShift: 3.2, ampScale: 1.0, alpha: 0.85, width: 3.5 },
        { color: vz.color2, freqScale: 0.5, timeShift: -2.8, ampScale: 0.75, alpha: 0.75, width: 2.5 },
        { color: '#ffffff', freqScale: 0.85, timeShift: 4.5, ampScale: 0.5, alpha: 0.65, width: 2.0 }
      ];

      layers.forEach(ly => {
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i < numPts; i++) {
          const norm = i / (numPts - 1);
          const fIdx = Math.floor(norm * (binCount * ly.freqScale));
          const val = (freqData[Math.min(binCount - 1, fIdx)] || 0) / 255;
          const envelope = Math.sin(norm * Math.PI);
          const wavePhase = Math.sin(norm * 8 + t * ly.timeShift);
          const dy = (val * wavePhase * maxAmp * ly.ampScale) * envelope;
          pts.push({ x: startX + i * step, y: cy + dy });
        }

        // Đổ bóng gradient dưới dải lụa
        ctx.save();
        ctx.globalAlpha = ly.alpha * 0.25;
        const gGrad = ctx.createLinearGradient(0, cy - maxAmp, 0, cy + maxAmp);
        gGrad.addColorStop(0, ly.color);
        gGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = gGrad;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, cy);
        for (let i = 0; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[pts.length - 1].x, cy);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Đường lụa neon uốn cong mượt mà
        ctx.save();
        ctx.strokeStyle = ly.color;
        ctx.lineWidth = Math.max(2, ly.width * vz.size);
        ctx.globalAlpha = ly.alpha;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (pts[i].x + pts[i + 1].x) / 2;
          const yc = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
        ctx.restore();
      });

    // 4. SÓNG XUNG KÍCH TỎA TRÒN (SHOCKWAVE PULSE RINGS)
    } else if (vz.type === 'ring') {
      const baseR = Math.min(W, H) * 0.14 * vz.size;
      const pulseR = baseR * (1 + bassAvg * 0.16);
      const maxRingR = Math.min(W, H) * 0.44 * vz.size;
      const numRings = 5;

      // Các vòng tròn xung kích nở dần theo thời gian & bass
      for (let r = 0; r < numRings; r++) {
        const phase = ((r / numRings) + t * 0.65 + bassAvg * 0.1) % 1;
        const curR = pulseR + phase * (maxRingR - pulseR);
        const alpha = Math.sin(phase * Math.PI) * 0.85;

        ctx.save();
        ctx.strokeStyle = getColor(phase, cx - curR, cy, cx + curR, cy);
        ctx.lineWidth = Math.max(1.5, (4 - phase * 2.5) * vz.size);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(cx, cy, curR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Hào quang lõi trung tâm
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseR);
      coreGrad.addColorStop(0, vz.color2);
      coreGrad.addColorStop(0.7, vz.color);
      coreGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.fill();

      // Biểu tượng đĩa nhạc / loa rung tại tâm
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold ' + Math.round(pulseR * 0.5) + 'px "Be Vietnam Pro",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', cx, cy);

    // 5. NHỊP ĐẬP CON TIM (HEARTBEAT ECG PULSE)
    } else if (vz.type === 'ecg') {
      const totalW = Math.min(W * 0.95, W * 0.88 * vz.size);
      const startX = cx - totalW / 2;
      const maxAmp = H * 0.15 * vz.size * vz.sens;
      const numPoints = 80;
      const step = totalW / (numPoints - 1);

      // Điểm tâm quét di chuyển từ trái sang phải
      const sweepPos = ((t * 0.5) % 1) * numPoints;

      ctx.save();
      ctx.strokeStyle = getColor(0.5, startX, cy, startX + totalW, cy);
      ctx.lineWidth = Math.max(2.5, 3.5 * vz.size);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      let headX = startX, headY = cy;

      for (let i = 0; i < numPoints; i++) {
        const x = startX + i * step;
        let y = cy;
        const distFromSweep = (i - sweepPos + numPoints) % numPoints;

        if (distFromSweep < 14) {
          // Chuỗi xung nhịp tim P-Q-R-S-T
          const p = distFromSweep / 14;
          if (p < 0.2) {
            y = cy - Math.sin(p / 0.2 * Math.PI) * (maxAmp * 0.25);
          } else if (p < 0.35) {
            y = cy + (maxAmp * 0.18);
          } else if (p < 0.55) {
            // Đỉnh nhọn R vút cao theo Bass
            const rAmp = maxAmp * (1.2 + bassAvg * 1.5);
            y = cy - rAmp;
          } else if (p < 0.72) {
            y = cy + (maxAmp * 0.45);
          } else if (p < 0.9) {
            y = cy - Math.sin((p - 0.72) / 0.18 * Math.PI) * (maxAmp * 0.35);
          }
        } else {
          // Đường cơ sở rung động nhẹ theo âm treble
          const fIdx = Math.floor((i / numPoints) * (binCount * 0.5));
          const fv = (freqData[fIdx] || 0) / 255;
          y = cy + (Math.sin(i * 0.35 + t * 6) * 3 + (fv - 0.5) * 6) * vz.size;
        }

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        if (Math.floor(sweepPos) === i) {
          headX = x; headY = y;
        }
      }
      ctx.stroke();

      // Đầu vệt sáng quét Laser Neon
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(headX, headY, Math.max(4, 5 * vz.size), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

    // 6. LỤC GIÁC NĂNG LƯỢNG CYBER (HEXAGON AUDIO CORE)
    } else if (vz.type === 'polygon') {
      const baseR = Math.min(W, H) * 0.15 * vz.size;
      const pulseR = baseR * (1 + bassAvg * 0.18);
      const sides = 6;
      const barsPerSide = clamp(Math.floor((vz.bars || 36) / sides), 4, 10);
      const maxBarLen = baseR * 0.85 * vz.sens;

      // Vẽ hình lục giác tâm
      ctx.save();
      ctx.strokeStyle = vz.color;
      ctx.lineWidth = Math.max(2, 3 * vz.size);
      ctx.beginPath();
      for (let s = 0; s < sides; s++) {
        const ang = (s / sides) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(ang) * pulseR;
        const y = cy + Math.sin(ang) * pulseR;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();

      // Các tia sóng bắn vuông góc từ 6 cạnh
      for (let s = 0; s < sides; s++) {
        const ang1 = (s / sides) * Math.PI * 2 - Math.PI / 2;
        const ang2 = ((s + 1) / sides) * Math.PI * 2 - Math.PI / 2;
        const x1 = cx + Math.cos(ang1) * pulseR;
        const y1 = cy + Math.sin(ang1) * pulseR;
        const x2 = cx + Math.cos(ang2) * pulseR;
        const y2 = cy + Math.sin(ang2) * pulseR;

        const normalAng = (ang1 + ang2) / 2;

        for (let b = 0; b < barsPerSide; b++) {
          const frac = (b + 0.5) / barsPerSide;
          const bx = x1 + (x2 - x1) * frac;
          const by = y1 + (y2 - y1) * frac;

          const fIdx = Math.floor(((s * barsPerSide + b) / (sides * barsPerSide)) * (binCount * 0.65));
          const val = (freqData[Math.min(binCount - 1, fIdx)] || 0) / 255;
          const barLen = Math.max(3, val * maxBarLen);

          const ex = bx + Math.cos(normalAng) * barLen;
          const ey = by + Math.sin(normalAng) * barLen;

          ctx.strokeStyle = getColor(frac, bx, by, ex, ey);
          ctx.lineWidth = Math.max(2, (pulseR / barsPerSide) * 0.55);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
      }

      // Tâm lục giác: Biểu tượng năng lượng
      ctx.fillStyle = vz.color2;
      ctx.font = 'bold ' + Math.round(pulseR * 0.45) + 'px "Be Vietnam Pro",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⬢', cx, cy);
      ctx.restore();

    // 7. THANH SÓNG 2 BÊN VIỀN MÀN HÌNH (DUAL SIDE STEREO BORDERS)
    } else if (vz.type === 'stereo') {
      const numBars = clamp(vz.bars || 28, 16, 40);
      const totalH = Math.min(H * 0.78, H * 0.7 * vz.size);
      const startY = cy - totalH / 2;
      const barSlot = totalH / numBars;
      const barH = Math.max(3, barSlot * 0.72);
      const maxW = W * 0.22 * vz.size * vz.sens;

      for (let i = 0; i < numBars; i++) {
        const freqIdx = Math.floor(Math.pow(i / numBars, 1.2) * (binCount * 0.65));
        const val = (freqData[Math.min(binCount - 1, freqIdx)] || 0) / 255;
        const barLen = Math.max(6, val * maxW);
        const y = startY + i * barSlot + (barSlot - barH) / 2;
        const prog = i / (numBars - 1 || 1);

        // Mép trái bắn sang phải
        ctx.fillStyle = getColor(prog, 0, y, barLen, y);
        ctx.beginPath();
        if ((ctx as any).roundRect) (ctx as any).roundRect(0, y, barLen, barH, [0, barH / 2, barH / 2, 0]);
        else ctx.rect(0, y, barLen, barH);
        ctx.fill();

        // Mép phải bắn sang trái
        ctx.fillStyle = getColor(prog, W, y, W - barLen, y);
        ctx.beginPath();
        if ((ctx as any).roundRect) (ctx as any).roundRect(W - barLen, y, barLen, barH, [barH / 2, 0, 0, barH / 2]);
        else ctx.rect(W - barLen, y, barLen, barH);
        ctx.fill();
      }

    // 8. NGỌN LỬA CYBER SPIKES (FLAME SPIKES)
    } else if (vz.type === 'flame') {
      const numBars = clamp(vz.bars || 32, 16, 48);
      const totalW = Math.min(W * 0.94, W * 0.84 * vz.size);
      const startX = cx - totalW / 2;
      const barSlot = totalW / numBars;
      const maxH = H * 0.26 * vz.size * vz.sens;

      for (let i = 0; i < numBars; i++) {
        const freqIdx = Math.floor(Math.pow(i / numBars, 1.25) * (binCount * 0.65));
        const val = (freqData[Math.min(binCount - 1, freqIdx)] || 0) / 255;
        const flameH = Math.max(8, val * maxH);
        const bx = startX + i * barSlot;
        const prog = i / (numBars - 1 || 1);

        // Đỉnh ngọn lửa rung rinh nhẹ
        const flickerX = Math.sin(t * 14 + i * 2.3) * (barSlot * 0.35);
        const tipX = bx + barSlot / 2 + flickerX;
        const tipY = cy - flameH;

        ctx.fillStyle = getColor(prog, bx, cy, tipX, tipY);
        ctx.beginPath();
        ctx.moveTo(bx + 1, cy);
        ctx.quadraticCurveTo(bx + barSlot * 0.15, cy - flameH * 0.55, tipX, tipY);
        ctx.quadraticCurveTo(bx + barSlot * 0.85, cy - flameH * 0.55, bx + barSlot - 1, cy);
        ctx.closePath();
        ctx.fill();
      }

    // 9. GIỌT NƯỚC ÂM THANH BIẾN HÌNH (LIQUID AUDIO BLOB)
    } else if (vz.type === 'blob') {
      const baseR = Math.min(W, H) * 0.16 * vz.size;
      const maxAmp = baseR * 0.7 * vz.sens;
      const numNodes = 48;
      const pts: { x: number; y: number }[] = [];

      for (let i = 0; i < numNodes; i++) {
        const ang = (i / numNodes) * Math.PI * 2 - Math.PI / 2;
        const normIdx = i < numNodes / 2 ? i / (numNodes / 2) : (numNodes - i) / (numNodes / 2);
        const fIdx = Math.floor(normIdx * (binCount * 0.65));
        const val = (freqData[Math.min(binCount - 1, fIdx)] || 0) / 255;
        const ripple = Math.sin(i * 0.8 + t * 4.5) * (val * 8);
        const r = baseR * (1 + bassAvg * 0.14) + val * maxAmp + ripple;
        pts.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
      }

      // Tô màu gradient tỏa tròn bên trong khối giọt nước
      const blobGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 1.8);
      blobGrad.addColorStop(0, vz.color2);
      blobGrad.addColorStop(0.75, vz.color);
      blobGrad.addColorStop(1, 'rgba(0,0,0,0.1)');

      ctx.save();
      ctx.fillStyle = blobGrad;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, 2.8 * vz.size);
      ctx.beginPath();
      ctx.moveTo((pts[0].x + pts[numNodes - 1].x) / 2, (pts[0].y + pts[numNodes - 1].y) / 2);
      for (let i = 0; i < numNodes; i++) {
        const next = pts[(i + 1) % numNodes];
        const mx = (pts[i].x + next.x) / 2;
        const my = (pts[i].y + next.y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Tâm giọt nước: Nốt nhạc trắng
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold ' + Math.round(baseR * 0.55) + 'px "Be Vietnam Pro",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♫', cx, cy);
      ctx.restore();

    // 10. RẶNG NÚI PHỔ TẦN 3D SYNTHWAVE (SYNTHWAVE MOUNTAIN RIDGES)
    } else if (vz.type === 'mountain') {
      const totalW = Math.min(W * 0.96, W * 0.88 * vz.size);
      const startX = cx - totalW / 2;
      const numPts = 42;
      const step = totalW / (numPts - 1);
      const maxH = H * 0.22 * vz.size * vz.sens;

      const layers = [
        { color: vz.color2, freqRange: 0.8, ampMul: 0.55, yOffset: -18, alpha: 0.45 },
        { color: vz.color, freqRange: 0.55, ampMul: 0.78, yOffset: -8, alpha: 0.7 },
        { color: '#ffffff', freqRange: 0.35, ampMul: 1.0, yOffset: 0, alpha: 0.95 }
      ];

      layers.forEach(ly => {
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i < numPts; i++) {
          const norm = i / (numPts - 1);
          const fIdx = Math.floor(Math.pow(norm, 1.2) * (binCount * ly.freqRange));
          const val = (freqData[Math.min(binCount - 1, fIdx)] || 0) / 255;
          const envelope = Math.sin(norm * Math.PI);
          const py = cy + ly.yOffset - val * maxH * ly.ampMul * envelope;
          pts.push({ x: startX + i * step, y: py });
        }

        ctx.save();
        const mGrad = ctx.createLinearGradient(0, cy - maxH, 0, cy);
        mGrad.addColorStop(0, ly.color);
        mGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = mGrad;
        ctx.globalAlpha = ly.alpha;

        ctx.beginPath();
        ctx.moveTo(startX, cy);
        for (let i = 0; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.lineTo(startX + totalW, cy);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = ly.color;
        ctx.lineWidth = Math.max(1.5, 2.5 * vz.size);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.restore();
      });

    // 11. SÓNG TRÒN ĐĨA THAN VINYL (RADIAL VINYL 360)
    } else if (vz.type === 'circle') {
      const baseR = Math.min(W, H) * 0.16 * vz.size;
      const pulseR = baseR * (1 + bassAvg * 0.09);
      const numPins = clamp((vz.bars || 32) * 2, 36, 72);
      const pinMaxLen = baseR * 0.78 * vz.sens;

      for (let i = 0; i < numPins; i++) {
        const angle = (i / numPins) * Math.PI * 2 - Math.PI / 2;
        const normIdx = i < numPins / 2 ? i / (numPins / 2) : (numPins - i) / (numPins / 2);
        const fIndex = Math.floor(Math.pow(normIdx, 1.25) * (binCount * 0.6));
        const rawVal = freqData[Math.min(binCount - 1, fIndex)] || 0;
        const pinLen = Math.max(4, (rawVal / 255) * pinMaxLen);

        const x1 = cx + Math.cos(angle) * (pulseR + 6);
        const y1 = cy + Math.sin(angle) * (pulseR + 6);
        const x2 = cx + Math.cos(angle) * (pulseR + 6 + pinLen);
        const y2 = cy + Math.sin(angle) * (pulseR + 6 + pinLen);

        ctx.strokeStyle = getColor(normIdx, x1, y1, x2, y2);
        ctx.lineWidth = Math.max(3, (Math.PI * 2 * pulseR / numPins) * 0.65);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, pulseR + 4, 0, Math.PI * 2);
      ctx.strokeStyle = vz.color;
      ctx.lineWidth = Math.max(2, 3 * vz.size);
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.clip();

      if (vz.logoImg && vz.logoImg.complete && vz.logoImg.naturalWidth > 0) {
        const img = vz.logoImg;
        const scale = Math.max((pulseR * 2) / img.naturalWidth, (pulseR * 2) / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
      } else {
        ctx.fillStyle = '#0f1418';
        ctx.fillRect(cx - pulseR, cy - pulseR, pulseR * 2, pulseR * 2);

        ctx.strokeStyle = 'rgba(255,255,255,0.09)';
        ctx.lineWidth = 1;
        for (let r = pulseR * 0.35; r < pulseR * 0.95; r += 7 * vz.size) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        const labelR = pulseR * 0.42;
        const labelGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, labelR);
        labelGrad.addColorStop(0, vz.color2);
        labelGrad.addColorStop(1, vz.color);
        ctx.fillStyle = labelGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, labelR, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0a0d0f';
        ctx.beginPath();
        ctx.arc(cx, cy, pulseR * 0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold ' + Math.round(labelR * 0.7) + 'px "Be Vietnam Pro",sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♫', cx, cy);
      }
      ctx.restore();

      ctx.beginPath();
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

    // 12. VẠCH SÓNG ÂM CHẠY NGANG (OSCILLOSCOPE WAVE)
    } else if (vz.type === 'wave') {
      const totalW = Math.min(W * 0.95, W * 0.9 * vz.size);
      const startX = cx - totalW / 2;
      const endX = cx + totalW / 2;
      const maxAmp = H * 0.16 * vz.size * vz.sens;
      const step = totalW / (binCount - 1);

      const points: { x: number; y: number }[] = [];
      for (let i = 0; i < binCount; i++) {
        const x = startX + i * step;
        const sample = (timeData[i] - 128) / 128;
        const taper = Math.sin((i / (binCount - 1)) * Math.PI);
        const y = cy + sample * maxAmp * taper;
        points.push({ x, y });
      }

      const gradFill = ctx.createLinearGradient(0, cy - maxAmp, 0, cy + maxAmp);
      gradFill.addColorStop(0, vz.color);
      gradFill.addColorStop(1, 'transparent');

      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = gradFill;
      ctx.beginPath();
      ctx.moveTo(points[0].x, cy);
      for (let i = 0; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.lineTo(points[points.length - 1].x, cy);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);

      ctx.strokeStyle = getColor(0.5, startX, cy, endX, cy);
      ctx.lineWidth = Math.max(3, 4 * vz.size);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ---------- BỘ MẪU SÓNG NHẠC (1-CLICK PRESETS) & ĐỒNG BỘ GIAO DIỆN ---------- */
  interface VizPresetConfig {
    name: string;
    desc: string;
    icon: string;
    type: 'bars' | 'mirror' | 'circle' | 'wave' | 'dots' | 'ribbon' | 'ring' | 'ecg' | 'polygon' | 'stereo' | 'flame' | 'blob' | 'mountain';
    color: string;
    color2: string;
    colorMode: 'solid' | 'gradient' | 'rainbow';
    y: number;
    x: number;
    size: number;
    sens: number;
    bars: number;
    glow: boolean;
  }

  const VIZ_PRESETS: Record<string, VizPresetConfig> = {
    tiktok: {
      name: 'TikTok Viral',
      desc: 'Equalizer cột đứng sắc nét neon xanh hồng với hạt đỉnh rơi',
      icon: '📊',
      type: 'bars',
      color: '#00f0ff',
      color2: '#ff007f',
      colorMode: 'gradient',
      y: 82,
      x: 50,
      size: 1.0,
      sens: 1.2,
      bars: 32,
      glow: true
    },
    lofi: {
      name: 'Lofi Chill',
      desc: 'Dải lụa mềm mại 3 tầng uốn lượn êm dịu theo giai điệu',
      icon: '✨',
      type: 'ribbon',
      color: '#a78bfa',
      color2: '#38bdf8',
      colorMode: 'gradient',
      y: 78,
      x: 50,
      size: 1.1,
      sens: 1.0,
      bars: 32,
      glow: true
    },
    vinyl: {
      name: 'Đĩa Than 360',
      desc: 'Vòng tròn đĩa than vintage tỏa tia 360 độ quanh tâm avatar',
      icon: '💿',
      type: 'circle',
      color: '#f59e0b',
      color2: '#ec4899',
      colorMode: 'gradient',
      y: 50,
      x: 50,
      size: 1.0,
      sens: 1.15,
      bars: 36,
      glow: true
    },
    ecg: {
      name: 'Nhịp Tim ECG',
      desc: 'Đường điện tim Neon vút cao theo từng nhịp đập của tiếng Bass',
      icon: '💓',
      type: 'ecg',
      color: '#ff0055',
      color2: '#ff9900',
      colorMode: 'gradient',
      y: 80,
      x: 50,
      size: 1.05,
      sens: 1.3,
      bars: 32,
      glow: true
    },
    edm: {
      name: 'Xung Kích EDM',
      desc: 'Sóng vòng tròn xung kích nở bung dồn dập theo nhịp Drop',
      icon: '⚡',
      type: 'ring',
      color: '#00f0ff',
      color2: '#a855f7',
      colorMode: 'gradient',
      y: 50,
      x: 50,
      size: 1.1,
      sens: 1.35,
      bars: 32,
      glow: true
    },
    stereo: {
      name: 'Viền Stereo 2 Bên',
      desc: 'Cột sóng áp sát hai mép video trái phải đối xứng sang trọng',
      icon: '↔️',
      type: 'stereo',
      color: '#06b6d4',
      color2: '#3b82f6',
      colorMode: 'gradient',
      y: 50,
      x: 50,
      size: 1.0,
      sens: 1.25,
      bars: 28,
      glow: true
    },
    cyber: {
      name: 'Lục Giác Cyber',
      desc: 'Lõi lục giác năng lượng viễn tưởng với các tia bắn góc cạnh',
      icon: '⬢',
      type: 'polygon',
      color: '#10b981',
      color2: '#06b6d4',
      colorMode: 'gradient',
      y: 50,
      x: 50,
      size: 0.95,
      sens: 1.2,
      bars: 36,
      glow: true
    },
    led: {
      name: 'Ma Trận LED',
      desc: 'Bóng LED tròn xếp tầng retro phong cách máy trộn âm thanh',
      icon: '🎛️',
      type: 'dots',
      color: '#eab308',
      color2: '#ef4444',
      colorMode: 'gradient',
      y: 82,
      x: 50,
      size: 1.0,
      sens: 1.15,
      bars: 32,
      glow: false
    },
    flame: {
      name: 'Ngọn Lửa Cyber',
      desc: 'Các ngọn lửa âm thanh bùng cháy rung rinh theo tiết tấu',
      icon: '🔥',
      type: 'flame',
      color: '#f97316',
      color2: '#ef4444',
      colorMode: 'gradient',
      y: 85,
      x: 50,
      size: 1.0,
      sens: 1.25,
      bars: 32,
      glow: true
    },
    mountain: {
      name: 'Dãy Núi Synthwave',
      desc: 'Rặng núi 3D đa tầng phong cách Synthwave thập niên 80',
      icon: '⛰️',
      type: 'mountain',
      color: '#ec4899',
      color2: '#8b5cf6',
      colorMode: 'gradient',
      y: 82,
      x: 50,
      size: 1.05,
      sens: 1.2,
      bars: 32,
      glow: true
    },
    blob: {
      name: 'Giọt Nước Liquid',
      desc: 'Khối chất lỏng âm thanh biến dạng đàn hồi cực kỳ cuốn hút',
      icon: '💧',
      type: 'blob',
      color: '#06b6d4',
      color2: '#8b5cf6',
      colorMode: 'gradient',
      y: 50,
      x: 50,
      size: 1.0,
      sens: 1.2,
      bars: 32,
      glow: true
    },
    mirror: {
      name: 'Gương Đối Xứng',
      desc: 'Thanh equalizer lật trên dưới cân đối, thích hợp video nằm ngang',
      icon: '🪞',
      type: 'mirror',
      color: '#3b82f6',
      color2: '#8b5cf6',
      colorMode: 'gradient',
      y: 80,
      x: 50,
      size: 1.0,
      sens: 1.2,
      bars: 36,
      glow: true
    },
    wave: {
      name: 'Sóng Biển Mượt',
      desc: 'Vạch sóng âm dao động ký mềm mại lan tỏa toàn màn hình',
      icon: '〰️',
      type: 'wave',
      color: '#14b8a6',
      color2: '#3b82f6',
      colorMode: 'gradient',
      y: 80,
      x: 50,
      size: 1.0,
      sens: 1.2,
      bars: 32,
      glow: true
    }
  };

  function syncVizControlsToState() {
    const vz = S.viz;
    const vzTypeEl = $('#vizType') as HTMLSelectElement | null; if (vzTypeEl) vzTypeEl.value = vz.type;
    const vzColorEl = $('#vizColor') as HTMLInputElement | null; if (vzColorEl) vzColorEl.value = vz.color;
    const vzColor2El = $('#vizColor2') as HTMLInputElement | null; if (vzColor2El) vzColor2El.value = vz.color2;
    const vzColorModeEl = $('#vizColorMode') as HTMLSelectElement | null; if (vzColorModeEl) vzColorModeEl.value = vz.colorMode;
    const vzBarsEl = $('#vizBars') as HTMLSelectElement | null; if (vzBarsEl) vzBarsEl.value = String(vz.bars);
    const vzYEl = $('#vizY') as HTMLInputElement | null; if (vzYEl) vzYEl.value = String(vz.y);
    const vzXEl = $('#vizX') as HTMLInputElement | null; if (vzXEl) vzXEl.value = String(vz.x);
    const vzSizeEl = $('#vizSize') as HTMLInputElement | null; if (vzSizeEl) vzSizeEl.value = String(vz.size);
    const vzSensEl = $('#vizSens') as HTMLInputElement | null; if (vzSensEl) vzSensEl.value = String(vz.sens);
    const vzGlowEl = $('#vizGlow') as HTMLInputElement | null; if (vzGlowEl) vzGlowEl.checked = vz.glow;
    const vzLogoBox = $('#vizLogoBox'); if (vzLogoBox) vzLogoBox.hidden = !(vz.type === 'circle' || vz.type === 'polygon' || vz.type === 'blob');
    const vzYLbl = $('#vizYLbl'); if (vzYLbl) vzYLbl.textContent = vz.y + '%';
    const vzXLbl = $('#vizXLbl'); if (vzXLbl) vzXLbl.textContent = vz.x + '%';
    const vzSizeLbl = $('#vizSizeLbl'); if (vzSizeLbl) vzSizeLbl.textContent = vz.size.toFixed(2) + 'x';
    const vzSensLbl = $('#vizSensLbl'); if (vzSensLbl) vzSensLbl.textContent = vz.sens.toFixed(1) + 'x';
    const c2Box = $('#vizColor2Box'); if (c2Box) c2Box.style.opacity = vz.colorMode === 'solid' ? '0.35' : '1';

    // Đánh dấu active cho thẻ preset tương ứng
    document.querySelectorAll('.viz-preset-btn').forEach((btn: any) => {
      const isMatch = btn.dataset.presetType === vz.type;
      btn.classList.toggle('active-preset', isMatch);
    });
  }

  function applyVizPreset(key: string) {
    const p = VIZ_PRESETS[key];
    if (!p) return;
    S.viz.type = p.type;
    S.viz.color = p.color;
    S.viz.color2 = p.color2;
    S.viz.colorMode = p.colorMode;
    S.viz.y = p.y;
    S.viz.x = p.x;
    S.viz.size = p.size;
    S.viz.sens = p.sens;
    S.viz.bars = p.bars;
    S.viz.glow = p.glow;
    syncVizControlsToState();
    draw();
    toast(`Đã áp dụng mẫu sóng: ${p.name}`);
  }

  /* ---------- LYRIC: BỘ 3 BƯỚC (NHẬP LỜI - CĂN GIỜ - CHỈNH SỬA) ---------- */
  const TAGRE = /^\s*\[(\d+):(\d{1,2}(?:[.,]\d+)?)\](?:<(\d+):(\d{1,2}(?:[.,]\d+)?)>)?/;
  const STYLE_RE = /\s*\{(?:c=([^}\s]+))?(?:\s*h=([^}\s]+))?(?:\s*s=([\d.]+))?\}\s*$/;

  let currentLyrStep: 1 | 2 | 3 = 1;
  let tapIndex = 0;
  let lastActiveCardId: number | null = null;

  function parseLyr(txt: string): LyricItem[] {
    const out: LyricItem[] = [];
    txt.split(/\r?\n/).forEach(line => {
      let rest = line.trim();
      if (!rest || /^\[[A-Za-z#]+:.*\]$/.test(rest)) return;
      const m = TAGRE.exec(rest);
      if (m) {
        const startT = +m[1] * 60 + parseFloat(m[2].replace(',', '.'));
        const endT = (m[3] && m[4]) ? (+m[3] * 60 + parseFloat(m[4].replace(',', '.'))) : 0;
        let text = rest.slice(m[0].length).trim();
        let color: string | undefined;
        let hi: string | undefined;
        let size: number | undefined;

        const sm = STYLE_RE.exec(text);
        if (sm) {
          color = sm[1];
          hi = sm[2];
          size = sm[3] ? parseFloat(sm[3]) : undefined;
          text = text.slice(0, sm.index).trim();
        }

        out.push({
          id: ++lyrUid,
          t: startT,
          endT,
          text,
          color,
          hi,
          size
        });
      }
    });

    out.sort((a, b) => a.t - b.t);

    for (let i = 0; i < out.length; i++) {
      const nx = out[i + 1];
      if (!out[i].endT || out[i].endT <= out[i].t) {
        out[i].endT = nx ? nx.t : (out[i].t + 3.5);
      }
    }
    return out;
  }

  function parseSrt(txt: string): LyricItem[] {
    const blocks = txt.split(/\r?\n\r?\n/);
    const out: LyricItem[] = [];
    const srtTimeRegex = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;

    for (const block of blocks) {
      const lines = block.trim().split(/\r?\n/);
      if (lines.length < 2) continue;
      let timeLineIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (srtTimeRegex.test(lines[i])) {
          timeLineIdx = i;
          break;
        }
      }
      if (timeLineIdx === -1) continue;
      const m = srtTimeRegex.exec(lines[timeLineIdx])!;
      const startT = +m[1] * 3600 + +m[2] * 60 + +m[3] + (+m[4] / 1000);
      const endT = +m[5] * 3600 + +m[6] * 60 + +m[7] + (+m[8] / 1000);
      const textLines = lines.slice(timeLineIdx + 1).map(l => l.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
      const text = textLines.join(' ');
      if (text) {
        out.push({
          id: ++lyrUid,
          t: parseFloat(startT.toFixed(2)),
          endT: parseFloat(endT.toFixed(2)),
          text
        });
      }
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  }

  function formatLrcFromLyr(items: LyricItem[]): string {
    return items.map(item => {
      let line = '[' + fmt(item.t) + ']';
      if (item.endT && item.endT > item.t) {
        line += '<' + fmt(item.endT) + '>';
      }
      line += ' ' + item.text;
      const styleParts: string[] = [];
      if (item.color) styleParts.push('c=' + item.color);
      if (item.hi) styleParts.push('h=' + item.hi);
      if (item.size && item.size > 0) styleParts.push('s=' + item.size);
      if (styleParts.length) {
        line += ' {' + styleParts.join(' ') + '}';
      }
      return line;
    }).join('\n');
  }

  function rawLyricLines(): string[] {
    return S.lyr.map(l => l.text);
  }

  /* History undo/redo */
  interface TimelineHistoryState {
    clips: Clip[];
    audioBlocks: AudioBlock[];
    selAudioId: number | null;
    sel: number | null;
    selLyrId: number | null;
    lyr: LyricItem[];
    lrcText: string;
    fadeIn: number;
    fadeOut: number;
  }
  const tlUndoStack: TimelineHistoryState[] = [];
  const tlRedoStack: TimelineHistoryState[] = [];

  function updateUndoRedoUI() {
    const btnUndo = $('#btnTlUndo') as HTMLButtonElement | null;
    const btnRedo = $('#btnTlRedo') as HTMLButtonElement | null;
    const btnTopUndo = $('#btnTopUndo') as HTMLButtonElement | null;
    const btnTopRedo = $('#btnTopRedo') as HTMLButtonElement | null;
    const noUndo = tlUndoStack.length === 0;
    const noRedo = tlRedoStack.length === 0;
    if (btnUndo) btnUndo.disabled = noUndo;
    if (btnRedo) btnRedo.disabled = noRedo;
    if (btnTopUndo) btnTopUndo.disabled = noUndo;
    if (btnTopRedo) btnTopRedo.disabled = noRedo;
  }

  function pushTimelineHistory() {
    const state: TimelineHistoryState = {
      clips: S.clips.map(c => ({ ...c })),
      audioBlocks: S.audioBlocks.map(b => ({ ...b })),
      selAudioId: S.selAudioId,
      sel: S.sel,
      selLyrId: S.selLyrId,
      lyr: S.lyr.map(item => ({ ...item })),
      lrcText: formatLrcFromLyr(S.lyr),
      fadeIn: A.fadeIn,
      fadeOut: A.fadeOut
    };
    tlUndoStack.push(state);
    if (tlUndoStack.length > 50) tlUndoStack.shift();
    tlRedoStack.length = 0;
    updateUndoRedoUI();
  }

  function undoTimeline() {
    if (!tlUndoStack.length) return toast('Không còn thao tác để hoàn tác.');
    const current: TimelineHistoryState = {
      clips: S.clips.map(c => ({ ...c })),
      audioBlocks: S.audioBlocks.map(b => ({ ...b })),
      selAudioId: S.selAudioId,
      sel: S.sel,
      selLyrId: S.selLyrId,
      lyr: S.lyr.map(item => ({ ...item })),
      lrcText: formatLrcFromLyr(S.lyr),
      fadeIn: A.fadeIn,
      fadeOut: A.fadeOut
    };
    tlRedoStack.push(current);
    const prev = tlUndoStack.pop()!;
    S.clips = prev.clips.map(c => ({ ...c }));
    S.audioBlocks = prev.audioBlocks.map(b => ({ ...b }));
    S.selAudioId = prev.selAudioId;
    S.sel = prev.sel;
    S.selLyrId = prev.selLyrId;
    S.lyr = prev.lyr.map(item => ({ ...item }));
    A.fadeIn = prev.fadeIn;
    A.fadeOut = prev.fadeOut;
    if ($('#lyr')) ($('#lyr') as HTMLTextAreaElement).value = prev.lrcText;
    const tlFadeIn = $('#tlFadeIn') as HTMLSelectElement | null;
    if (tlFadeIn) tlFadeIn.value = String(A.fadeIn);
    const tlFadeOut = $('#tlFadeOut') as HTMLSelectElement | null;
    if (tlFadeOut) tlFadeOut.value = String(A.fadeOut);
    autoFitImagesToMusic();
    refreshAll();
    renderLyricUI();
    updateInspector();
    updateUndoRedoUI();
    toast('Đã hoàn tác (Ctrl+Z)');
  }

  function redoTimeline() {
    if (!tlRedoStack.length) return toast('Không có thao tác để làm lại.');
    const current: TimelineHistoryState = {
      clips: S.clips.map(c => ({ ...c })),
      audioBlocks: S.audioBlocks.map(b => ({ ...b })),
      selAudioId: S.selAudioId,
      sel: S.sel,
      selLyrId: S.selLyrId,
      lyr: S.lyr.map(item => ({ ...item })),
      lrcText: formatLrcFromLyr(S.lyr),
      fadeIn: A.fadeIn,
      fadeOut: A.fadeOut
    };
    tlUndoStack.push(current);
    const next = tlRedoStack.pop()!;
    S.clips = next.clips.map(c => ({ ...c }));
    S.audioBlocks = next.audioBlocks.map(b => ({ ...b }));
    S.selAudioId = next.selAudioId;
    S.sel = next.sel;
    S.selLyrId = next.selLyrId;
    S.lyr = next.lyr.map(item => ({ ...item }));
    A.fadeIn = next.fadeIn;
    A.fadeOut = next.fadeOut;
    if ($('#lyr')) ($('#lyr') as HTMLTextAreaElement).value = next.lrcText;
    const tlFadeIn = $('#tlFadeIn') as HTMLSelectElement | null;
    if (tlFadeIn) tlFadeIn.value = String(A.fadeIn);
    const tlFadeOut = $('#tlFadeOut') as HTMLSelectElement | null;
    if (tlFadeOut) tlFadeOut.value = String(A.fadeOut);
    autoFitImagesToMusic();
    refreshAll();
    renderLyricUI();
    updateInspector();
    updateUndoRedoUI();
    toast('Đã làm lại (Ctrl+Y)');
  }

  const pushLyricHistory = pushTimelineHistory;
  const undoLyric = undoTimeline;
  const redoLyric = redoTimeline;

  function syncLyrToEditor(pushHistory = true) {
    if (pushHistory) pushLyricHistory();
    const lrc = formatLrcFromLyr(S.lyr);
    const lyrEl = $('#lyr') as HTMLTextAreaElement | null;
    if (lyrEl) lyrEl.value = lrc;
    renderLyricUI();
    updateInspector();
    renderTimeline();
    draw();
  }

  function selLyr(): LyricItem | null {
    if (S.selLyrId == null) return null;
    return S.lyr.find(l => l.id === S.selLyrId) || null;
  }

  function selectLyrBlock(id: number | null) {
    S.selLyrId = id;
    if (id != null) {
      S.sel = null; // Bỏ chọn clip để bảng thuộc tính hiện câu lyric
      document.querySelectorAll('.lyr-card.selected').forEach(c => c.classList.remove('selected'));
      const cardEl = document.getElementById('card-lyr-' + id);
      if (cardEl) {
        cardEl.classList.add('selected');
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
    renderTimeline();
    updateInspector();
  }

  /* Bước 1: Tạo danh sách câu từ ô nhập thô với bảo lưu giờ */
  function createSentenceListFromRaw() {
    const rawEl = $('#lyrRawInput') as HTMLTextAreaElement | null;
    const rawVal = rawEl ? rawEl.value : '';
    const lines = rawVal.split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0 && !/^\[[A-Za-z#]+:.*\]$/.test(l));

    if (!lines.length) {
      return toast('Vui lòng nhập ít nhất một câu lời bài hát.');
    }

    pushLyricHistory();
    const oldLyr = S.lyr || [];
    const newLyr: LyricItem[] = [];

    lines.forEach((line, i) => {
      const m = TAGRE.exec(line);
      let t = 0;
      let endT = 0;
      let cleanText = line;
      if (m) {
        t = +m[1] * 60 + parseFloat(m[2].replace(',', '.'));
        endT = (m[3] && m[4]) ? (+m[3] * 60 + parseFloat(m[4].replace(',', '.'))) : (t + 3.5);
        cleanText = line.slice(m[0].length).trim();
      } else {
        // So khớp với vị trí dòng trước đó: nếu câu cũ đã có giờ thì GIỮ NGUYÊN GIỜ!
        const existing = oldLyr[i];
        if (existing && existing.t != null && existing.t >= 0) {
          t = existing.t;
          endT = existing.endT || (existing.t + 3.5);
        } else {
          t = i === 0 ? 0 : 0;
          endT = i === 0 ? 3.5 : 0;
        }
      }

      newLyr.push({
        id: oldLyr[i]?.id || ++lyrUid,
        t,
        endT,
        text: cleanText
      });
    });

    const hasAnyTime = newLyr.some(l => l.t > 0);
    if (hasAnyTime) {
      newLyr.sort((a, b) => a.t - b.t);
    }

    S.lyr = newLyr;
    syncLyrToEditor(false);
    toast(`Đã tạo danh sách ${newLyr.length} câu. Chuyển sang Bước 2 để căn giờ!`);
    switchLyricStep(2);
  }

  /* Bước 2: Bắt nhịp / Căn giờ (Tap-to-sync) */
  function updateTapStageUI() {
    const counterEl = $('#lyrTapCounter');
    const prevEl = $('#lyrTapPrev');
    const curEl = $('#lyrTapCurrent');
    const nextEl = $('#lyrTapNext');

    if (!S.lyr.length) {
      if (counterEl) counterEl.textContent = 'Câu 0 / 0';
      if (prevEl) prevEl.textContent = '';
      if (curEl) curEl.textContent = '(Chưa có lời bài hát. Hãy nhập lời ở Bước 1)';
      if (nextEl) nextEl.textContent = '';
      return;
    }

    tapIndex = clamp(tapIndex, 0, S.lyr.length);

    if (counterEl) {
      counterEl.textContent = `Câu ${Math.min(tapIndex + 1, S.lyr.length)} / ${S.lyr.length}`;
    }

    const prevItem = tapIndex > 0 ? S.lyr[tapIndex - 1] : null;
    if (prevEl) {
      prevEl.textContent = prevItem ? `✓ #${tapIndex}: ${prevItem.text} [${fmt(prevItem.t)}]` : '(Bắt đầu từ câu đầu tiên)';
    }

    if (tapIndex < S.lyr.length) {
      const curItem = S.lyr[tapIndex];
      if (curEl) curEl.textContent = `#${tapIndex + 1}: ${curItem.text}`;
      const nextItem = S.lyr[tapIndex + 1];
      if (nextEl) nextEl.textContent = nextItem ? `Câu sau: ${nextItem.text}` : '(Đây là câu cuối cùng)';
    } else {
      if (curEl) curEl.textContent = '🎉 Đã căn xong toàn bộ bài hát!';
      if (nextEl) nextEl.textContent = 'Bấm "Chuyển sang Bước 3" để rà soát chi tiết.';
    }
  }

  async function tapMarkNow() {
    if (!S.lyr.length) return toast('Hãy nhập lời ở Bước 1 trước.');

    if (!S.playing) {
      await resumeAudioContext('Căn giờ');
      play();
    }

    if (tapIndex >= S.lyr.length) {
      toast('Đã căn xong toàn bộ câu hát! Chuyển sang Bước 3.');
      switchLyricStep(3);
      return;
    }

    pushLyricHistory();
    const curTime = Math.max(0, parseFloat((S.t).toFixed(2)));
    const curItem = S.lyr[tapIndex];
    curItem.t = curTime;

    // Giờ kết thúc của câu trước = giờ bắt đầu của câu này (trừ 0.05s)
    if (tapIndex > 0) {
      const prev = S.lyr[tapIndex - 1];
      prev.endT = Math.max(prev.t + 0.3, parseFloat((curTime - 0.05).toFixed(2)));
    }

    tapIndex++;

    if (tapIndex >= S.lyr.length) {
      curItem.endT = parseFloat((curTime + 3.5).toFixed(2));
      toast('🎉 Đã căn xong toàn bộ bài hát! Tự động chuyển sang Bước 3.');
      syncLyrToEditor(false);
      switchLyricStep(3);
      return;
    }

    updateTapStageUI();
    syncLyrToEditor(false);
  }

  function tapUndoLine() {
    if (tapIndex <= 0) return toast('Đang ở câu đầu tiên.');
    pushLyricHistory();
    tapIndex--;
    const newT = Math.max(0, S.t - 3);
    seek(newT);
    updateTapStageUI();
    toast(`Đã quay lại câu ${tapIndex + 1} và lùi nhạc 3 giây.`);
  }

  function tapSkipLine() {
    if (tapIndex >= S.lyr.length) return;
    tapIndex++;
    updateTapStageUI();
    toast('Đã bỏ qua câu');
  }

  /* Bước 3: Render danh sách thẻ cuộn chỉnh sửa từng câu */
  function renderLyricCards() {
    const listEl = $('#lyrCardsList');
    const badgeEl = $('#lyrCardsTotalBadge');
    if (badgeEl) badgeEl.textContent = `${S.lyr.length} câu`;
    if (!listEl) return;

    if (!S.lyr.length) {
      listEl.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--muted); font-size: 12.5px;">Chưa có danh sách câu. Hãy nhập lời ở <strong>Bước 1</strong>.</div>';
      return;
    }

    let html = '';
    S.lyr.forEach((ly, i) => {
      const isSel = ly.id === S.selLyrId;
      const dur = Math.max(0, (ly.endT || ly.t + 3) - ly.t);
      html += `
        <div class="lyr-card ${isSel ? 'selected' : ''}" id="card-lyr-${ly.id}" data-id="${ly.id}" data-idx="${i}">
          <div class="lyr-card-header">
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="badge ${isSel ? 'warn' : 'neutral'}" style="font-size:10.5px;padding:1px 6px;">#${i + 1}</span>
              <button class="btn sm" data-action="play" data-idx="${i}" type="button" title="Nghe thử câu này từ ${fmt(ly.t)}" style="padding:2px 7px;font-size:11px;">▶</button>
            </div>
            <div class="lyr-card-time-group">
              <span style="color:var(--muted);font-size:10.5px;">Từ:</span>
              <button class="btn-nudge" data-action="nudge-minus" data-idx="${i}" type="button" title="Dời sớm 0.1s">-0.1s</button>
              <input class="lyr-card-time-input" data-action="start" data-idx="${i}" type="text" value="${fmt(ly.t)}" title="Giờ bắt đầu câu" />
              <button class="btn-nudge" data-action="nudge-plus" data-idx="${i}" type="button" title="Dời trễ 0.1s">+0.1s</button>
              <span style="color:var(--muted);font-size:10.5px;margin-left:4px;">Đến:</span>
              <input class="lyr-card-time-input" data-action="end" data-idx="${i}" type="text" value="${fmt(ly.endT || ly.t + 3)}" title="Giờ kết thúc câu" />
              <span style="color:var(--muted);font-size:10px;font-family:var(--font-mono);">(${dur.toFixed(1)}s)</span>
            </div>
            <div style="display:flex;gap:4px;margin-left:auto;">
              <button class="btn sm" data-action="split" data-idx="${i}" type="button" title="Tách câu này thành hai" style="padding:2px 6px;font-size:11px;">✂️</button>
              <button class="btn sm" data-action="merge" data-idx="${i}" type="button" title="Gộp câu này với câu kế tiếp" style="padding:2px 6px;font-size:11px;">🔗</button>
              <button class="btn sm danger" data-action="delete" data-idx="${i}" type="button" title="Xóa câu này" style="padding:2px 6px;font-size:11px;">🗑️</button>
            </div>
          </div>
          <div>
            <input class="lyr-card-text-input" data-action="text" data-idx="${i}" type="text" value="${esc(ly.text)}" placeholder="Nội dung câu hát..." />
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;
  }

  function parseTimeStr(str: string): number | null {
    str = str.trim();
    if (!str) return null;
    const parts = str.split(':');
    if (parts.length === 2) {
      const min = parseFloat(parts[0]);
      const sec = parseFloat(parts[1].replace(',', '.'));
      if (!isNaN(min) && !isNaN(sec)) return min * 60 + sec;
    }
    const num = parseFloat(str.replace(',', '.'));
    return !isNaN(num) ? num : null;
  }

  function handleCardAction(e: Event) {
    const target = e.target as HTMLElement;
    const actionEl = target.closest('[data-action]') as HTMLElement | null;
    const cardEl = target.closest('.lyr-card') as HTMLElement | null;
    if (!cardEl) return;
    const idx = +(cardEl.dataset.idx || 0);
    const item = S.lyr[idx];
    if (!item) return;

    if (!actionEl) {
      selectLyrBlock(item.id);
      seek(item.t);
      return;
    }

    const action = actionEl.dataset.action;

    if (action === 'play') {
      e.stopPropagation();
      stopAllPreviews();
      seek(item.t);
      selectLyrBlock(item.id);
      resumeAudioContext('Nghe thử câu').then(() => {
        if (!S.playing) play();
      });
    } else if (action === 'nudge-minus') {
      e.stopPropagation();
      pushLyricHistory();
      item.t = Math.max(0, parseFloat((item.t - 0.1).toFixed(2)));
      syncLyrToEditor(false);
      toast(`Câu #${idx + 1}: ${fmt(item.t)} (-0.1s)`);
    } else if (action === 'nudge-plus') {
      e.stopPropagation();
      pushLyricHistory();
      item.t = parseFloat((item.t + 0.1).toFixed(2));
      syncLyrToEditor(false);
      toast(`Câu #${idx + 1}: ${fmt(item.t)} (+0.1s)`);
    } else if (action === 'split') {
      e.stopPropagation();
      splitLyricAtHeadOrMid(idx);
    } else if (action === 'merge') {
      e.stopPropagation();
      mergeLyricRow(idx);
    } else if (action === 'delete') {
      e.stopPropagation();
      deleteLyricRow(idx);
    }
  }

  function handleCardChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const action = target.dataset.action;
    const cardEl = target.closest('.lyr-card') as HTMLElement | null;
    if (!cardEl) return;
    const idx = +(cardEl.dataset.idx || 0);
    const item = S.lyr[idx];
    if (!item) return;

    if (action === 'text') {
      const val = target.value.trim();
      if (val !== item.text) {
        pushLyricHistory();
        item.text = val;
        syncLyrToEditor(false);
      }
    } else if (action === 'start') {
      const t = parseTimeStr(target.value);
      if (t != null && t >= 0) {
        pushLyricHistory();
        item.t = parseFloat(t.toFixed(2));
        S.lyr.sort((a, b) => a.t - b.t);
        syncLyrToEditor(false);
      } else {
        target.value = fmt(item.t);
      }
    } else if (action === 'end') {
      const endT = parseTimeStr(target.value);
      if (endT != null && endT > item.t) {
        pushLyricHistory();
        item.endT = parseFloat(endT.toFixed(2));
        syncLyrToEditor(false);
      } else {
        target.value = fmt(item.endT || item.t + 3);
      }
    }
  }

  function splitLyricAtHeadOrMid(idx: number) {
    const cur = S.lyr[idx];
    if (!cur) return;
    pushLyricHistory();
    const words = cur.text.split(' ');
    const midWord = Math.max(1, Math.round(words.length / 2));
    const txt1 = words.slice(0, midWord).join(' ') || cur.text;
    const txt2 = words.slice(midWord).join(' ') || '...';

    const curEnd = cur.endT || (cur.t + 3);
    const splitT = parseFloat(((cur.t + curEnd) / 2).toFixed(2));
    cur.endT = splitT;
    cur.text = txt1;

    const nextId = ++lyrUid;
    S.lyr.splice(idx + 1, 0, {
      id: nextId,
      t: splitT,
      endT: curEnd,
      text: txt2,
      color: cur.color,
      hi: cur.hi,
      size: cur.size
    });

    selectLyrBlock(nextId);
    syncLyrToEditor(false);
    toast(`Đã tách câu #${idx + 1} thành 2 câu.`);
  }

  function mergeLyricRow(idx: number) {
    if (idx >= S.lyr.length - 1) return toast('Đây là câu cuối cùng, không có câu sau để gộp.');
    pushLyricHistory();
    const cur = S.lyr[idx];
    const nxt = S.lyr[idx + 1];
    cur.text = (cur.text + ' ' + nxt.text).trim();
    cur.endT = Math.max(cur.endT || 0, nxt.endT || 0);
    S.lyr.splice(idx + 1, 1);
    selectLyrBlock(cur.id);
    syncLyrToEditor(false);
    toast(`Đã gộp với câu kế tiếp.`);
  }

  function deleteLyricRow(idx: number) {
    pushLyricHistory();
    S.lyr.splice(idx, 1);
    S.selLyrId = S.lyr[Math.min(idx, S.lyr.length - 1)]?.id || null;
    syncLyrToEditor(false);
    toast('Đã xóa câu.');
  }

  function addLyricAtPlayhead() {
    pushLyricHistory();
    const newId = ++lyrUid;
    const t = Math.max(0, parseFloat(S.t.toFixed(2)));
    const endT = parseFloat((t + 3.0).toFixed(2));
    S.lyr.push({ id: newId, t, endT, text: 'Câu mới' });
    S.lyr.sort((a, b) => a.t - b.t);
    selectLyrBlock(newId);
    syncLyrToEditor(false);
    toast('Đã thêm câu mới tại ' + fmt(t));
  }

  function splitLyricAtPlayhead() {
    const cur = selLyr();
    if (!cur) return toast('Hãy chọn một câu trên timeline để tách.');
    if (S.t <= cur.t + 0.1 || S.t >= cur.endT - 0.1) {
      return toast('Đầu phát phải nằm trong khoảng thời gian của câu để tách.');
    }
    pushLyricHistory();
    const words = cur.text.split(' ');
    const frac = clamp((S.t - cur.t) / (cur.endT - cur.t), 0.1, 0.9);
    const mid = Math.max(1, Math.round(words.length * frac));
    const txt1 = words.slice(0, mid).join(' ') || cur.text;
    const txt2 = words.slice(mid).join(' ') || '...';
    const origEnd = cur.endT;
    cur.endT = parseFloat(S.t.toFixed(2));
    cur.text = txt1;
    const nextId = ++lyrUid;
    S.lyr.push({
      id: nextId,
      t: parseFloat(S.t.toFixed(2)),
      endT: origEnd,
      text: txt2,
      color: cur.color,
      hi: cur.hi,
      size: cur.size
    });
    S.lyr.sort((a, b) => a.t - b.t);
    selectLyrBlock(nextId);
    syncLyrToEditor(false);
    toast('Đã tách thành 2 câu tại ' + fmt(S.t));
  }

  function mergeLyricWithNext() {
    const cur = selLyr();
    if (!cur) return toast('Hãy chọn một câu trên timeline để gộp.');
    const idx = S.lyr.findIndex(l => l.id === cur.id);
    mergeLyricRow(idx);
  }

  function deleteLyricLine() {
    const cur = selLyr();
    if (!cur) return toast('Hãy chọn một câu trên timeline để xóa.');
    const idx = S.lyr.findIndex(l => l.id === cur.id);
    deleteLyricRow(idx);
  }

  function shiftLyr(d: number) {
    if (!S.lyr.length) return toast('Chưa có danh sách câu để dịch.');
    pushLyricHistory();
    S.lyr.forEach(l => {
      l.t = Math.max(0, parseFloat((l.t + d).toFixed(2)));
      if (l.endT) l.endT = Math.max(l.t + 0.3, parseFloat((l.endT + d).toFixed(2)));
    });
    syncLyrToEditor(false);
    toast(`Đã dịch tất cả các câu ${d > 0 ? '+' : ''}${d.toFixed(2)}s.`);
  }

  function clearAllTimes() {
    if (!S.lyr.length) return toast('Chưa có câu nào.');
    pushLyricHistory();
    S.lyr.forEach((l) => {
      l.t = 0;
      l.endT = 0;
    });
    tapIndex = 0;
    syncLyrToEditor(false);
    toast('Đã xóa toàn bộ mốc giờ. Giữ nguyên toàn bộ câu chữ.');
  }

  function setSpeed(rate: number) {
    S.speed = rate;
    if (A.sourceNode && A.ctx) {
      try { A.sourceNode.playbackRate.setValueAtTime(rate, A.ctx.currentTime); } catch (e) {}
    }
    if (A.previewSourceNode && A.ctx) {
      try { A.previewSourceNode.playbackRate.setValueAtTime(rate, A.ctx.currentTime); } catch (e) {}
    }
    if (A.trimSourceNode && A.ctx) {
      try { A.trimSourceNode.playbackRate.setValueAtTime(rate, A.ctx.currentTime); } catch (e) {}
    }
    if (S.playing) {
      tbase = S.t;
      t0 = performance.now();
    }
    ['0.5', '0.75', '1.0'].forEach(s => {
      const btn = document.querySelector('[data-speed="' + s + '"]');
      if (btn) {
        const isCur = Math.abs(parseFloat(s) - rate) < 0.01;
        btn.setAttribute('aria-pressed', String(isCur));
      }
    });
    toast('Tốc độ phát: ' + rate + 'x');
  }

  function switchLyricStep(step: 1 | 2 | 3) {
    currentLyrStep = step;
    [1, 2, 3].forEach(s => {
      const btn = document.getElementById('btnLyrStep' + s);
      const pane = document.getElementById('lyrStep' + s + 'Pane');
      if (btn) btn.classList.toggle('active', s === step);
      if (pane) pane.style.display = s === step ? 'grid' : 'none';
    });

    if (step === 1) {
      const rawEl = $('#lyrRawInput') as HTMLTextAreaElement | null;
      if (rawEl && !rawEl.value.trim() && S.lyr.length) {
        rawEl.value = rawLyricLines().join('\n');
      }
    } else if (step === 2) {
      updateTapStageUI();
    } else if (step === 3) {
      renderLyricCards();
    }
  }

  function renderLyricUI() {
    if (currentLyrStep === 2) updateTapStageUI();
    else if (currentLyrStep === 3) renderLyricCards();
    const rawEl = $('#lyrRawInput') as HTMLTextAreaElement | null;
    if (rawEl && !rawEl.matches(':focus')) {
      rawEl.value = rawLyricLines().join('\n');
    }
    const lyrCardsTotal = $('#lyrCardsTotalBadge');
    if (lyrCardsTotal) lyrCardsTotal.textContent = `${S.lyr.length} câu`;
  }

  function updateActiveLyricCard(t: number) {
    if (currentLyrStep !== 3) return;
    const activeItem = S.lyr.find(l => t >= l.t && t < (l.endT || l.t + 3));
    const activeId = activeItem ? activeItem.id : null;
    if (activeId === lastActiveCardId) return;
    lastActiveCardId = activeId;

    document.querySelectorAll('.lyr-card.active-playing').forEach(el => el.classList.remove('active-playing'));
    if (activeId != null) {
      const cardEl = document.getElementById('card-lyr-' + activeId);
      if (cardEl) {
        cardEl.classList.add('active-playing');
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  function showLyrInlineEditor(ly: LyricItem, blockEl: HTMLElement) {
    const existing = document.querySelector('.lyr-inline-editor');
    if (existing) existing.remove();

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'lyr-inline-editor';
    input.value = ly.text;
    const left = blockEl.offsetLeft;
    const width = Math.max(220, blockEl.offsetWidth + 40);

    input.style.left = left + 'px';
    input.style.width = width + 'px';
    const tlEl = $('#tl');
    if (!tlEl) return;
    tlEl.appendChild(input);

    input.focus();
    input.select();

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      const val = input.value.trim();
      if (val !== ly.text) {
        pushLyricHistory();
        ly.text = val;
        syncLyrToEditor(false);
        toast('Đã cập nhật câu hát');
      }
      input.remove();
    };

    const cancel = () => {
      if (committed) return;
      committed = true;
      input.remove();
    };

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });

    input.addEventListener('blur', () => {
      commit();
    });
  }

  /* ---------- âm thanh ---------- */
  function setAudioError(msg: string) {
    A.error = msg;
    const errEl = $('#astError');
    if (errEl) {
      errEl.textContent = msg || 'Không có lỗi';
      errEl.style.color = msg ? 'var(--danger)' : 'var(--accent)';
    }
  }

  function updateAudioStatus() {
    const nameEl = $('#astName');
    const durEl = $('#astDur');
    const loadEl = $('#astLoad');
    const ctxEl = $('#astCtx');
    const badgeEl = $('#astCtxBadge');
    const errEl = $('#astError');

    if (nameEl) nameEl.textContent = A.name || 'Chưa chọn';
    if (durEl) durEl.textContent = fmt(A.dur);
    if (loadEl) loadEl.textContent = A.loadState;
    if (errEl) {
      errEl.textContent = A.error || 'Không có lỗi';
      errEl.style.color = A.error ? 'var(--danger)' : 'var(--accent)';
    }

    const state = A.ctx ? A.ctx.state : 'chưa khởi tạo';
    if (ctxEl) ctxEl.textContent = state;

    if (badgeEl) {
      badgeEl.className = 'badge ' + (state === 'running' ? 'success' : state === 'suspended' ? 'warn' : 'neutral');
      badgeEl.textContent = 'AudioContext: ' + (state === 'running' ? 'running' : state === 'suspended' ? 'suspended (Bấm resume)' : state);
    }

    updatePreviewUI();
  }

  function ensureGraph(): boolean {
    if (A.ctx && A.ctx.state !== 'closed' && A.gain && A.analyser && A.dest) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        setAudioError('Trình duyệt không hỗ trợ Web Audio API.');
        return false;
      }
      if (!A.ctx || A.ctx.state === 'closed') {
        A.ctx = new AC();
        A.ctx.onstatechange = () => {
          updateAudioStatus();
        };
      }
      if (!A.gain) {
        A.gain = A.ctx.createGain();
      }
      if (!A.eqBass) {
        A.eqBass = A.ctx.createBiquadFilter();
        A.eqBass.type = 'lowshelf';
        A.eqBass.frequency.value = 120;
        A.eqBass.gain.value = 0;
      }
      if (!A.eqMid) {
        A.eqMid = A.ctx.createBiquadFilter();
        A.eqMid.type = 'peaking';
        A.eqMid.frequency.value = 1000;
        A.eqMid.Q.value = 1.0;
        A.eqMid.gain.value = 0;
      }
      if (!A.eqTreble) {
        A.eqTreble = A.ctx.createBiquadFilter();
        A.eqTreble.type = 'highshelf';
        A.eqTreble.frequency.value = 4500;
        A.eqTreble.gain.value = 0;
      }
      if (!A.compressor) {
        A.compressor = A.ctx.createDynamicsCompressor();
        A.compressor.threshold.value = -24;
        A.compressor.knee.value = 30;
        A.compressor.ratio.value = 12;
        A.compressor.attack.value = 0.003;
        A.compressor.release.value = 0.25;
      }
      if (!A.analyser) {
        A.analyser = A.ctx.createAnalyser();
        A.analyser.fftSize = 256;
        A.analyser.smoothingTimeConstant = 0.6;
      }
      if (!A.dest) {
        A.dest = A.ctx.createMediaStreamDestination();
      }

      // Xây dựng chuỗi hiệu ứng: Gain -> EQ Bass -> EQ Mid -> EQ Treble -> Compressor -> Analyser -> [Loa, MediaStreamDestination]
      A.gain.disconnect();
      A.gain.connect(A.eqBass);
      A.eqBass.disconnect();
      A.eqBass.connect(A.eqMid);
      A.eqMid.disconnect();
      A.eqMid.connect(A.eqTreble);
      A.eqTreble.disconnect();
      A.eqTreble.connect(A.compressor);
      A.compressor.disconnect();
      A.compressor.connect(A.analyser);
      A.analyser.disconnect();
      A.analyser.connect(A.ctx.destination);
      A.analyser.connect(A.dest);

      updateAudioStatus();
      return true;
    } catch (e: any) {
      console.error('ensureGraph failed:', e);
      setAudioError('Lỗi khởi tạo Web Audio: ' + (e?.message || e));
      updateAudioStatus();
      return false;
    }
  }

  async function resumeAudioContext(source: string = 'Phát'): Promise<boolean> {
    ensureGraph();
    if (!A.ctx) return false;
    if (A.ctx.state === 'suspended') {
      try {
        await A.ctx.resume();
        toast('Đã kích hoạt AudioContext (' + A.ctx.state + ')');
        updateAudioStatus();
        return true;
      } catch (e: any) {
        toast('Không thể kích hoạt âm thanh (' + source + '): ' + (e?.message || e));
        setAudioError('Resume AudioContext thất bại: ' + (e?.message || e));
        updateAudioStatus();
        return false;
      }
    }
    updateAudioStatus();
    return true;
  }

  function isAudioPlaying(): boolean {
    return (S.playing && !!A.sourceNode) || A.isPreviewing || A.isTrimPreviewing;
  }

  let vuRaf = 0;
  function updateVUMeter() {
    if (!A.analyser || !isAudioPlaying()) {
      const fill = $('#vuFill');
      const val = $('#vuVal');
      if (fill) fill.style.width = '0%';
      if (val) val.textContent = '0% (Yên lặng)';
      return;
    }

    const data = new Uint8Array(A.analyser.frequencyBinCount);
    A.analyser.getByteFrequencyData(data);
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
      if (data[i] > peak) peak = data[i];
    }
    const avg = sum / data.length;
    const level = Math.min(100, Math.round(((avg * 0.65 + peak * 0.35) / 255) * 100));

    const fill = $('#vuFill');
    const val = $('#vuVal');
    if (fill) fill.style.width = level + '%';
    if (val) {
      if (level === 0) val.textContent = '0% (Yên lặng)';
      else val.textContent = level + '% (Đang có tín hiệu)';
    }

    vuRaf = requestAnimationFrame(updateVUMeter);
  }

  function startVUMeter() {
    cancelAnimationFrame(vuRaf);
    vuRaf = requestAnimationFrame(updateVUMeter);
  }

  function getPreviewCurrentTime(): number {
    if (!A.isPreviewing || !A.ctx) return A.previewOffset;
    const speed = S.speed || 1.0;
    const elapsed = (A.ctx.currentTime - A.previewStartTime) * speed;
    return clamp(A.previewOffset + elapsed, 0, A.dur || 0);
  }

  let prevRaf = 0;
  function tickPreview() {
    if (!A.isPreviewing) return;
    const cur = getPreviewCurrentTime();
    if (cur >= (A.dur || 0) - 0.05) {
      stopPreview();
      return;
    }
    updatePreviewUI();
    prevRaf = requestAnimationFrame(tickPreview);
  }

  function updatePreviewUI() {
    const cur = getPreviewCurrentTime();
    const dur = A.dur || 0;
    const scrub = $('#prevScrub') as HTMLInputElement | null;
    const timeLbl = $('#prevTimeLbl');
    if (scrub) {
      scrub.max = dur.toFixed(2);
      if (!scrub.matches(':active')) {
        scrub.value = cur.toFixed(2);
      }
    }
    if (timeLbl) {
      timeLbl.textContent = fmt(cur) + ' / ' + fmt(dur);
    }
    const btn = $('#btnPrevPlay');
    if (btn) {
      btn.textContent = A.isPreviewing ? '⏸ Tạm dừng' : '▶ Nghe thử';
    }
  }

  async function startPreview() {
    if (!A.loaded || !A.buffer) {
      return toast('Hãy chọn file nhạc trước.');
    }
    stopAllPreviews();
    if (S.playing) pause();
    await resumeAudioContext('Nghe thử');

    if (A.previewOffset >= (A.dur || 0) - 0.1) {
      A.previewOffset = 0;
    }

    try {
      const src = A.ctx!.createBufferSource();
      src.buffer = A.buffer;
      src.playbackRate.value = S.speed || 1.0;
      src.connect(A.gain!);
      const offset = clamp(A.previewOffset, 0, A.buffer.duration);
      src.start(0, offset);
      A.previewSourceNode = src;
      A.previewStartTime = A.ctx!.currentTime;
      A.isPreviewing = true;
      applyVol(true);
      src.onended = () => {
        if (A.isPreviewing && A.previewSourceNode === src) {
          stopPreview();
        }
      };
      toast('Đang phát nghe thử file nhạc qua Audio Engine');
    } catch (e: any) {
      setAudioError('Lỗi phát nghe thử: ' + (e?.message || e));
      A.isPreviewing = false;
    }
    updatePreviewUI();
    updateAudioStatus();
    startVUMeter();
    cancelAnimationFrame(prevRaf);
    prevRaf = requestAnimationFrame(tickPreview);
  }

  function pausePreview() {
    cancelAnimationFrame(prevRaf);
    if (A.isPreviewing && A.ctx) {
      A.previewOffset = getPreviewCurrentTime();
    }
    if (A.previewSourceNode) {
      try {
        A.previewSourceNode.onended = null;
        A.previewSourceNode.stop();
        A.previewSourceNode.disconnect();
      } catch (e) {}
      A.previewSourceNode = null;
    }
    A.isPreviewing = false;
    updatePreviewUI();
    updateAudioStatus();
  }

  function stopPreview() {
    cancelAnimationFrame(prevRaf);
    if (A.previewSourceNode) {
      try {
        A.previewSourceNode.onended = null;
        A.previewSourceNode.stop();
        A.previewSourceNode.disconnect();
      } catch (e) {}
      A.previewSourceNode = null;
    }
    A.isPreviewing = false;
    A.previewOffset = 0;
    const scrub = $('#prevScrub') as HTMLInputElement | null;
    if (scrub) scrub.value = '0';
    updatePreviewUI();
    updateAudioStatus();
  }

  async function loadAudio(f: File) {
    if (A.url) URL.revokeObjectURL(A.url);
    if (A.isPreviewing) stopPreview();

    A.file = f;
    A.url = URL.createObjectURL(f);
    A.el.src = A.url;
    A.el.load();
    A.name = f.name;
    A.loaded = false;
    A.error = '';
    A.loadState = 'Đang đọc file & phân tích...';
    updateAudioStatus();

    ensureGraph();

    try {
      const ab = await f.arrayBuffer();
      const abCopy = ab.slice(0);
      const ac = A.ctx || new (window.AudioContext || window.webkitAudioContext!)();
      let buf: AudioBuffer;
      try {
        buf = await ac.decodeAudioData(abCopy);
      } catch (e1) {
        buf = await new Promise<AudioBuffer>((res, rej) => ac.decodeAudioData(ab.slice(0), res, rej));
      }
      A.dur = buf.duration;
      A.start = 0;
      A.end = A.dur;
      A.buffer = buf;
      const ch = buf.getChannelData(0);
      
      // Peaks for timeline (20 per sec)
      const per = 20, n = Math.ceil(A.dur * per), step = Math.floor(ch.length / n) || 1;
      A.peaks = [];
      for (let i = 0; i < n; i++) {
        let m = 0;
        for (let j = i * step; j < Math.min(ch.length, (i + 1) * step); j += Math.max(1, step >> 6)) {
          const v = Math.abs(ch[j]);
          if (v > m) m = v;
        }
        A.peaks.push(m);
      }

      // High-res raw peaks for large waveform editor (50 per sec)
      const rawPer = 50, rawN = Math.ceil(A.dur * rawPer), rawStep = Math.floor(ch.length / rawN) || 1;
      A.rawPeaks = [];
      for (let i = 0; i < rawN; i++) {
        let m = 0;
        for (let j = i * rawStep; j < Math.min(ch.length, (i + 1) * rawStep); j += Math.max(1, rawStep >> 5)) {
          const v = Math.abs(ch[j]);
          if (v > m) m = v;
        }
        A.rawPeaks.push(m);
      }

      A.loaded = true;
      A.loadState = 'Đã giải mã (' + buf.sampleRate + 'Hz, ' + (buf.numberOfChannels === 2 ? 'stereo' : 'mono') + ')';
      S.audioBlocks = [{
        id: ++audioUid,
        start: 0,
        srcIn: 0,
        srcOut: A.dur,
        dur: A.dur
      }];
      S.selAudioId = S.audioBlocks[0].id;
      autoFitImagesToMusic();
    } catch (e: any) {
      console.warn('decodeAudioData failed:', e);
      A.loadState = 'decodeAudioData không được, đang đọc thẻ audio...';
      updateAudioStatus();
      try {
        await once(A.el, 'loadedmetadata');
        A.dur = A.el.duration || 0;
        A.start = 0;
        A.end = A.dur;
        A.peaks = [];
        A.rawPeaks = [];
        A.loaded = A.dur > 0;
        A.loadState = 'Đã đọc metadata thẻ audio (không có sóng âm: ' + (e?.message || e) + ')';
        setAudioError('Lưu ý decodeAudioData: ' + (e?.message || e));
        if (A.loaded) {
          S.audioBlocks = [{
            id: ++audioUid,
            start: 0,
            srcIn: 0,
            srcOut: A.dur,
            dur: A.dur
          }];
          S.selAudioId = S.audioBlocks[0].id;
          autoFitImagesToMusic();
        }
      } catch (err2: any) {
        A.loaded = false;
        A.loadState = 'Thất bại';
        setAudioError('Lỗi đọc file: ' + (err2?.message || err2));
      }
    }

    const aInfo = $('#audioInfo');
    if (aInfo) aInfo.textContent = A.loaded ? (A.name + ' (' + fmt(A.dur) + ')') : 'Không đọc được file nhạc này.';
    renderWaveformEditor();
    applyVol();
    refreshAll();
    updateAudioStatus();
    startVUMeter();
  }

  /* ---------- Vẽ & điều khiển sóng âm lớn ---------- */
  function renderWaveformEditor() {
    const cvEl = $('#wfCv') as HTMLCanvasElement | null;
    const trackEl = $('#wfTrack');
    if (!cvEl || !trackEl) return;

    const dur = A.dur || 1;
    if (A.end <= A.start || A.end > dur) {
      A.end = dur;
    }

    const wrapEl = $('#wfWrap');
    const wrapW = wrapEl ? Math.max(300, wrapEl.clientWidth) : 360;
    const zoom = A.wfZoom || 1;
    const trackWidth = Math.max(wrapW, Math.round(dur * 22 * zoom));

    trackEl.style.width = trackWidth + 'px';
    cvEl.width = trackWidth;
    cvEl.height = 100;
    cvEl.style.width = trackWidth + 'px';

    const ctxW = cvEl.getContext('2d')!;
    ctxW.clearRect(0, 0, trackWidth, 100);

    // Đường cơ sở
    ctxW.fillStyle = '#263238';
    ctxW.fillRect(0, 50, trackWidth, 1);

    // Vẽ các cột sóng âm
    const peaks = A.rawPeaks.length ? A.rawPeaks : A.peaks;
    if (peaks.length) {
      const pps = trackWidth / peaks.length;
      const startPx = (A.start / dur) * trackWidth;
      const endPx = (A.end / dur) * trackWidth;

      for (let i = 0; i < peaks.length; i++) {
        const x = i * pps;
        const pk = peaks[i];
        const h = Math.max(2, pk * 90);
        const inSelection = x >= startPx && x <= endPx;
        ctxW.fillStyle = inSelection ? '#2dd4bf' : '#546e7a';
        ctxW.globalAlpha = inSelection ? 0.95 : 0.35;
        ctxW.fillRect(x, 50 - h / 2, Math.max(1, pps - 0.5), h);
      }
      ctxW.globalAlpha = 1;
    }

    // Thước đo thời gian trên sóng âm
    const rulerEl = $('#wfRuler');
    if (rulerEl) {
      rulerEl.style.width = trackWidth + 'px';
      let rHtml = '';
      const step = zoom >= 5 ? 1 : zoom >= 3 ? 2 : zoom >= 1.5 ? 5 : 10;
      for (let sec = 0; sec <= dur + 1; sec += step) {
        const x = (sec / dur) * trackWidth;
        rHtml += '<span style="left:' + x + 'px">' + fmt(sec) + '</span>';
      }
      rulerEl.innerHTML = rHtml;
    }

    // Tọa độ vùng chọn và 2 mốc
    const startX = (A.start / dur) * trackWidth;
    const endX = (A.end / dur) * trackWidth;

    const overlayL = $('#wfOverlayLeft');
    if (overlayL) overlayL.style.width = startX + 'px';

    const overlayR = $('#wfOverlayRight');
    if (overlayR) overlayR.style.width = Math.max(0, trackWidth - endX) + 'px';

    const regionEl = $('#wfRegion');
    if (regionEl) {
      regionEl.style.left = startX + 'px';
      regionEl.style.width = Math.max(2, endX - startX) + 'px';
    }

    const handleS = $('#wfHandleStart');
    if (handleS) handleS.style.left = startX + 'px';

    const handleE = $('#wfHandleEnd');
    if (handleE) handleE.style.left = endX + 'px';

    // Đường dốc fade-in và fade-out
    const slopeIn = $('#wfFadeSlopeIn');
    if (slopeIn) {
      const inPx = (A.fadeIn / dur) * trackWidth;
      slopeIn.style.width = Math.min(inPx, endX - startX) + 'px';
      slopeIn.hidden = A.fadeIn <= 0;
    }
    const slopeOut = $('#wfFadeSlopeOut');
    if (slopeOut) {
      const outPx = (A.fadeOut / dur) * trackWidth;
      slopeOut.style.width = Math.min(outPx, endX - startX) + 'px';
      slopeOut.hidden = A.fadeOut <= 0;
    }

    // Cập nhật các ô input & nhãn
    const inputS = $('#aTrimStart');
    const inputE = $('#aTrimEnd');
    const durLbl = $('#aTrimDur');
    const zoomLbl = $('#wfZoomLbl');
    const fadeInInput = $('#aFadeIn');
    const fadeOutInput = $('#aFadeOut');

    if (inputS && !inputS.matches(':focus')) inputS.value = A.start.toFixed(1);
    if (inputE && !inputE.matches(':focus')) inputE.value = A.end.toFixed(1);
    if (durLbl) durLbl.textContent = fmt(Math.max(0, A.end - A.start));
    if (zoomLbl) zoomLbl.textContent = zoom + 'x';
    if (fadeInInput && !fadeInInput.matches(':focus')) fadeInInput.value = A.fadeIn.toFixed(1);
    if (fadeOutInput && !fadeOutInput.matches(':focus')) fadeOutInput.value = A.fadeOut.toFixed(1);
  }

  function getTrimCurrentTime(): number {
    if (!A.isTrimPreviewing || !A.ctx) return A.start;
    const speed = S.speed || 1.0;
    const elapsed = (A.ctx.currentTime - A.trimStartTime) * speed;
    return clamp(A.start + elapsed, A.start, A.end);
  }

  let trimRaf = 0;
  function tickTrim() {
    if (!A.isTrimPreviewing) return;
    const cur = getTrimCurrentTime();
    if (cur >= A.end - 0.05) {
      stopTrimPreview();
      return;
    }
    updateTrimPlayhead();
    trimRaf = requestAnimationFrame(tickTrim);
  }

  function updateTrimPlayhead() {
    const playhead = $('#wfPlayhead');
    const timeLbl = $('#wfPlayTime');
    const dur = A.dur || 1;
    const trackWidth = $('#wfTrack')?.clientWidth || 360;

    if (!A.isTrimPreviewing) {
      if (playhead) playhead.hidden = true;
      return;
    }

    const cur = getTrimCurrentTime();
    if (playhead) {
      playhead.hidden = false;
      playhead.style.left = ((cur / dur) * trackWidth) + 'px';
    }
    if (timeLbl) {
      timeLbl.textContent = fmt(cur - A.start) + ' / ' + fmt(A.end - A.start);
    }
    applyVol(true);
  }

  async function startTrimPreview() {
    if (!A.loaded || !A.buffer || A.dur <= 0) return toast('Hãy chọn file nhạc trước.');
    stopAllPreviews();
    if (S.playing) pause();
    await resumeAudioContext('Nghe thử đoạn chọn');

    const sliceDur = Math.max(0.1, A.end - A.start);
    try {
      const src = A.ctx!.createBufferSource();
      src.buffer = A.buffer;
      src.playbackRate.value = S.speed || 1.0;
      src.connect(A.gain!);
      src.start(0, A.start, sliceDur);
      A.trimSourceNode = src;
      A.trimStartTime = A.ctx!.currentTime;
      A.isTrimPreviewing = true;
      applyVol(true);
      src.onended = () => {
        if (A.isTrimPreviewing && A.trimSourceNode === src) {
          stopTrimPreview();
        }
      };
      toast('Đang nghe thử đoạn: ' + fmt(A.start) + ' -> ' + fmt(A.end));
    } catch (e: any) {
      setAudioError('Lỗi phát nghe thử: ' + (e?.message || e));
      A.isTrimPreviewing = false;
    }
    const btn = $('#btnPlayTrim');
    if (btn) btn.textContent = '⏸ Tạm dừng';
    startVUMeter();
    updateTrimPlayhead();
    cancelAnimationFrame(trimRaf);
    trimRaf = requestAnimationFrame(tickTrim);
  }

  function stopTrimPreview() {
    cancelAnimationFrame(trimRaf);
    if (A.trimSourceNode) {
      try {
        A.trimSourceNode.onended = null;
        A.trimSourceNode.stop();
        A.trimSourceNode.disconnect();
      } catch (e) {}
      A.trimSourceNode = null;
    }
    A.isTrimPreviewing = false;
    const btn = $('#btnPlayTrim');
    if (btn) btn.textContent = '▶ Nghe thử đoạn chọn';
    const playhead = $('#wfPlayhead');
    if (playhead) playhead.hidden = true;
    updateAudioStatus();
  }

  /* ---------- Điều chỉnh âm lượng & Fade vào / Fade ra ---------- */
  function applyVol(isIndependent = false) {
    let f = 1;
    const segDur = musicDuration();
    if (segDur > 0) {
      const pos = A.isTrimPreviewing ? Math.max(0, getTrimCurrentTime() - A.start) : S.t;
      // Fade vào
      let fIn = 1;
      if (A.fadeIn > 0) {
        fIn = clamp(pos / A.fadeIn, 0, 1);
      }
      // Fade ra
      let fOut = 1;
      if (A.fadeOut > 0) {
        const rem = segDur - pos;
        fOut = clamp(rem / A.fadeOut, 0, 1);
      }
      f = fIn * fOut;
    }
    const targetVol = clamp(A.vol * f, 0, 1);
    if (A.gain && A.ctx) {
      A.gain.gain.setValueAtTime(targetVol, A.ctx.currentTime);
    }
    A.el.volume = clamp(A.vol, 0, 1);
  }

  /* ---------- Xuất riêng file âm thanh đã cắt ---------- */
  async function getDecodedAudioBuffer(): Promise<AudioBuffer | null> {
    if (A.buffer) return A.buffer;
    if (!A.loaded && !A.file && !A.url && !A.el.src) return null;
    const ac = A.ctx || new (window.AudioContext || (window as any).webkitAudioContext)();
    let ab: ArrayBuffer | null = null;
    if (A.file) {
      ab = await A.file.arrayBuffer();
    } else {
      const srcUrl = A.url || A.el.src;
      if (srcUrl) {
        const res = await fetch(srcUrl);
        ab = await res.arrayBuffer();
      }
    }
    if (!ab) return null;
    try {
      const buf = await ac.decodeAudioData(ab.slice(0));
      A.buffer = buf;
      return buf;
    } catch (e) {
      return await new Promise<AudioBuffer>((res, rej) => {
        ac.decodeAudioData(ab!.slice(0), res, rej);
      });
    }
  }

  async function exportTrimmedAudio(format: 'wav' | 'mp3' = 'wav') {
    if (!A.loaded && !A.file && !A.url && !A.el.src) {
      return toast('Chưa có nhạc. Vui lòng chọn file nhạc trước.');
    }
    const statusEl = $('#exportAudioStatus');
    const prevStatus = statusEl ? statusEl.textContent : 'Đoạn chọn + Âm lượng + Fade';

    const blocks = S.audioBlocks.length > 0 ? S.audioBlocks : [{
      id: 1,
      start: 0,
      srcIn: 0,
      srcOut: A.dur || 1,
      dur: A.dur || 1
    }];

    const totalDur = Math.max(0.2, blocks.reduce((max, b) => Math.max(max, b.start + b.dur), 0));

    try {
      if (statusEl) statusEl.textContent = 'Đang giải mã âm thanh...';
      toast(`Đang kết xuất âm thanh timeline (${fmt(totalDur)}) sang ${format.toUpperCase()}...`);

      const rawBuf = await getDecodedAudioBuffer();
      if (!rawBuf) {
        if (statusEl) statusEl.textContent = prevStatus;
        return toast('Không đọc được dữ liệu âm thanh để xuất.');
      }

      if (statusEl) statusEl.textContent = 'Đang ghép các đoạn & áp dụng âm lượng...';
      const sampleRate = rawBuf.sampleRate;
      const numChannels = rawBuf.numberOfChannels;
      const totalFrames = Math.max(1, Math.ceil(totalDur * sampleRate));
      const offlineCtx = new OfflineAudioContext(numChannels, totalFrames, sampleRate);

      // Chuỗi hiệu ứng ngoại tuyến (Gain -> EQ Bass/Mid/Treble -> Compressor -> offlineCtx.destination)
      const offGain = offlineCtx.createGain();
      offGain.gain.value = A.vol;

      const offEqBass = offlineCtx.createBiquadFilter();
      offEqBass.type = 'lowshelf';
      offEqBass.frequency.value = 120;
      offEqBass.gain.value = 0;

      const offEqMid = offlineCtx.createBiquadFilter();
      offEqMid.type = 'peaking';
      offEqMid.frequency.value = 1000;
      offEqMid.Q.value = 1.0;
      offEqMid.gain.value = 0;

      const offEqTreble = offlineCtx.createBiquadFilter();
      offEqTreble.type = 'highshelf';
      offEqTreble.frequency.value = 4500;
      offEqTreble.gain.value = 0;

      const offComp = offlineCtx.createDynamicsCompressor();
      offComp.threshold.value = -24;
      offComp.knee.value = 30;
      offComp.ratio.value = 12;
      offComp.attack.value = 0.003;
      offComp.release.value = 0.25;

      offGain.connect(offEqBass);
      offEqBass.connect(offEqMid);
      offEqMid.connect(offEqTreble);
      offEqTreble.connect(offComp);
      offComp.connect(offlineCtx.destination);

      blocks.forEach(b => {
        const src = offlineCtx.createBufferSource();
        src.buffer = rawBuf;
        src.connect(offGain);
        src.start(b.start, b.srcIn, b.dur);
      });

      const rendered = await offlineCtx.startRendering();

      // Apply fade in & fade out if specified
      if (A.fadeIn > 0 || A.fadeOut > 0) {
        for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
          const data = rendered.getChannelData(ch);
          const fadeInFrames = Math.floor(Math.min(A.fadeIn, totalDur) * sampleRate);
          for (let i = 0; i < fadeInFrames; i++) {
            data[i] *= (i / fadeInFrames);
          }
          const fadeOutFrames = Math.floor(Math.min(A.fadeOut, totalDur) * sampleRate);
          const startFadeOut = totalFrames - fadeOutFrames;
          for (let i = startFadeOut; i < totalFrames; i++) {
            data[i] *= Math.max(0, (totalFrames - i) / fadeOutFrames);
          }
        }
      }

      const cleanName = (A.name || 'audio')
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
      const baseFilename = `${cleanName}_timeline_${fmt(totalDur).replace(':', 'm')}`;

      if (format === 'wav') {
        if (statusEl) statusEl.textContent = 'Đang tạo file WAV...';
        const wavBytes = audioBufferToWav(rendered);
        const blob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
        const filename = `${baseFilename}.wav`;
        downloadBlob(blob, filename);
        toast(`Đã xuất file WAV (${(blob.size / (1024 * 1024)).toFixed(2)} MB): ${filename}`);
      } else {
        if (statusEl) statusEl.textContent = 'Đang nén MP3 192kbps...';
        await sleep(20);
        const mp3Bytes = audioBufferToMp3(rendered, 192);
        const blob = new Blob([mp3Bytes.buffer as ArrayBuffer], { type: 'audio/mp3' });
        const filename = `${baseFilename}.mp3`;
        downloadBlob(blob, filename);
        toast(`Đã xuất file MP3 (${(blob.size / (1024 * 1024)).toFixed(2)} MB): ${filename}`);
      }

      if (statusEl) {
        statusEl.textContent = `✓ Đã xuất ${format.toUpperCase()} thành công!`;
        setTimeout(() => {
          if (statusEl) statusEl.textContent = prevStatus;
        }, 3500);
      }
    } catch (err: any) {
      console.error('Lỗi xuất nhạc:', err);
      toast('Lỗi khi xuất nhạc: ' + (err?.message || err));
      if (statusEl) statusEl.textContent = 'Lỗi xuất nhạc';
    }
  }

  function stopAudioNode() {
    if (A.sourceNode) {
      try {
        A.sourceNode.onended = null;
        A.sourceNode.stop();
        A.sourceNode.disconnect();
      } catch (e) {}
      A.sourceNode = null;
    }
    A.currentAudioBlockId = null;
  }

  function startAudioNode(fileSec: number, maxDur?: number, blockId?: number | null) {
    stopAudioNode();
    if (!A.buffer || !A.ctx) return;
    try {
      const src = A.ctx.createBufferSource();
      src.buffer = A.buffer;
      src.playbackRate.value = S.speed || 1.0;
      src.connect(A.gain!);
      const offset = clamp(fileSec, 0, A.buffer.duration);
      if (maxDur != null && maxDur > 0) {
        src.start(0, offset, maxDur);
      } else {
        src.start(0, offset);
      }
      A.sourceNode = src;
      A.sourceStartSec = fileSec;
      A.sourceAudioCtxTime = A.ctx.currentTime;
      A.currentAudioBlockId = blockId ?? null;
      src.onended = () => {
        if (A.sourceNode === src) {
          A.sourceNode = null;
          A.currentAudioBlockId = null;
        }
      };
    } catch (e) {
      console.warn('startAudioNode error:', e);
    }
  }

  async function startAudio() {
    if (!A.loaded || !S.audioBlocks.length) return;
    ensureGraph();
    if (A.ctx && A.ctx.state === 'suspended') {
      try {
        await A.ctx.resume();
        toast('Đã kích hoạt AudioContext (' + A.ctx.state + ')');
      } catch (e) {}
    }
    const act = getActiveAudioAt(S.t);
    if (!act) {
      stopAudioNode();
      return;
    }
    const remInBlock = Math.max(0.05, act.block.srcOut - act.fileSec);
    applyVol(false);
    startAudioNode(act.fileSec, remInBlock, act.block.id);
    updateAudioStatus();
    startVUMeter();
  }

  function syncAudio() {
    if (!A.loaded || !S.audioBlocks.length) return;
    const act = getActiveAudioAt(S.t);
    if (!act) {
      if (A.sourceNode) stopAudioNode();
      return;
    }
    const remInBlock = Math.max(0.05, act.block.srcOut - act.fileSec);
    if (!A.sourceNode || A.currentAudioBlockId !== act.block.id) {
      startAudioNode(act.fileSec, remInBlock, act.block.id);
    } else if (A.ctx) {
      const speed = S.speed || 1.0;
      const elapsed = (A.ctx.currentTime - A.sourceAudioCtxTime) * speed;
      const expectedFileSec = A.sourceStartSec + elapsed;
      if (Math.abs(expectedFileSec - act.fileSec) > 0.18) {
        startAudioNode(act.fileSec, remInBlock, act.block.id);
      }
    }
    applyVol(false);
  }

  /* ---------- phát ---------- */
  function setVid(c: Clip, want: number, play: boolean) {
    const v: HTMLVideoElement = c.el;
    if (v.readyState < 1) return;
    if (play) {
      if (Math.abs(v.currentTime - want) > 0.3) v.currentTime = want;
      if (v.paused) v.play().catch(() => {});
    } else {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - want) > 0.04) v.currentTime = want;
    }
  }
  function syncVideos(t: number, playing: boolean) {
    const L = locate(t);
    const act = new Set<Clip>();
    if (L) {
      const c = S.clips[L.i], prev = S.clips[L.i - 1];
      if (c.type === 'video') { act.add(c); setVid(c, c.srcIn + L.local, playing); }
      if (prev && prev.type === 'video' && c.tr !== 'none' && L.local < Math.min(c.trDur, prev.dur * 0.5, c.dur * 0.5)) {
        act.add(prev);
        const wantedPrevTime = Math.min(prev.full, prev.srcIn + prev.dur + L.local);
        setVid(prev, Math.max(prev.srcIn, wantedPrevTime <= prev.full ? wantedPrevTime : prev.srcOut - 0.05), false);
      }
    }
    S.clips.forEach(c => {
      if (c.type === 'video' && !act.has(c) && !c.el.paused) c.el.pause();
    });
  }
  function tick() {
    if (!S.playing) return;
    const speed = S.speed || 1.0;
    S.t = tbase + ((performance.now() - t0) / 1000) * speed;
    const T = total();
    if (S.t >= T) {
      S.t = T;
      syncVideos(S.t, false);
      draw();
      finish();
      return;
    }
    syncVideos(S.t, true);
    syncAudio();
    draw();
    updateUI();
    updateActiveLyricCard(S.t);
    raf = requestAnimationFrame(tick);
  }
  /* ---------- toàn màn hình preview helpers ---------- */
  let fsIdleTimer: any = null;
  const isFsActive = () => !!document.fullscreenElement || !!$('#stageViewport')?.classList.contains('is-fullscreen');

  function showFsControls() {
    const vp = $('#stageViewport');
    if (vp) vp.classList.remove('fs-idle');
    if (fsIdleTimer) {
      clearTimeout(fsIdleTimer);
      fsIdleTimer = null;
    }
  }

  function scheduleFsIdle() {
    if (fsIdleTimer) {
      clearTimeout(fsIdleTimer);
      fsIdleTimer = null;
    }
    if (S.playing && isFsActive()) {
      fsIdleTimer = setTimeout(() => {
        if (S.playing && isFsActive()) {
          $('#stageViewport')?.classList.add('fs-idle');
        }
      }, 3000);
    }
  }

  function onFsUserActivity() {
    if (!isFsActive()) return;
    showFsControls();
    scheduleFsIdle();
  }

  function exitFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    const vp = $('#stageViewport');
    if (vp) {
      vp.classList.remove('is-fullscreen', 'fs-idle');
    }
    if (fsIdleTimer) {
      clearTimeout(fsIdleTimer);
      fsIdleTimer = null;
    }
    setTimeout(() => { fitStage(); draw(); }, 60);
  }

  function toggleFullscreen() {
    const vp = $('#stageViewport');
    if (!vp) return;
    if (!document.fullscreenElement) {
      vp.requestFullscreen?.().then(() => {
        vp.classList.add('is-fullscreen');
        onFsUserActivity();
        fitStage();
        draw();
      }).catch(() => {
        vp.classList.toggle('is-fullscreen');
        onFsUserActivity();
        fitStage();
        draw();
      });
    } else {
      exitFullscreen();
    }
  }

  function play() {
    if (S.playing || !S.clips.length) return;
    stopAllPreviews();
    if (S.t >= total() - 0.05) S.t = 0;
    S.playing = true;
    tbase = S.t;
    t0 = performance.now();
    startAudio();
    raf = requestAnimationFrame(tick);
    updateUI();
    if (isFsActive()) scheduleFsIdle();
  }
  function halt() {
    S.playing = false;
    cancelAnimationFrame(raf);
    stopAudioNode();
    if (A.el && !A.el.paused) A.el.pause();
    S.clips.forEach(c => {
      if (c.type === 'video' && !c.el.paused) c.el.pause();
    });
    showFsControls();
  }
  function pause() {
    halt();
    syncVideos(S.t, false);
    draw();
    updateUI();
    showFsControls();
  }
  function finish() {
    halt();
    updateUI();
    showFsControls();
    const cb = endCb;
    endCb = null;
    if (cb) cb();
  }
  function seek(t: number) {
    stopTransitionPreview();
    S.t = clamp(t, 0, total());
    if (S.playing) {
      tbase = S.t;
      t0 = performance.now();
    }
    if (A.loaded) {
      const act = getActiveAudioAt(S.t);
      if (act) {
        if (S.playing) {
          const remInBlock = Math.max(0.05, act.block.srcOut - act.fileSec);
          startAudioNode(act.fileSec, remInBlock, act.block.id);
        } else {
          stopAudioNode();
        }
      } else {
        stopAudioNode();
      }
    }
    syncVideos(S.t, S.playing);
    draw();
    updateUI();
    updateActiveLyricCard(S.t);
  }

  function isAnyPreviewActive(): boolean {
    return isPreviewingTr || A.isPreviewing || A.isTrimPreviewing;
  }

  function stopAllPreviews() {
    if (isPreviewingTr) stopTransitionPreview();
    if (A.isPreviewing) stopPreview();
    if (A.isTrimPreviewing) stopTrimPreview();
  }

  async function togglePlay() {
    if (isAnyPreviewActive()) {
      stopAllPreviews();
      updateUI();
      return;
    }

    if (S.playing) {
      pause();
    } else {
      stopAllPreviews();
      if (S.t >= total() - 0.05) {
        S.t = 0;
        seek(0);
      }
      await resumeAudioContext('Nút Phát');
      play();
    }
  }

  /* ---------- giao diện ---------- */
  const ICON_PLAY = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
  const ICON_PAUSE = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>';
  const ICON_VOL_HIGH = '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/></svg>';
  const ICON_VOL_LOW = '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" fill="currentColor"/></svg>';
  const ICON_VOL_MUTE = '<svg viewBox="0 0 24 24" width="15" height="15"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" fill="currentColor"/></svg>';

  function setVolume(v: number, fromInputId?: string) {
    const clamped = clamp(v, 0, 1);
    A.vol = clamped;

    const aVol = $('#aVol') as HTMLInputElement | null;
    const stageVol = $('#stageVol') as HTMLInputElement | null;
    const stageVolLbl = $('#stageVolLbl');
    const bMute = $('#bMute');

    const fsVol = $('#fsVolSlider') as HTMLInputElement | null;
    const fsVolVal = $('#fsVolVal');
    const btnFsMute = $('#btnFsMute');

    if (aVol && fromInputId !== 'aVol') {
      aVol.value = String(clamped);
    }
    if (stageVol && fromInputId !== 'stageVol') {
      stageVol.value = String(clamped);
    }
    if (fsVol && fromInputId !== 'fsVolSlider') {
      fsVol.value = String(clamped);
    }

    const percent = Math.round(clamped * 100);
    if (stageVolLbl) {
      stageVolLbl.textContent = percent + '%';
    }
    if (fsVolVal) {
      fsVolVal.textContent = percent + '%';
    }

    const muteIcon = clamped === 0 ? ICON_VOL_MUTE : clamped <= 0.5 ? ICON_VOL_LOW : ICON_VOL_HIGH;
    const muteTitle = clamped === 0 ? 'Bật tiếng (phím M)' : 'Tắt tiếng (phím M)';

    if (bMute) {
      bMute.innerHTML = muteIcon;
      bMute.setAttribute('aria-label', muteTitle);
      bMute.setAttribute('title', muteTitle);
    }
    if (btnFsMute) {
      btnFsMute.innerHTML = muteIcon;
      btnFsMute.setAttribute('aria-label', muteTitle);
      btnFsMute.setAttribute('title', muteTitle);
    }

    applyVol(A.isPreviewing || A.isTrimPreviewing);
  }

  function toggleMute() {
    if (A.vol > 0) {
      A.prevVol = A.vol;
      setVolume(0);
      toast('Đã tắt tiếng (0%)');
    } else {
      const restore = A.prevVol > 0 ? A.prevVol : 1.0;
      setVolume(restore);
      toast('Đã bật tiếng (' + Math.round(restore * 100) + '%)');
    }
  }

  function stopPlayback() {
    halt();
    stopAllPreviews();
    seek(0);
    updateUI();
    toast('Đã dừng phát và về 00:00');
  }

  function updateUI() {
    const T = total();
    const scrub = $('#scrub') as HTMLInputElement | null;
    if (scrub) {
      scrub.max = T.toFixed(2);
      if (!scrub.matches(':active')) {
        scrub.value = String(S.t);
      }
    }
    const timeLbl = $('#timeLbl');
    if (timeLbl) timeLbl.textContent = fmt(S.t) + ' / ' + fmt(T);

    const bPlay = $('#bPlay');
    if (bPlay) {
      const isPl = S.playing && !isAnyPreviewActive();
      const plStr = isPl ? '1' : '0';
      if (bPlay.dataset.playing !== plStr) {
        bPlay.dataset.playing = plStr;
        bPlay.innerHTML = isPl ? ICON_PAUSE : ICON_PLAY;
        bPlay.setAttribute('aria-label', isPl ? 'Tạm dừng (Phím Space)' : 'Phát (Phím Space)');
        bPlay.setAttribute('title', isPl ? 'Tạm dừng (Phím Space)' : 'Phát (Phím Space)');
      }
    }

    // Đồng bộ nút Play/Pause và thời gian toàn màn hình
    const btnFsPlay = $('#btnFsPlay');
    if (btnFsPlay) {
      const isPl = S.playing && !isAnyPreviewActive();
      const plStr = isPl ? '1' : '0';
      if (btnFsPlay.dataset.playing !== plStr) {
        btnFsPlay.dataset.playing = plStr;
        btnFsPlay.innerHTML = isPl ? ICON_PAUSE : ICON_PLAY;
        btnFsPlay.setAttribute('aria-label', isPl ? 'Tạm dừng (Phím Space hoặc K)' : 'Phát (Phím Space hoặc K)');
        btnFsPlay.setAttribute('title', isPl ? 'Tạm dừng (Phím Space hoặc K)' : 'Phát (Phím Space hoặc K)');
      }
    }
    const fsTimeLbl = $('#fsTimeLbl');
    if (fsTimeLbl) fsTimeLbl.textContent = fmtSec(S.t) + ' / ' + fmtSec(T);

    const fsFill = $('#fsProgressFill');
    const fsThumb = $('#fsProgressThumb');
    const pct = T > 0 ? clamp((S.t / T) * 100, 0, 100) : 0;
    if (fsFill) fsFill.style.width = pct.toFixed(2) + '%';
    if (fsThumb) fsThumb.style.left = pct.toFixed(2) + '%';

    const ph = $('#ph');
    if (ph) ph.style.left = (S.t * S.pps) + 'px';
    if (S.playing) {
      const sc = $('#tlScroll'), x = S.t * S.pps;
      if (sc && (x > sc.scrollLeft + sc.clientWidth - 40 || x < sc.scrollLeft)) {
        sc.scrollLeft = Math.max(0, x - 40);
      }
    }
    if (exporting && T > 0) {
      const expBar = $('#expBar');
      if (expBar) expBar.style.width = (S.t / T * 100).toFixed(1) + '%';
    }
    const lyrPh = $('#lyrWfPlayhead');
    if (lyrPh) {
      const dur = Math.max(total(), A.dur || 1);
      lyrPh.style.left = clamp((S.t / dur) * 100, 0, 100) + '%';
    }
  }
  function renderTimeline() {
    const T = Math.max(total(), A.loaded ? audioTrackEnd() : 0, 10), pps = S.pps;
    const width = Math.ceil(T * pps) + 80;
    const tlEl = $('#tl');
    if (tlEl) tlEl.style.width = width + 'px';
    const stepT = pps >= 90 ? 1 : pps >= 45 ? 2 : pps >= 28 ? 5 : 10;
    let r = '';
    for (let s = 0; s <= T + 1; s += 1) {
      const x = s * pps;
      if (s % stepT === 0) r += '<i style="left:' + x + 'px;height:12px"></i><span style="left:' + x + 'px">' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '</span>';
      else if (pps >= 30) r += '<i style="left:' + x + 'px"></i>';
    }
    const rulerEl = $('#ruler');
    if (rulerEl) rulerEl.innerHTML = r;
    let a = 0, h = '';
    S.clips.forEach((c, i) => {
      const isSel = c.id === S.sel;
      const w = Math.max(16, c.dur * pps - 2);
      const prev = i > 0 ? S.clips[i - 1] : null;
      const maxTrd = prev ? Math.max(0.1, Math.min(3.0, prev.dur * 0.5, c.dur * 0.5)) : 0;
      const trd = prev ? Math.min(c.trDur || 1.0, maxTrd) : 0;
      const trw = i > 0 && c.tr !== 'none' ? trd * pps : 0;
      const trName = TR[c.tr] || c.tr;
      const trIcon = TR_ICONS[c.tr] || '✨';
      const leftPx = a * pps;
      const typeLabel = c.type === 'video' ? 'video' : 'ảnh';
      const typeIcon = c.type === 'video' ? '🎬' : '🖼️';

      h += '<div class="clip' + (isSel ? ' sel' : '') + '" data-id="' + c.id + '" data-idx="' + i + '" style="left:' + leftPx + 'px;width:' + w + 'px;" title="' + esc(c.name) + ' (' + c.dur.toFixed(1) + 's)">'
        + (isSel ? '<div class="clip-handle left" data-cid="' + c.id + '" title="Kéo để chỉnh đầu clip">◀</div>' : '')
        + '<div class="clip-filmstrip" style="background-image:url(' + c.thumb + ')"></div>'
        + '<div class="clip-overlay"></div>'
        + (trw ? '<i class="trz" style="width:' + Math.min(trw, w) + 'px" title="Chuyển cảnh: ' + esc(trName) + ' (' + trd.toFixed(1) + 's)"><span class="trz-badge">' + trIcon + ' ' + esc(trName) + '</span></i>' : '')
        + '<div class="clip-header"><span class="cn">' + typeIcon + ' ' + esc(c.name) + '</span></div>'
        + '<div class="clip-footer"><span class="cd">' + c.dur.toFixed(1) + 's</span><span class="kind">' + typeLabel + '</span></div>'
        + (isSel ? '<div class="clip-handle right" data-cid="' + c.id + '" title="Kéo để chỉnh đuôi clip">▶</div>' : '')
        + '</div>';

      if (i > 0) {
        const hasTr = c.tr !== 'none';
        h += '<div class="trz-seam-btn' + (hasTr ? ' active' : '') + '" data-clip-idx="' + i + '" style="left:' + leftPx + 'px;" title="Chuyển cảnh giữa 2 clip: ' + esc(trName) + (hasTr ? ' (' + trd.toFixed(1) + 's)' : '') + '">'
          + '<span class="trz-diamond">' + (hasTr ? trIcon : '⟡') + '</span>'
          + (hasTr ? '<span class="trz-dur-tag">' + trd.toFixed(1) + 's</span>' : '')
          + '</div>';
      }

      a += c.dur;
    });

    // Nút dấu cộng (+) ở cuối track CLIP để thêm nhanh clip
    h += '<div class="tl-add-clip-tile" id="btnTlAddClipEnd" style="left:' + (a * pps + 4) + 'px" title="Thêm ảnh hoặc video mới">'
      + '<span class="tl-add-clip-plus">+</span><span>Thêm clip</span>'
      + '</div>';

    const clipsEl = $('#clips');
    if (clipsEl) {
      clipsEl.innerHTML = h;
      const addClipBtn = clipsEl.querySelector('#btnTlAddClipEnd');
      if (addClipBtn) {
        addClipBtn.addEventListener('click', (e: any) => {
          e.stopPropagation();
          const fMedia = $('#fileMedia2') as HTMLInputElement | null;
          if (fMedia) fMedia.click();
        });
      }
    }

    // Render Audio Lane (#alane)
    const al = $('#alane');
    if (al) {
      if (A.loaded && S.audioBlocks.length > 0) {
        let ah = '';
        S.audioBlocks.forEach(b => {
          const isSel = b.id === S.selAudioId;
          const leftPx = b.start * pps;
          const wPx = Math.max(16, b.dur * pps);
          ah += '<div class="audio-block' + (isSel ? ' sel' : '') + '" data-aid="' + b.id + '" style="left:' + leftPx + 'px;width:' + wPx + 'px;">'
            + (isSel ? '<div class="audio-handle left" data-aid="' + b.id + '" title="Kéo để cắt / khôi phục đầu nhạc">◀</div>' : '')
            + '<canvas data-aid="' + b.id + '"></canvas>'
            + '<span class="audio-block-title">' + esc(A.name || 'Nhạc') + '</span>'
            + '<span class="audio-block-time">' + fmt(b.dur) + '</span>'
            + (isSel ? '<div class="audio-handle right" data-aid="' + b.id + '" title="Kéo để cắt / khôi phục đuôi nhạc">▶</div>' : '')
            + '</div>';
        });
        al.innerHTML = ah;

        // Draw waveform slices on each audio block's canvas
        const per = 20;
        const peaks = A.peaks.length ? A.peaks : A.rawPeaks;
        S.audioBlocks.forEach(b => {
          const blockEl = al.querySelector('.audio-block[data-aid="' + b.id + '"]');
          if (!blockEl) return;
          const cvEl = blockEl.querySelector('canvas') as HTMLCanvasElement | null;
          if (!cvEl) return;
          const w = Math.max(1, Math.min(Math.ceil(b.dur * pps), 4000));
          cvEl.width = w;
          cvEl.height = 44;
          cvEl.style.width = '100%';
          cvEl.style.height = '44px';
          const cx = cvEl.getContext('2d');
          if (!cx) return;
          cx.clearRect(0, 0, w, 44);
          cx.fillStyle = b.id === S.selAudioId ? '#00f0ff' : '#38bdf8';
          if (peaks.length) {
            for (let px = 0; px < w; px++) {
              const fileSec = b.srcIn + (px / w) * b.dur;
              const pkIdx = Math.min(peaks.length - 1, Math.floor(fileSec * per));
              const pk = (pkIdx >= 0 && peaks[pkIdx]) || 0;
              const hh = Math.max(2, pk * 40);
              cx.fillRect(px, 22 - hh / 2, 1, hh);
            }
          } else {
            cx.fillRect(0, 21, w, 2);
          }

          // Vẽ đường Fade In và Fade Out trực tiếp trên sóng âm
          const aTotalEnd = audioTrackEnd();
          if (A.fadeIn > 0 && b.start < A.fadeIn) {
            const inSec = Math.min(b.start + b.dur, A.fadeIn) - b.start;
            const inPx = (inSec / b.dur) * w;
            cx.save();
            const gIn = cx.createLinearGradient(0, 0, inPx, 0);
            gIn.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
            gIn.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
            cx.fillStyle = gIn;
            cx.beginPath();
            cx.moveTo(0, 0);
            cx.lineTo(inPx, 0);
            cx.lineTo(0, 44);
            cx.closePath();
            cx.fill();

            cx.strokeStyle = '#00f0ff';
            cx.lineWidth = 2;
            cx.setLineDash([4, 2]);
            cx.beginPath();
            cx.moveTo(0, 42);
            cx.lineTo(inPx, 3);
            cx.stroke();

            cx.fillStyle = '#00f0ff';
            cx.font = 'bold 9px var(--font-mono)';
            cx.fillText('Fade In ' + A.fadeIn + 's', 6, 12);
            cx.restore();
          }

          if (A.fadeOut > 0 && b.start + b.dur > aTotalEnd - A.fadeOut) {
            const outStartSec = Math.max(b.start, aTotalEnd - A.fadeOut);
            const outPx = ((outStartSec - b.start) / b.dur) * w;
            cx.save();
            const gOut = cx.createLinearGradient(outPx, 0, w, 0);
            gOut.addColorStop(0, 'rgba(0, 0, 0, 0.05)');
            gOut.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
            cx.fillStyle = gOut;
            cx.beginPath();
            cx.moveTo(outPx, 0);
            cx.lineTo(w, 0);
            cx.lineTo(w, 44);
            cx.closePath();
            cx.fill();

            cx.strokeStyle = '#ff007f';
            cx.lineWidth = 2;
            cx.setLineDash([4, 2]);
            cx.beginPath();
            cx.moveTo(outPx, 3);
            cx.lineTo(w, 42);
            cx.stroke();

            cx.fillStyle = '#ff007f';
            cx.font = 'bold 9px var(--font-mono)';
            cx.textAlign = 'right';
            cx.fillText('Fade Out ' + A.fadeOut + 's', w - 6, 12);
            cx.restore();
          }
        });
      } else {
        al.innerHTML = '<div class="empty-audio-lane" id="btnEmptyAudioAdd" title="Bấm để chọn file nhạc"><span class="empty-audio-icon">♫</span><span>+ Kéo thả hoặc bấm để thêm nhạc</span></div>';
        const addBtn = al.querySelector('#btnEmptyAudioAdd');
        if (addBtn) {
          addBtn.addEventListener('click', () => {
            const fi = $('#fileAudio') as HTMLInputElement | null;
            if (fi) fi.click();
          });
        }
      }
    }

    // Render Lyric Lane (#llane)
    let l = '';
    S.lyr.forEach((ly, i) => {
      const isSel = ly.id === S.selLyrId;
      const endT = ly.endT || ((S.lyr[i + 1]?.t) || (ly.t + 3));
      const dur = Math.max(0.2, endT - ly.t);
      const w = Math.max(16, dur * pps - 2);

      const prev = S.lyr[i - 1];
      const next = S.lyr[i + 1];
      const isOverlap = (prev && ly.t < (prev.endT || (prev.t + 0.1)) - 0.05) || (next && endT > next.t + 0.05);

      l += '<div class="lyr-block' + (isSel ? ' sel' : '') + (isOverlap ? ' overlap' : '') + '" data-lid="' + ly.id + '" style="left:' + (ly.t * pps) + 'px;width:' + w + 'px" title="' + esc(ly.text) + ' [' + fmt(ly.t) + ' ➔ ' + fmt(endT) + ']' + (isOverlap ? ' (CẢNH BÁO: Chồng giờ với câu khác!)' : '') + '">'
        + (isSel ? '<span class="lyr-handle left" data-lid="' + ly.id + '" title="Kéo mép trái để đổi giờ bắt đầu"></span>' : '')
        + '<span class="lyr-idx">#' + (i + 1) + '</span>'
        + '<span class="lyr-txt">' + esc(ly.text || '(trống)') + '</span>'
        + (isSel ? '<span class="lyr-handle right" data-lid="' + ly.id + '" title="Kéo mép phải để đổi giờ kết thúc"></span>' : '')
        + '</div>';
    });
    const llaneEl = $('#llane');
    if (llaneEl) llaneEl.innerHTML = l;

    updateInspector();
    updateUI();
  }
  function selClip() { return S.clips.find(c => c.id === S.sel) || null; }
  function selAudioBlock() { return S.audioBlocks.find(b => b.id === S.selAudioId) || null; }
  function updateInspector() {
    const c = selClip();
    const ab = selAudioBlock();
    const ly = selLyr();

    const ctxClip = $('#ctxClip');
    const ctxAudio = $('#ctxAudio');
    const ctxLyric = $('#ctxLyric');
    const ctxProject = $('#ctxProject');
    const rightTitle = $('#rightPanelTitle');
    const rightIcon = $('#rightPanelIcon');

    if (c) {
      if (ctxClip) ctxClip.hidden = false;
      if (ctxAudio) ctxAudio.hidden = true;
      if (ctxLyric) ctxLyric.hidden = true;
      if (ctxProject) ctxProject.hidden = true;
      if (rightTitle) rightTitle.textContent = 'Thuộc tính Clip: ' + c.name;
      if (rightIcon) rightIcon.textContent = c.type === 'video' ? '🎬' : '🖼️';

      const clipBadge = $('#ctxClipBadge');
      if (clipBadge) clipBadge.textContent = c.type === 'video' ? '🎬 Video' : '🖼️ Ảnh';
      const clipName = $('#ctxClipName');
      if (clipName) clipName.textContent = c.name;

      const v = c.type === 'video';
      const gDur = $('#gDur');
      const gIn = $('#gIn');
      const gOut = $('#gOut');
      if (gDur) gDur.hidden = v;
      if (gIn) gIn.hidden = !v;
      if (gOut) gOut.hidden = !v;

      const iDur = $('#iDur') as HTMLInputElement | null;
      if (iDur) iDur.value = c.dur.toFixed(2);
      const iIn = $('#iIn') as HTMLInputElement | null;
      if (iIn) iIn.value = c.srcIn.toFixed(1);
      const iOut = $('#iOut') as HTMLInputElement | null;
      if (iOut) {
        iOut.value = c.srcOut.toFixed(1);
        iOut.max = String(c.full);
      }
      const iFit = $('#iFit') as HTMLSelectElement | null;
      if (iFit) iFit.value = c.fit;
      const iFx = $('#iFx') as HTMLSelectElement | null;
      if (iFx) iFx.value = c.fx;

      const cIdx = S.clips.findIndex(x => x.id === c.id);
      const iTr = $('#iTr') as HTMLSelectElement | null;
      const iTrD = $('#iTrD') as HTMLInputElement | null;
      const btnPrevClipTr = $('#btnPreviewClipTr') as HTMLButtonElement | null;
      const btnApplyClipTrAll = $('#btnApplyClipTrAll') as HTMLButtonElement | null;

      if (cIdx <= 0) {
        if (iTr) { iTr.value = 'none'; iTr.disabled = true; iTr.title = 'Clip đầu tiên không có chuyển cảnh vào'; }
        if (iTrD) iTrD.disabled = true;
        if (btnPrevClipTr) btnPrevClipTr.disabled = true;
        if (btnApplyClipTrAll) btnApplyClipTrAll.disabled = true;
      } else {
        const prev = S.clips[cIdx - 1];
        const maxTrD = Math.max(0.1, Math.min(3.0, prev.dur * 0.5, c.dur * 0.5));
        c.trDur = Math.min(c.trDur || 1.0, maxTrD);
        if (iTr) { iTr.disabled = false; iTr.value = c.tr; iTr.title = ''; }
        if (iTrD) {
          iTrD.disabled = false;
          iTrD.max = maxTrD.toFixed(1);
          iTrD.value = c.trDur.toFixed(1);
        }
        if (btnPrevClipTr) btnPrevClipTr.disabled = false;
        if (btnApplyClipTrAll) btnApplyClipTrAll.disabled = false;
      }

      const iCol = $('#iCol') as HTMLSelectElement | null;
      if (iCol) iCol.value = c.color;
      const rFit = $('#rFit') as HTMLSelectElement | null;
      if (rFit) rFit.value = c.fit;

    } else if (ab) {
      if (ctxClip) ctxClip.hidden = true;
      if (ctxAudio) ctxAudio.hidden = false;
      if (ctxLyric) ctxLyric.hidden = true;
      if (ctxProject) ctxProject.hidden = true;
      if (rightTitle) rightTitle.textContent = 'Thuộc tính Nhạc: ' + (A.name || 'Nhạc');
      if (rightIcon) rightIcon.textContent = '♫';

      const audioName = $('#ctxAudioName');
      if (audioName) audioName.textContent = (A.name || 'File nhạc') + ' [' + fmt(ab.dur) + ']';

      const aVol = $('#aVol') as HTMLInputElement | null;
      if (aVol) aVol.value = String(A.vol);

      const aFadeIn = $('#aFadeIn') as HTMLInputElement | null;
      const aFadeOut = $('#aFadeOut') as HTMLInputElement | null;
      if (aFadeIn) aFadeIn.value = String(A.fadeIn);
      if (aFadeOut) aFadeOut.value = String(A.fadeOut);

    } else if (ly) {
      if (ctxClip) ctxClip.hidden = true;
      if (ctxAudio) ctxAudio.hidden = true;
      if (ctxLyric) ctxLyric.hidden = false;
      if (ctxProject) ctxProject.hidden = true;
      const lIdx = S.lyr.findIndex(item => item.id === ly.id);
      if (rightTitle) rightTitle.textContent = `Câu #${lIdx + 1}: ${ly.text}`;
      if (rightIcon) rightIcon.textContent = '📝';

      const lyrBadge = $('#inspLyrBadge');
      if (lyrBadge) lyrBadge.textContent = `Câu #${lIdx + 1}`;
      const lyrDurBadge = $('#inspLyrDurBadge');
      const endT = ly.endT || (ly.t + 3.0);
      if (lyrDurBadge) lyrDurBadge.textContent = `${(endT - ly.t).toFixed(2)}s (${fmt(ly.t)} - ${fmt(endT)})`;

      const txtEl = $('#inspLyrText') as HTMLTextAreaElement | null;
      if (txtEl && document.activeElement !== txtEl) txtEl.value = ly.text;
      const startEl = $('#inspLyrStart') as HTMLInputElement | null;
      if (startEl && document.activeElement !== startEl) startEl.value = ly.t.toFixed(2);
      const endEl = $('#inspLyrEnd') as HTMLInputElement | null;
      if (endEl && document.activeElement !== endEl) endEl.value = endT.toFixed(2);

      const colorDef = $('#inspLyrColorDef') as HTMLInputElement | null;
      const colorEl = $('#inspLyrColor') as HTMLInputElement | null;
      if (colorDef) colorDef.checked = !ly.color;
      if (colorEl) {
        colorEl.value = ly.color || S.style.color || '#ffffff';
        colorEl.disabled = !ly.color;
      }

      const hiDef = $('#inspLyrHiDef') as HTMLInputElement | null;
      const hiEl = $('#inspLyrHi') as HTMLInputElement | null;
      if (hiDef) hiDef.checked = !ly.hi;
      if (hiEl) {
        hiEl.value = ly.hi || S.style.hi || '#ffd23f';
        hiEl.disabled = !ly.hi;
      }

      const sizeEl = $('#inspLyrSize') as HTMLInputElement | null;
      if (sizeEl && document.activeElement !== sizeEl) sizeEl.value = String(ly.size || 0);

    } else {
      // Không chọn gì -> Cài đặt dự án
      if (ctxClip) ctxClip.hidden = true;
      if (ctxAudio) ctxAudio.hidden = true;
      if (ctxLyric) ctxLyric.hidden = true;
      if (ctxProject) ctxProject.hidden = false;
      if (rightTitle) rightTitle.textContent = 'Cài đặt Dự án';
      if (rightIcon) rightIcon.textContent = '⚙️';

      const rFadeIn = $('#rFadeIn') as HTMLInputElement | null;
      const rFadeOut = $('#rFadeOut') as HTMLInputElement | null;
      const rFadeInVal = $('#rFadeInVal');
      const rFadeOutVal = $('#rFadeOutVal');
      if (rFadeIn) rFadeIn.value = String(A.fadeIn);
      if (rFadeOut) rFadeOut.value = String(A.fadeOut);
      if (rFadeInVal) rFadeInVal.textContent = A.fadeIn.toFixed(1) + 's';
      if (rFadeOutVal) rFadeOutVal.textContent = A.fadeOut.toFixed(1) + 's';
    }

    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.classList.toggle('active', Math.abs(parseFloat((btn as any).dataset.speed || '1') - (S.speed || 1)) < 0.01);
    });
  }

  function renderMediaDrawerCards() {
    const container = $('#mediaDrawerCards');
    if (!container) return;
    if (!S.clips.length) {
      container.innerHTML = '<div class="p-4 text-center text-xs text-slate-400">Chưa có tệp media nào. Bấm nút "Import media" phía trên để thêm ảnh hoặc video.</div>';
      return;
    }
    let html = '';
    S.clips.forEach((c) => {
      const isSel = c.id === S.sel;
      html += '<div class="media-drawer-card ' + (isSel ? 'selected' : '') + '" data-cid="' + c.id + '" title="' + esc(c.name) + '">'
        + '<div class="media-drawer-thumb-wrap">'
        + '<img src="' + (c.thumb || c.url) + '" alt="' + esc(c.name) + '" class="media-drawer-thumb" />'
        + '<span class="media-drawer-type-badge">' + (c.type === 'video' ? '🎬' : '🖼️') + '</span>'
        + '</div>'
        + '<div class="media-drawer-info">'
        + '<span class="media-drawer-title" title="' + esc(c.name) + '">' + esc(c.name) + '</span>'
        + '<span class="media-drawer-meta">' + c.dur.toFixed(1) + 's</span>'
        + '</div>'
        + '<button type="button" class="media-drawer-add-btn" data-add-cid="' + c.id + '" title="Thêm vào timeline">+</button>'
        + '</div>';
    });
    container.innerHTML = html;

    container.querySelectorAll('.media-drawer-card').forEach((cardEl: any) => {
      cardEl.addEventListener('click', (e: MouseEvent) => {
        const addBtn = (e.target as HTMLElement).closest('.media-drawer-add-btn');
        const cid = +(cardEl.dataset.cid || 0);
        if (addBtn) {
          e.stopPropagation();
          const targetClip = S.clips.find(x => x.id === cid);
          if (targetClip) {
            pushTimelineHistory();
            const copy = cloneClip(targetClip);
            copy.name = targetClip.name + ' (thêm)';
            S.clips.push(copy);
            S.sel = copy.id;
            refreshAll();
            toast('Đã thêm "' + targetClip.name + '" vào timeline');
          }
          return;
        }
        S.sel = cid;
        S.selAudioId = null;
        S.selLyrId = null;
        refreshAll();
      });
    });
  }

  function refreshAll() {
    if (S.sel && !selClip()) S.sel = S.clips[0]?.id ?? null;
    S.t = clamp(S.t, 0, total());
    syncVideos(S.t, false);
    renderTimeline();
    renderMediaDrawerCards();
    draw();
  }
  function fill(sel: string, obj: Record<string, string>) {
    const el = $(sel);
    if (!el) return;
    el.innerHTML = Object.entries(obj).map(([k, v]) => '<option value="' + k + '">' + v + '</option>').join('');
  }
  function fillGrouped(sel: string, groups: typeof TR_GROUPS) {
    const el = $(sel);
    if (!el) return;
    el.innerHTML = groups.map(g =>
      '<optgroup label="' + g.group + '">' +
      g.items.map(it => '<option value="' + it.key + '">' + it.label + '</option>').join('') +
      '</optgroup>'
    ).join('');
  }

  /* ---------- dời / nhân bản / cắt clip ---------- */
  function moveClip(d: number) {
    const i = S.clips.findIndex(c => c.id === S.sel), j = i + d;
    if (i < 0 || j < 0 || j >= S.clips.length) return;
    [S.clips[i], S.clips[j]] = [S.clips[j], S.clips[i]];
    refreshAll();
  }
  function cloneClip(c: Clip) {
    const n = Object.assign({}, c, { id: ++uid });
    if (c.type === 'video') n.el = makeVideo(c.url);
    return n;
  }
  function splitClipAtPlayhead() {
    let targetIdx = -1;
    let clipStartSec = 0;

    // 1. Nếu đang chọn clip, kiểm tra xem playhead có nằm trong clip đó không
    if (S.sel != null) {
      let accum = 0;
      for (let i = 0; i < S.clips.length; i++) {
        const c = S.clips[i];
        if (c.id === S.sel) {
          if (S.t >= accum - 0.001 && S.t <= accum + c.dur + 0.001) {
            targetIdx = i;
            clipStartSec = accum;
          }
          break;
        }
        accum += c.dur;
      }
    }

    // 2. Nếu clip đang chọn không chứa playhead hoặc chưa chọn clip nào, tìm clip ngay dưới playhead
    if (targetIdx < 0) {
      let accum = 0;
      for (let i = 0; i < S.clips.length; i++) {
        const c = S.clips[i];
        if (S.t >= accum && S.t <= accum + c.dur) {
          targetIdx = i;
          clipStartSec = accum;
          break;
        }
        accum += c.dur;
      }
    }

    // 3. Nếu tìm thấy clip dưới playhead
    if (targetIdx >= 0) {
      const c = S.clips[targetIdx];
      const local = S.t - clipStartSec;

      // Không cho cắt nếu playhead cách mép clip dưới 0.3s
      if (local < 0.3 || (c.dur - local) < 0.3) {
        return toast('Đầu phát phải cách mép clip ít nhất 0.3 giây để cắt.');
      }

      pushTimelineHistory();
      const c2 = cloneClip(c);
      c2.tr = 'none';
      c2.fit = c.fit;
      c2.fx = c.fx;
      c2.color = c.color;
      c2.sample = c.sample;
      c2.name = c.name + ' (phần 2)';

      if (c.type === 'image') {
        const oldDur = c.dur;
        c.dur = parseFloat(local.toFixed(2));
        c2.dur = parseFloat((oldDur - local).toFixed(2));
      } else {
        const oldSrcOut = c.srcOut;
        c.srcOut = parseFloat((c.srcIn + local).toFixed(2));
        c.dur = parseFloat((c.srcOut - c.srcIn).toFixed(2));
        c2.srcIn = c.srcOut;
        c2.srcOut = oldSrcOut;
        c2.dur = parseFloat((oldSrcOut - c2.srcIn).toFixed(2));
      }

      c.trDur = Math.max(0.1, Math.min(c.trDur || 1.0, c.dur * 0.5));
      c2.tr = 'none';
      c2.trDur = Math.max(0.1, Math.min(1.0, c2.dur * 0.5));

      S.clips.splice(targetIdx + 1, 0, c2);
      S.sel = c2.id;
      S.selAudioId = null;
      S.selLyrId = null;

      if (S.syncWithMusic) applyMusicSync();
      refreshAll();
      toast(`Đã cắt clip "${c.name}" thành 2 clip tại ${fmt(S.t)}.`);
      return;
    }

    // 4. Nếu playhead nằm trong một đoạn nhạc
    const bIdx = S.audioBlocks.findIndex(b => S.t > b.start + 0.1 && S.t < b.start + b.dur - 0.1);
    if (bIdx >= 0) {
      pushTimelineHistory();
      const b = S.audioBlocks[bIdx];
      const cutPos = S.t - b.start;
      const b1: AudioBlock = {
        id: b.id,
        start: b.start,
        srcIn: b.srcIn,
        srcOut: b.srcIn + cutPos,
        dur: cutPos
      };
      const b2: AudioBlock = {
        id: ++audioUid,
        start: S.t,
        srcIn: b.srcIn + cutPos,
        srcOut: b.srcOut,
        dur: b.dur - cutPos
      };
      S.audioBlocks.splice(bIdx, 1, b1, b2);
      S.selAudioId = b2.id;
      S.sel = null;
      S.selLyrId = null;
      autoFitImagesToMusic();
      refreshAll();
      toast('Đã tách đoạn nhạc thành 2 phần tại ' + fmt(S.t));
      return;
    }

    toast('Đưa đầu phát vào giữa clip hoặc đoạn nhạc để cắt (Phím S).');
  }

  const splitAtPlayhead = splitClipAtPlayhead;
  const splitAtHead = splitClipAtPlayhead;

  function deleteSelected() {
    if (S.sel != null) {
      const i = S.clips.findIndex(c => c.id === S.sel);
      if (i >= 0) {
        if (S.clips.length <= 1) {
          return toast('Cần giữ lại ít nhất 1 clip trong dự án.');
        }
        pushTimelineHistory();
        const removed = S.clips.splice(i, 1)[0];
        if (S.clips.length > 0) {
          S.clips[0].tr = 'none';
          for (let j = 1; j < S.clips.length; j++) {
            const p = S.clips[j - 1], cur = S.clips[j];
            const maxD = Math.max(0.1, Math.min(3.0, p.dur * 0.5, cur.dur * 0.5));
            cur.trDur = Math.min(cur.trDur || 1.0, maxD);
          }
        }
        S.sel = S.clips[Math.min(i, S.clips.length - 1)]?.id ?? null;
        if (S.syncWithMusic) applyMusicSync();
        refreshAll();
        toast('Đã xóa clip: ' + removed.name);
        return;
      }
    }
    if (S.selAudioId != null) {
      const idx = S.audioBlocks.findIndex(b => b.id === S.selAudioId);
      if (idx >= 0) {
        pushTimelineHistory();
        S.audioBlocks.splice(idx, 1);
        S.selAudioId = S.audioBlocks[Math.min(idx, S.audioBlocks.length - 1)]?.id ?? null;
        autoFitImagesToMusic();
        refreshAll();
        toast('Đã xóa đoạn nhạc');
        return;
      }
    }
    if (S.selLyrId != null) {
      deleteLyricLine();
    }
  }

  function closeAudioGaps() {
    pushTimelineHistory();
    if (S.audioBlocks.length > 0) {
      S.audioBlocks.sort((a, b) => a.start - b.start);
      let cur = 0;
      S.audioBlocks.forEach(b => {
        b.start = cur;
        cur += b.dur;
      });
    }
    S.clips.forEach(c => {
      if (c.dur < 0.5) c.dur = 0.5;
    });
    if (S.syncWithMusic) applyMusicSync();
    refreshAll();
    toast('Đã nối liền các đoạn nhạc và clip, xóa sạch khoảng trống.');
  }

  function applyAudioPreset(span: number | null) {
    if (!A.loaded || A.dur <= 0) return toast('Hãy chọn file nhạc trước.');
    pushTimelineHistory();
    if (span == null || span >= A.dur) {
      S.audioBlocks = [{
        id: ++audioUid,
        start: 0,
        srcIn: 0,
        srcOut: A.dur,
        dur: A.dur
      }];
      S.selAudioId = S.audioBlocks[0].id;
      S.sel = null;
      S.selLyrId = null;
      autoFitImagesToMusic();
      seek(0);
      refreshAll();
      toast('Đã chọn toàn bộ bài hát (' + fmt(A.dur) + ')');
      return;
    }
    let startSec = Math.max(0, S.t);
    if (startSec + span > A.dur) {
      startSec = Math.max(0, A.dur - span);
    }
    S.audioBlocks = [{
      id: ++audioUid,
      start: 0,
      srcIn: startSec,
      srcOut: startSec + span,
      dur: span
    }];
    S.selAudioId = S.audioBlocks[0].id;
    S.sel = null;
    S.selLyrId = null;
    autoFitImagesToMusic();
    seek(0);
    refreshAll();
    toast('Đã chọn đoạn ' + span + 's (' + fmt(startSec) + ' ➔ ' + fmt(startSec + span) + ')');
  }

  /* ---------- font ---------- */
  async function loadFonts() {
    const f = S.style.font;
    try {
      await Promise.all(['400', '700', '800'].map(w => document.fonts.load(w + ' 40px "' + f + '"', 'Việt Nam ắ ế ộ ử')));
    } catch (e) {}
  }

  /* ---------- xuất video ---------- */
  function pickMime() {
    const c = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    return c.find(m => typeof window.MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) || '';
  }
  async function exportVideo() {
    if (!total()) return toast('Chưa có clip nào để xuất.');
    if (typeof MediaRecorder === 'undefined' || !(cv as any).captureStream) {
      return toast('Trình duyệt này chưa hỗ trợ xuất video. Hãy dùng Chrome hoặc Edge bản mới trên máy tính.');
    }
    const mime = pickMime();
    if (!mime) return toast('Trình duyệt không có bộ ghi video phù hợp.');
    pause();
    await loadFonts();
    const stream: MediaStream = (cv as any).captureStream(30);
    if (A.loaded && ensureGraph()) {
      try { await A.ctx!.resume(); } catch (e) {}
      A.dest!.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    }
    const chunks: Blob[] = [];
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: S.res >= 1080 ? 10e6 : 6e6,
        audioBitsPerSecond: 192e3
      });
    } catch (e) {
      return toast('Không khởi tạo được bộ ghi video.');
    }
    expRec = rec;
    expCancel = false;
    expBlob = null;
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(r => { rec.onstop = r; });
    exporting = true;
    $('#exp').hidden = false;
    $('#expT').textContent = 'Đang xuất video';
    $('#expMsg').textContent = 'Giữ tab này mở và đừng chuyển sang tab khác cho tới khi xong. Video được ghi theo thời gian thật.';
    $('#expBar').style.width = '0%';
    $('#expVideo').hidden = true;
    $('#expSave').hidden = true;
    $('#expClose').textContent = 'Hủy';

    let wl: any = null;
    try { wl = await (navigator as any).wakeLock?.request('screen'); } catch (e) {}

    seek(0);
    await sleep(250);
    rec.start(500);
    endCb = async () => {
      await sleep(400);
      if (rec.state !== 'inactive') rec.stop();
    };
    play();
    await stopped;
    try { wl && wl.release(); } catch (e) {}
    exporting = false;
    endCb = null;
    if (expCancel) { $('#exp').hidden = true; return; }
    const type = mime.split(';')[0];
    const ext = type === 'video/mp4' ? 'mp4' : 'webm';
    expBlob = new Blob(chunks, { type });
    expName = 'lyric-video-' + (S.orient === 'v' ? '9x16' : '16x9') + '-' + S.res + 'p.' + ext;
    const v: HTMLVideoElement = $('#expVideo');
    v.src = URL.createObjectURL(expBlob);
    v.hidden = false;
    $('#expT').textContent = 'Video đã xong';
    $('#expMsg').textContent = 'Xem lại bên dưới, rồi bấm Lưu video.';
    $('#expBar').style.width = '100%';
    $('#expSave').hidden = false;
    $('#expClose').textContent = 'Đóng';
    seek(0);
  }
  async function saveExport() {
    if (!expBlob) return;
    let dl: any = null;
    try { dl = await window.claude?.use?.('downloads'); } catch (e) {}
    if (dl) {
      try {
        await dl.save({ filename: expName, data: expBlob });
        toast('Đã lưu ' + expName);
      } catch (e: any) {
        if (e && e.code === 'declined') toast('Bạn đã hủy lưu file.');
        else toast('Chưa lưu được file: ' + (e && e.message ? e.message : 'lỗi không rõ'));
      }
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(expBlob);
      a.download = expName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('Đang tải ' + expName);
    }
  }
  function closeExport() {
    if (exporting) {
      expCancel = true;
      halt();
      endCb = null;
      if (expRec && expRec.state !== 'inactive') expRec.stop();
      exporting = false;
      $('#exp').hidden = true;
      draw();
      updateUI();
      return;
    }
    $('#exp').hidden = true;
    const v: HTMLVideoElement = $('#expVideo');
    v.pause();
  }

  /* ---------- sự kiện ---------- */
  function onDragOver(e: DragEvent) {
    e.preventDefault();
    $('#drop1')?.classList.add('over');
  }
  function onDragLeave(e: DragEvent) {
    if (!e.relatedTarget) $('#drop1')?.classList.remove('over');
  }
  async function onDrop(e: DragEvent) {
    e.preventDefault();
    $('#drop1')?.classList.remove('over');
    if (e.dataTransfer?.files?.length) await addFiles(e.dataTransfer.files);
  }
  function onKeyDown(e: KeyboardEvent) {
    const tg = (e.target as HTMLElement).tagName;
    const isInput = ['INPUT', 'SELECT', 'TEXTAREA'].includes(tg) || (e.target as HTMLElement).isContentEditable;
    if (isInput) return;

    const isFs = isFsActive();

    // Phím Escape: Thoát toàn màn hình hoặc đóng modal phím tắt
    if (e.code === 'Escape' || e.key === 'Escape') {
      const modal = $('#shortcutsModal');
      if (modal && !modal.hidden) {
        e.preventDefault();
        modal.hidden = true;
        return;
      }
      if (isFs) {
        e.preventDefault();
        exitFullscreen();
        return;
      }
    }

    // Phím K: Toggle Phát / Tạm dừng
    if (e.code === 'KeyK' || e.key === 'k' || e.key === 'K') {
      e.preventDefault();
      togglePlay();
      if (isFs) onFsUserActivity();
      return;
    }

    // Phím mũi tên Trái / Phải: Lùi / Tiến 5 giây
    if (e.code === 'ArrowLeft') {
      e.preventDefault();
      seek(S.t - 5);
      toast('Lùi 5s (' + fmtSec(S.t) + ')');
      if (isFs) onFsUserActivity();
      return;
    }
    if (e.code === 'ArrowRight') {
      e.preventDefault();
      seek(S.t + 5);
      toast('Tiến 5s (' + fmtSec(S.t) + ')');
      if (isFs) onFsUserActivity();
      return;
    }

    // Phím Ctrl+Z / Ctrl+Y (hoặc Ctrl+Shift+Z, Cmd+Z/Y) cho Hoàn tác / Làm lại
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (currentLyrStep === 2 && !isFs) {
          tapUndoLine();
        } else {
          if (e.shiftKey) redoTimeline();
          else undoTimeline();
        }
        return;
      }
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        redoTimeline();
        return;
      }
    }

    // Phím M: Tắt / Bật tiếng
    if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      toggleMute();
      if (isFs) onFsUserActivity();
      return;
    }

    // Phím S: Tách đoạn nhạc hoặc clip tại đầu phát
    if (e.code === 'KeyS' || e.key === 's' || e.key === 'S') {
      e.preventDefault();
      splitAtPlayhead();
      return;
    }

    // Phím Delete / Backspace: Xóa phần đang chọn
    if (e.code === 'Delete' || e.key === 'Delete' || e.code === 'Backspace' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelected();
      return;
    }

    // Phím mũi tên (▲ / ▼): Chỉnh âm lượng (10% khi toàn màn hình, 5% khi bình thường)
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      e.preventDefault();
      const delta = isFs ? (e.code === 'ArrowUp' ? 0.1 : -0.1) : (e.code === 'ArrowUp' ? 0.05 : -0.05);
      setVolume(A.vol + delta);
      toast('Âm lượng: ' + Math.round(A.vol * 100) + '%');
      if (isFs) onFsUserActivity();
      return;
    }

    // Phím Space: Toggle Phát / Tạm dừng (hoặc Căn giờ câu nếu đang ở Bước 2)
    if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32) {
      if (tg === 'BUTTON') return;
      e.preventDefault();
      e.stopPropagation();

      if (currentLyrStep === 2 && !isFs) {
        tapMarkNow();
        return;
      }

      togglePlay();
      if (isFs) onFsUserActivity();
      return;
    }
  }
  function onResize() {
    fitStage();
    renderWaveformEditor();
  }

  function bind() {
    fill('#defFx', FX); fillGrouped('#defTr', TR_GROUPS); fill('#iFx', FX); fillGrouped('#iTr', TR_GROUPS); fill('#iCol', COL);
    const defFxEl = $('#defFx'); if (defFxEl) defFxEl.value = S.def.fx;
    const defTrEl = $('#defTr'); if (defTrEl) defTrEl.value = S.def.tr;
    const defTrDEl = $('#defTrD') as HTMLInputElement | null; if (defTrDEl) defTrDEl.value = String(S.def.trDur);
    const sFontEl = $('#sFont'); if (sFontEl) sFontEl.innerHTML = FONTS.map(f => '<option value="' + f + '" style="font-family:\'' + f + '\'">' + f + '</option>').join('');

    // Khởi tạo giá trị ban đầu cho các ô điều khiển sóng nhạc
    syncVizControlsToState();

    const switchTab = (tabName: string) => {
      document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', String((x as any).dataset.tab === tabName)));
      document.querySelectorAll('.nav-dock-btn').forEach(x => {
        if ((x as any).dataset.tab === tabName) x.classList.add('active');
        else x.classList.remove('active');
      });
      document.querySelectorAll('[data-pane]').forEach((p: any) => { p.hidden = p.dataset.pane !== tabName; });
      const drawer = $('#studioDrawer');
      if (drawer) drawer.classList.remove('collapsed');

      const titleMap: Record<string, string> = {
        media: 'Thư viện media',
        music: 'Quản lý âm thanh',
        visual: 'Hiệu ứng sóng nhạc',
        lyric: 'Căn chỉnh Lyric',
        text: 'Định dạng chữ',
        inspector: 'Thuộc tính phần tử'
      };
      const titleEl = $('#drawerTitle');
      if (titleEl && titleMap[tabName]) titleEl.textContent = titleMap[tabName];

      if (tabName === 'lyric') {
        renderLyricUI();
      }
      if (tabName === 'media') {
        renderMediaDrawerCards();
      }
    };

    document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
      switchTab((b as any).dataset.tab);
    }));

    document.querySelectorAll('.nav-dock-btn[data-tab]').forEach(b => b.addEventListener('click', () => {
      switchTab((b as any).dataset.tab);
    }));

    safeClick('#btnToggleDrawer', () => {
      const drawer = $('#studioDrawer');
      if (drawer) {
        drawer.classList.toggle('collapsed');
        fitStage();
      }
    });

    // Bật / Thu gọn panel phải
    const toggleRightPanel = () => {
      const rp = $('#studioRightPanel');
      if (rp) {
        rp.classList.toggle('collapsed');
        fitStage();
      }
    };
    safeClick('#btnToggleRightPanel', toggleRightPanel);
    safeClick('#btnToggleRightPanelTransport', toggleRightPanel);

    // Toàn màn hình preview
    safeClick('#btnFullscreen', toggleFullscreen);
    safeClick('#btnFsExit', exitFullscreen);
    safeClick('#btnFsCloseTop', exitFullscreen);

    safeClick('#btnFsStart', () => { seek(0); onFsUserActivity(); });
    safeClick('#btnFsBack5', () => { seek(S.t - 5); onFsUserActivity(); });
    safeClick('#btnFsPlay', () => { togglePlay(); onFsUserActivity(); });
    safeClick('#btnFsFwd5', () => { seek(S.t + 5); onFsUserActivity(); });
    safeClick('#btnFsStop', () => { stopPlayback(); onFsUserActivity(); });
    safeClick('#btnFsMute', () => { toggleMute(); onFsUserActivity(); });
    safeInput('#fsVolSlider', (e: any) => { setVolume(+e.target.value, 'fsVolSlider'); onFsUserActivity(); });

    // Bấm một lần vào vùng video để phát/tạm dừng (khi đang toàn màn hình)
    const vpEl = $('#stageViewport');
    if (vpEl) {
      vpEl.addEventListener('pointermove', onFsUserActivity);
      vpEl.addEventListener('pointerdown', onFsUserActivity);
      vpEl.addEventListener('touchstart', onFsUserActivity, { passive: true });

      vpEl.addEventListener('click', (e: MouseEvent) => {
        if (!isFsActive()) return;
        const target = e.target as HTMLElement;
        if (target.closest('#fsBottomBar') || target.closest('#btnFsCloseTop') || target.closest('button') || target.closest('input')) {
          return;
        }
        togglePlay();
        onFsUserActivity();
      });
    }

    // Thanh tiến trình (seek bar) trong toàn màn hình: kéo hoặc bấm bất kỳ để tua
    const fsProgressWrap = $('#fsProgressWrap');
    const fsProgressContainer = $('#fsProgressContainer');
    const fsTooltip = $('#fsProgressTooltip');
    let isFsScrubbing = false;

    const seekToFsEvent = (e: PointerEvent) => {
      if (!fsProgressContainer) return;
      const rect = fsProgressContainer.getBoundingClientRect();
      const dur = total();
      if (dur <= 0) return;
      const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const targetT = ratio * dur;
      seek(targetT);
      if (fsTooltip) {
        fsTooltip.style.display = 'block';
        fsTooltip.style.left = (ratio * 100).toFixed(1) + '%';
        fsTooltip.textContent = fmtSec(targetT);
      }
    };

    if (fsProgressWrap) {
      fsProgressWrap.addEventListener('pointerdown', (e: PointerEvent) => {
        e.stopPropagation();
        isFsScrubbing = true;
        try { fsProgressWrap.setPointerCapture(e.pointerId); } catch (err) {}
        seekToFsEvent(e);
        onFsUserActivity();
      });

      fsProgressWrap.addEventListener('pointermove', (e: PointerEvent) => {
        if (isFsScrubbing) {
          seekToFsEvent(e);
          onFsUserActivity();
        } else if (fsProgressContainer) {
          const rect = fsProgressContainer.getBoundingClientRect();
          const dur = total();
          const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
          if (fsTooltip) {
            fsTooltip.style.display = 'block';
            fsTooltip.style.left = (ratio * 100).toFixed(1) + '%';
            fsTooltip.textContent = fmtSec(ratio * dur);
          }
        }
      });

      fsProgressWrap.addEventListener('pointerleave', () => {
        if (!isFsScrubbing && fsTooltip) {
          fsTooltip.style.display = 'none';
        }
      });

      const endFsScrub = (e: PointerEvent) => {
        if (isFsScrubbing) {
          isFsScrubbing = false;
          try { fsProgressWrap.releasePointerCapture(e.pointerId); } catch (err) {}
          if (fsTooltip) fsTooltip.style.display = 'none';
          onFsUserActivity();
        }
      };
      fsProgressWrap.addEventListener('pointerup', endFsScrub);
      fsProgressWrap.addEventListener('pointercancel', endFsScrub);
    }

    document.addEventListener('fullscreenchange', () => {
      const v = $('#stageViewport');
      if (document.fullscreenElement) {
        v?.classList.add('is-fullscreen');
        onFsUserActivity();
      } else {
        v?.classList.remove('is-fullscreen', 'fs-idle');
        if (fsIdleTimer) { clearTimeout(fsIdleTimer); fsIdleTimer = null; }
      }
      setTimeout(() => { fitStage(); draw(); }, 60);
    });

    // Thanh kéo chia giữa Preview và Timeline để tự đổi độ cao
    const tlHandle = $('#tlResizeHandle');
    if (tlHandle) {
      let isResizing = false;
      let startY = 0;
      let startH = 200;
      tlHandle.addEventListener('pointerdown', (e: PointerEvent) => {
        isResizing = true;
        startY = e.clientY;
        const tlEl = document.querySelector('.studio-timeline') as HTMLElement | null;
        startH = tlEl ? tlEl.clientHeight : 200;
        tlHandle.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      tlHandle.addEventListener('pointermove', (e: PointerEvent) => {
        if (!isResizing) return;
        const delta = startY - e.clientY;
        const newH = clamp(startH + delta, 150, 420);
        document.documentElement.style.setProperty('--tl-height', `${newH}px`);
        fitStage();
      });
      const endResize = (e: PointerEvent) => {
        if (isResizing) {
          isResizing = false;
          try { tlHandle.releasePointerCapture(e.pointerId); } catch (err) {}
          fitStage();
        }
      };
      tlHandle.addEventListener('pointerup', endResize);
      tlHandle.addEventListener('pointercancel', endResize);
    }

    // Các nút trong thuộc tính đoạn nhạc (Contextual Audio)
    safeClick('#btnCtxCloseGaps', closeAudioGaps);
    safeClick('#btnCtxDelAudio', () => {
      if (S.selAudioId != null) {
        const idx = S.audioBlocks.findIndex(b => b.id === S.selAudioId);
        if (idx >= 0) {
          pushTimelineHistory();
          S.audioBlocks.splice(idx, 1);
          S.selAudioId = null;
          autoFitImagesToMusic();
          refreshAll();
          toast('Đã xóa đoạn nhạc.');
        }
      }
    });

    // Các ô nhập trong thuộc tính câu Lyric (Contextual Lyric)
    safeInput('#inspLyrText', (e: any) => {
      const ly = selLyr();
      if (!ly) return;
      ly.text = e.target.value;
      syncLyrToEditor(false);
    });
    safeChange('#inspLyrStart', (e: any) => {
      const ly = selLyr();
      if (!ly) return;
      const v = Math.max(0, parseFloat(e.target.value) || 0);
      ly.t = parseFloat(v.toFixed(2));
      S.lyr.sort((a, b) => a.t - b.t);
      syncLyrToEditor(true);
    });
    safeChange('#inspLyrEnd', (e: any) => {
      const ly = selLyr();
      if (!ly) return;
      const v = Math.max(ly.t + 0.1, parseFloat(e.target.value) || (ly.t + 1));
      ly.endT = parseFloat(v.toFixed(2));
      syncLyrToEditor(true);
    });
    safeChange('#inspLyrColorDef', (e: any) => {
      const ly = selLyr();
      if (!ly) return;
      if (e.target.checked) {
        delete ly.color;
      } else {
        ly.color = ($('#inspLyrColor') as HTMLInputElement)?.value || '#ffffff';
      }
      updateInspector();
      draw();
    });
    safeInput('#inspLyrColor', (e: any) => {
      const ly = selLyr();
      if (!ly) return;
      ly.color = e.target.value;
      const chk = $('#inspLyrColorDef') as HTMLInputElement | null;
      if (chk) chk.checked = false;
      draw();
    });
    safeChange('#inspLyrHiDef', (e: any) => {
      const ly = selLyr();
      if (!ly) return;
      if (e.target.checked) {
        delete ly.hi;
      } else {
        ly.hi = ($('#inspLyrHi') as HTMLInputElement)?.value || '#ffd23f';
      }
      updateInspector();
      draw();
    });
    safeInput('#inspLyrHi', (e: any) => {
      const ly = selLyr();
      if (!ly) return;
      ly.hi = e.target.value;
      const chk = $('#inspLyrHiDef') as HTMLInputElement | null;
      if (chk) chk.checked = false;
      draw();
    });
    safeChange('#inspLyrSize', (e: any) => {
      const ly = selLyr();
      if (!ly) return;
      const sz = parseFloat(e.target.value) || 0;
      if (sz > 0) ly.size = sz;
      else delete ly.size;
      draw();
    });
    safeClick('#btnInspSplitLyr', splitLyricAtPlayhead);
    safeClick('#btnInspMergeNext', mergeLyricWithNext);
    safeClick('#btnInspAddLyr', addLyricAtPlayhead);
    safeClick('#btnInspDelLyr', deleteLyricLine);

    // Cài đặt mờ dần đầu/cuối video
    safeInput('#rFadeIn', (e: any) => {
      pushTimelineHistory();
      A.fadeIn = Math.max(0, parseFloat(e.target.value) || 0);
      const valEl = $('#rFadeInVal');
      if (valEl) valEl.textContent = A.fadeIn.toFixed(1) + 's';
      applyVol(A.isPreviewing || A.isTrimPreviewing);
      renderTimeline();
    });

    safeInput('#rFadeOut', (e: any) => {
      pushTimelineHistory();
      A.fadeOut = Math.max(0, parseFloat(e.target.value) || 0);
      const valEl = $('#rFadeOutVal');
      if (valEl) valEl.textContent = A.fadeOut.toFixed(1) + 's';
      applyVol(A.isPreviewing || A.isTrimPreviewing);
      renderTimeline();
    });

    document.querySelectorAll('.filter-chip-btn[data-col]').forEach(b => {
      b.addEventListener('click', () => {
        const c = selClip();
        if (!c) return toast('Hãy chọn một clip trên timeline trước.');
        pushTimelineHistory();
        c.color = (b as any).dataset.col || 'none';
        refreshAll();
        updateInspector();
        toast('Đã áp dụng bộ lọc: ' + (COL[c.color] || c.color));
      });
    });

    document.querySelectorAll('.fx-chip-btn[data-fx]').forEach(b => {
      b.addEventListener('click', () => {
        const c = selClip();
        if (!c) return toast('Hãy chọn một clip trên timeline trước.');
        pushTimelineHistory();
        c.fx = (b as any).dataset.fx || 'none';
        refreshAll();
        updateInspector();
        toast('Đã áp dụng chuyển động: ' + (FX[c.fx] || c.fx));
      });
    });

    safeChange('#rFit', (e: any) => {
      const c = selClip();
      if (!c) return toast('Hãy chọn một clip trên timeline trước.');
      pushTimelineHistory();
      c.fit = e.target.value;
      refreshAll();
      updateInspector();
      toast('Đã áp dụng khung: ' + (c.fit === 'cover' ? 'Phủ kín khung' : 'Vừa ảnh, nền mờ'));
    });

    document.querySelectorAll('.speed-btn[data-speed]').forEach(b => {
      b.addEventListener('click', () => {
        const rate = parseFloat((b as any).dataset.speed || '1.0');
        setSpeed(rate);
        document.querySelectorAll('.speed-btn').forEach(x => {
          x.classList.toggle('active', x === b);
        });
      });
    });

    // Project title rename
    safeChange('#projectTitleInput', (e: any) => {
      const val = (e.target.value || '').trim() || 'Dự án chưa đặt tên';
      document.title = val + ' - Lyric Video Studio';
      toast('Đã đổi tên dự án: ' + val);
    });

    // Transport buttons: 5s back & forward, top undo & redo, timeline zoom in & out
    safeClick('#bStepBack5', () => seek(S.t - 5));
    safeClick('#bStepFwd5', () => seek(S.t + 5));
    safeClick('#btnTopUndo', undoTimeline);
    safeClick('#btnTopRedo', redoTimeline);
    safeClick('#btnTlZoomIn', () => {
      S.pps = Math.min(200, S.pps + 15);
      const z = $('#zoom') as HTMLInputElement | null;
      if (z) z.value = String(S.pps);
      renderTimeline();
    });
    safeClick('#btnTlZoomOut', () => {
      S.pps = Math.max(15, S.pps - 15);
      const z = $('#zoom') as HTMLInputElement | null;
      if (z) z.value = String(S.pps);
      renderTimeline();
    });

    const setOrient = (o: string) => {
      S.orient = o;
      $('#oV')?.setAttribute('aria-pressed', String(o === 'v'));
      $('#oH')?.setAttribute('aria-pressed', String(o === 'h'));
      $('#oV2')?.setAttribute('aria-pressed', String(o === 'v'));
      $('#oH2')?.setAttribute('aria-pressed', String(o === 'h'));
      setSize();
      draw();
    };
    safeClick('#oV', () => setOrient('v'));
    safeClick('#oH', () => setOrient('h'));
    safeClick('#oV2', () => setOrient('v'));
    safeClick('#oH2', () => setOrient('h'));
    safeChange('#res', (e: any) => {
      S.res = +e.target.value;
      const r2 = $('#res2') as HTMLSelectElement | null;
      if (r2) r2.value = e.target.value;
      setSize();
      draw();
    });
    safeChange('#res2', (e: any) => {
      S.res = +e.target.value;
      const r1 = $('#res') as HTMLSelectElement | null;
      if (r1) r1.value = e.target.value;
      setSize();
      draw();
    });

    ['#fileMedia', '#fileMedia2'].forEach(s => $(s)?.addEventListener('change', async (e: any) => {
      await addFiles(e.target.files);
      e.target.value = '';
    }));
    safeOn('#fileAudio', 'change', async (e: any) => {
      if (e.target.files[0]) await loadAudio(e.target.files[0]);
      e.target.value = '';
    });

    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDrop);

    safeChange('#defDur', (e: any) => { S.def.dur = clamp(+e.target.value || 4, 0.5, 60); });
    safeChange('#defFit', (e: any) => { S.def.fit = e.target.value; });
    safeChange('#defFx', (e: any) => { S.def.fx = e.target.value; });
    safeChange('#defTr', (e: any) => { S.def.tr = e.target.value; });
    safeChange('#defTrD', (e: any) => { S.def.trDur = clamp(+e.target.value || 0.6, 0.1, 3); });
    safeClick('#btnPreviewTr', () => {
      const tr = ($('#defTr') as HTMLSelectElement)?.value || S.def.tr;
      const dur = clamp(+($('#defTrD') as HTMLInputElement)?.value || S.def.trDur || 0.6, 0.1, 3);
      previewTransition(tr, dur);
    });
    safeClick('#btnPreviewClipTr', () => {
      const c = selClip();
      if (!c) return;
      const cIdx = S.clips.findIndex(x => x.id === c.id);
      if (cIdx <= 0) {
        previewTransition(c.tr || S.def.tr, c.trDur || S.def.trDur);
      } else {
        previewSeamTransition(cIdx);
      }
    });
    safeClick('#btnApplyClipTrAll', () => {
      const c = selClip();
      if (!c) return;
      const cIdx = S.clips.findIndex(x => x.id === c.id);
      if (cIdx <= 0) return toast('Chọn một clip từ thứ hai trở đi để áp dụng chuyển cảnh.');
      pushTimelineHistory();
      const tr = c.tr;
      const trd = c.trDur;
      for (let j = 1; j < S.clips.length; j++) {
        const cur = S.clips[j], prev = S.clips[j - 1];
        cur.tr = tr;
        const maxD = Math.max(0.1, Math.min(3.0, prev.dur * 0.5, cur.dur * 0.5));
        cur.trDur = Math.min(trd, maxD);
      }
      refreshAll();
      updateInspector();
      toast('Đã áp dụng chuyển cảnh "' + (TR[tr] || tr) + '" cho tất cả chỗ nối!');
    });
    safeClick('#applyAll', () => {
      S.clips.forEach((c, i) => {
        if (c.type === 'image') { c.dur = S.def.dur; c.fx = S.def.fx; c.fit = S.def.fit; }
        if (i > 0) {
          c.tr = S.def.tr;
          const prev = S.clips[i - 1];
          const maxD = Math.max(0.1, Math.min(3.0, prev.dur * 0.5, c.dur * 0.5));
          c.trDur = Math.min(S.def.trDur, maxD);
        }
      });
      refreshAll();
      toast('Đã áp dụng chuyển động và chuyển cảnh (' + (TR[S.def.tr] || S.def.tr) + ') cho mọi clip.');
    });

    // nhạc & âm lượng đồng bộ
    safeInput('#aVol', (e: any) => { setVolume(+e.target.value, 'aVol'); });
    safeInput('#stageVol', (e: any) => { setVolume(+e.target.value, 'stageVol'); });
    safeClick('#bMute', toggleMute);
    const aStartInput = $('#aStart');
    if (aStartInput) {
      aStartInput.onchange = (e: any) => {
        A.start = Math.max(0, +e.target.value || 0);
        if (S.syncWithMusic) applyMusicSync();
        if (S.playing) startAudio();
        renderWaveformEditor();
        renderTimeline();
      };
    }
    const aFadeInput = $('#aFade');
    if (aFadeInput) {
      aFadeInput.onchange = (e: any) => { A.fade = e.target.checked; applyVol(A.isPreviewing || A.isTrimPreviewing); };
    }

    /* Waveform Editor controls */
    const wfZoomInput = $('#wfZoom');
    if (wfZoomInput) {
      wfZoomInput.oninput = (e: any) => {
        A.wfZoom = Math.max(1, Math.min(10, +e.target.value || 1));
        renderWaveformEditor();
      };
    }

    const applyPreset30 = () => applyAudioPreset(30);
    const applyPreset60 = () => applyAudioPreset(60);
    const applyPresetAll = () => applyAudioPreset(null);

    safeClick('#btnPreset30', applyPreset30);
    safeClick('#btnPreset60', applyPreset60);
    safeClick('#btnPresetAll', applyPresetAll);
    safeClick('#btnTlPre30', applyPreset30);
    safeClick('#btnTlPre60', applyPreset60);
    safeClick('#btnTlPreAll', applyPresetAll);
    safeClick('#btnTlUndo', undoTimeline);
    safeClick('#btnTlRedo', redoTimeline);
    safeClick('#btnTlSplit', splitAtPlayhead);
    safeClick('#btnTlDelete', deleteSelected);
    safeClick('#btnTlCloseGaps', closeAudioGaps);
    safeClick('#tSplit', splitAtPlayhead);

    // Fade in / Fade out trên thanh công cụ timeline
    safeChange('#tlFadeIn', (e: any) => {
      pushTimelineHistory();
      A.fadeIn = Math.max(0, parseFloat(e.target.value) || 0);
      const aFadeIn = $('#aFadeIn') as HTMLInputElement | null;
      if (aFadeIn) aFadeIn.value = String(A.fadeIn);
      applyVol(A.isPreviewing || A.isTrimPreviewing);
      renderTimeline();
      renderWaveformEditor();
      toast('Fade vào: ' + A.fadeIn + 's');
    });
    safeChange('#tlFadeOut', (e: any) => {
      pushTimelineHistory();
      A.fadeOut = Math.max(0, parseFloat(e.target.value) || 0);
      const aFadeOut = $('#aFadeOut') as HTMLInputElement | null;
      if (aFadeOut) aFadeOut.value = String(A.fadeOut);
      applyVol(A.isPreviewing || A.isTrimPreviewing);
      renderTimeline();
      renderWaveformEditor();
      toast('Fade ra: ' + A.fadeOut + 's');
    });

    const inputTrimS = $('#aTrimStart');
    if (inputTrimS) {
      inputTrimS.onchange = (e: any) => {
        const v = Math.max(0, parseFloat(e.target.value) || 0);
        A.start = Math.min(v, Math.max(0, A.end - 0.5));
        renderWaveformEditor();
        if (S.syncWithMusic) applyMusicSync();
        renderTimeline();
      };
    }

    const inputTrimE = $('#aTrimEnd');
    if (inputTrimE) {
      inputTrimE.onchange = (e: any) => {
        const v = parseFloat(e.target.value) || A.dur;
        A.end = Math.min(A.dur, Math.max(A.start + 0.5, v));
        renderWaveformEditor();
        if (S.syncWithMusic) applyMusicSync();
        renderTimeline();
      };
    }

    const inputFadeIn = $('#aFadeIn');
    if (inputFadeIn) {
      inputFadeIn.onchange = (e: any) => {
        A.fadeIn = Math.max(0, parseFloat(e.target.value) || 0);
        renderWaveformEditor();
        applyVol(A.isPreviewing || A.isTrimPreviewing);
      };
    }

    const inputFadeOut = $('#aFadeOut');
    if (inputFadeOut) {
      inputFadeOut.onchange = (e: any) => {
        A.fadeOut = Math.max(0, parseFloat(e.target.value) || 0);
        renderWaveformEditor();
        applyVol(A.isPreviewing || A.isTrimPreviewing);
      };
    }

    const btnPlayTr = $('#btnPlayTrim');
    if (btnPlayTr) {
      btnPlayTr.onclick = () => {
        if (A.isTrimPreviewing) stopTrimPreview();
        else startTrimPreview();
      };
    }

    const btnStopTr = $('#btnStopTrim');
    if (btnStopTr) {
      btnStopTr.onclick = () => {
        stopTrimPreview();
        if (A.el) A.el.currentTime = A.start;
        updateTrimPlayhead();
      };
    }

    // Nút xuất nhạc đã cắt (WAV / MP3)
    safeClick('#btnExportTrimWav', () => exportTrimmedAudio('wav'));
    safeClick('#btnExportTrimMp3', () => exportTrimmedAudio('mp3'));
    safeClick('#btnExportWavQuick', () => exportTrimmedAudio('wav'));

    // Dragging handles and region on waveform editor
    const handleStartEl = $('#wfHandleStart');
    const handleEndEl = $('#wfHandleEnd');
    const regionEl = $('#wfRegion');
    const trackEl = $('#wfTrack');
    const cvEl = $('#wfCv');

    let wfDragMode: 'start' | 'end' | 'region' | null = null;
    let dragStartX = 0;
    let dragInitStart = 0;
    let dragInitEnd = 0;

    const setupDrag = (el: HTMLElement | null, mode: 'start' | 'end' | 'region') => {
      if (!el) return;
      el.addEventListener('pointerdown', (e: PointerEvent) => {
        if (!A.loaded || A.dur <= 0) return;
        e.preventDefault();
        e.stopPropagation();
        wfDragMode = mode;
        dragStartX = e.clientX;
        dragInitStart = A.start;
        dragInitEnd = A.end;
        el.setPointerCapture(e.pointerId);
      });
      el.addEventListener('pointermove', (e: PointerEvent) => {
        if (wfDragMode !== mode || !trackEl) return;
        const trackW = trackEl.clientWidth || 360;
        const dur = A.dur || 1;
        const deltaPx = e.clientX - dragStartX;
        const deltaTime = (deltaPx / trackW) * dur;

        if (mode === 'start') {
          const trackRect = trackEl.getBoundingClientRect();
          const targetPx = e.clientX - trackRect.left;
          const targetTime = (targetPx / trackW) * dur;
          A.start = clamp(targetTime, 0, Math.max(0, A.end - 0.5));
        } else if (mode === 'end') {
          const trackRect = trackEl.getBoundingClientRect();
          const targetPx = e.clientX - trackRect.left;
          const targetTime = (targetPx / trackW) * dur;
          A.end = clamp(targetTime, Math.min(dur, A.start + 0.5), dur);
        } else if (mode === 'region') {
          const span = dragInitEnd - dragInitStart;
          const newStart = clamp(dragInitStart + deltaTime, 0, Math.max(0, dur - span));
          A.start = newStart;
          A.end = Math.min(dur, newStart + span);
        }
        renderWaveformEditor();
      });
      const endDrag = (e: PointerEvent) => {
        if (wfDragMode === mode) {
          wfDragMode = null;
          try { el.releasePointerCapture(e.pointerId); } catch (err) {}
          if (S.syncWithMusic) applyMusicSync();
          renderTimeline();
        }
      };
      el.addEventListener('pointerup', endDrag);
      el.addEventListener('pointercancel', endDrag);
    };

    setupDrag(handleStartEl, 'start');
    setupDrag(handleEndEl, 'end');
    setupDrag(regionEl, 'region');

    if (cvEl && trackEl) {
      cvEl.addEventListener('click', (e: MouseEvent) => {
        if (!A.loaded || A.dur <= 0) return;
        const r = trackEl.getBoundingClientRect();
        const clickPx = e.clientX - r.left;
        const clickTime = (clickPx / trackEl.clientWidth) * A.dur;
        const distStart = Math.abs(clickTime - A.start);
        const distEnd = Math.abs(clickTime - A.end);
        if (distStart < distEnd) {
          A.start = clamp(clickTime, 0, Math.max(0, A.end - 0.5));
        } else {
          A.end = clamp(clickTime, Math.min(A.dur, A.start + 0.5), A.dur);
        }
        renderWaveformEditor();
        if (S.syncWithMusic) applyMusicSync();
        renderTimeline();
      });
    }

    safeChange('#syncWithMusic', (e: any) => {
      S.syncWithMusic = e.target.checked;
      const grp = $('#syncModeGroup');
      if (grp) grp.hidden = !S.syncWithMusic;
      if (S.syncWithMusic) {
        applyMusicSync(true);
      } else {
        toast('Đã tắt chế độ theo độ dài bài hát. Độ dài video tính theo tổng thời lượng clip.');
        refreshAll();
      }
    });
    safeChange('#syncMusicMode', (e: any) => {
      S.syncMusicMode = e.target.value;
      if (S.syncWithMusic) {
        applyMusicSync(true);
      }
    });

    safeClick('#btnResumeCtx', async () => {
      await resumeAudioContext('Nút Kích hoạt');
    });
    safeClick('#btnReloadAudio', async () => {
      if (A.file) {
        toast('Đang tải lại file nhạc: ' + A.file.name);
        await loadAudio(A.file);
      } else {
        const fileAudio = $('#fileAudio');
        if (fileAudio) fileAudio.click();
      }
    });

    safeClick('#btnPrevPlay', () => {
      if (A.isPreviewing) pausePreview();
      else startPreview();
    });
    safeClick('#btnPrevStop', () => {
      stopPreview();
    });
    safeInput('#prevScrub', (e: any) => {
      A.previewOffset = +e.target.value;
      if (A.isPreviewing) {
        startPreview();
      } else {
        updatePreviewUI();
      }
    });

    safeClick('#rmAudio', () => {
      halt();
      stopAllPreviews();
      A.loaded = false;
      A.file = null;
      A.buffer = null;
      A.peaks = [];
      A.rawPeaks = [];
      A.dur = 0;
      A.start = 0;
      A.end = 0;
      A.name = '';
      A.loadState = 'Đã bỏ nhạc';
      A.error = '';
      S.audioBlocks = [];
      S.selAudioId = null;
      const aInfo = $('#audioInfo');
      if (aInfo) aInfo.textContent = 'Chưa có nhạc. Video vẫn xem và xuất được, chỉ là không có tiếng.';
      renderWaveformEditor();
      refreshAll();
      updateAudioStatus();
      updateUI();
    });
    safeClick('#fitMusic', () => {
      if (!A.loaded) return toast('Hãy chọn nhạc trước.');
      autoFitImagesToMusic(true);
      refreshAll();
    });

    // lyric: Bộ 3 bước (1. Nhập lời, 2. Căn giờ, 3. Chỉnh sửa)
    safeClick('#btnLyrStep1', () => switchLyricStep(1));
    safeClick('#btnLyrStep2', () => switchLyricStep(2));
    safeClick('#btnLyrStep3', () => switchLyricStep(3));

    // Bước 1: Nhập lời
    safeClick('#btnParseLyrics', createSentenceListFromRaw);
    safeOn('#fileLrc', 'change', async (e: any) => {
      const f = e.target.files?.[0];
      if (!f) return;
      try {
        const txt = await f.text();
        pushLyricHistory();
        if (f.name.toLowerCase().endsWith('.srt') || txt.includes('-->')) {
          S.lyr = parseSrt(txt);
        } else {
          S.lyr = parseLyr(txt);
        }
        const rawEl = $('#lyrRawInput') as HTMLTextAreaElement | null;
        if (rawEl) rawEl.value = rawLyricLines().join('\n');
        syncLyrToEditor(false);
        toast(`Đã nhập ${S.lyr.length} câu từ file ${f.name}`);
        switchLyricStep(3);
      } catch (err) {
        toast('Lỗi khi đọc file lời bài hát: ' + (err as any)?.message);
      }
      e.target.value = '';
    });

    // Bước 2: Căn giờ (Tap-to-sync)
    safeClick('#btnTapMarkNow', tapMarkNow);
    safeClick('#btnTapUndoLine', tapUndoLine);
    safeClick('#btnTapSkipLine', tapSkipLine);
    safeClick('#btnTapSpeed075', () => setSpeed(0.75));
    safeClick('#btnTapSpeed1', () => setSpeed(1.0));
    safeClick('#btnTapGoStep3', () => switchLyricStep(3));

    // Bước 3: Chỉnh sửa thẻ câu & Nâng cao
    safeClick('#btnBackToStep2', () => switchLyricStep(2));
    safeClick('#btnCardAddAtHead', addLyricAtPlayhead);
    safeClick('#shiftMinus', () => shiftLyr(-Math.abs(+$('#shiftV')?.value || 0.3)));
    safeClick('#shiftPlus', () => shiftLyr(Math.abs(+$('#shiftV')?.value || 0.3)));
    safeClick('#lyrClearAllTimes', clearAllTimes);

    const cardsListEl = $('#lyrCardsList');
    if (cardsListEl) {
      cardsListEl.addEventListener('click', handleCardAction);
      cardsListEl.addEventListener('change', handleCardChange);
    }

    // chữ
    const st = S.style, redraw = () => draw();
    safeChange('#sFont', async (e: any) => { st.font = e.target.value; await loadFonts(); draw(); });
    safeInput('#sSize', (e: any) => { st.size = +e.target.value; redraw(); });
    safeChange('#sWeight', async (e: any) => { st.weight = e.target.value; await loadFonts(); draw(); });
    safeInput('#sColor', (e: any) => { st.color = e.target.value; redraw(); });
    safeInput('#sHi', (e: any) => { st.hi = e.target.value; redraw(); });
    safeInput('#sOutC', (e: any) => { st.outColor = e.target.value; redraw(); });
    safeInput('#sOut', (e: any) => { st.outW = +e.target.value; redraw(); });
    safeInput('#sBox', (e: any) => { st.box = +e.target.value; redraw(); });
    safeInput('#sY', (e: any) => { st.y = +e.target.value; redraw(); });
    safeChange('#sAnim', (e: any) => { st.anim = e.target.value; redraw(); });
    safeChange('#sKara', (e: any) => { st.karaoke = e.target.checked; redraw(); });
    safeChange('#sNext', (e: any) => { st.next = e.target.checked; redraw(); });
    safeChange('#sShadow', (e: any) => { st.shadow = e.target.checked; redraw(); });
    safeChange('#sUpper', (e: any) => { st.upper = e.target.checked; redraw(); });
    safeInput('#tText', async (e: any) => { S.title.text = e.target.value; await loadFonts(); draw(); });
    safeChange('#tDur', (e: any) => { S.title.dur = clamp(+e.target.value || 3, 1, 30); draw(); });
    safeOn('#fileFont', 'change', async (e: any) => {
      const f = e.target.files[0];
      if (!f) return;
      const name = f.name.replace(/\.[^.]+$/, '').replace(/[^\w\- ]/g, '') || 'Font của bạn';
      try {
        const ff = new FontFace(name, await f.arrayBuffer());
        await ff.load();
        document.fonts.add(ff);
        const o = document.createElement('option');
        o.value = name;
        o.textContent = name + ' (của bạn)';
        const sFont = $('#sFont');
        if (sFont) {
          sFont.appendChild(o);
          sFont.value = name;
        }
        st.font = name;
        draw();
        toast('Đã thêm font ' + name);
      } catch (err) {
        toast('Không đọc được file font này.');
      }
      e.target.value = '';
    });

    // sóng nhạc (hiệu ứng theo nhạc & mẫu sóng nhanh)
    document.querySelectorAll('.viz-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pKey = (btn as HTMLElement).dataset.presetKey;
        if (pKey && VIZ_PRESETS[pKey]) {
          applyVizPreset(pKey);
        }
      });
    });

    document.querySelectorAll('.viz-palette-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const c1 = (btn as HTMLElement).dataset.c1;
        const c2 = (btn as HTMLElement).dataset.c2;
        if (c1) S.viz.color = c1;
        if (c2) S.viz.color2 = c2;
        syncVizControlsToState();
        draw();
        toast('Đã áp dụng bảng màu: ' + ((btn as HTMLElement).title || ''));
      });
    });

    safeChange('#vizType', (e: any) => {
      S.viz.type = e.target.value;
      const isCenterType = ['circle', 'polygon', 'ring', 'blob'].includes(S.viz.type);
      if (isCenterType && S.viz.y === 82) {
        S.viz.y = 50;
      } else if (!isCenterType && S.viz.y === 50) {
        S.viz.y = 82;
      }
      syncVizControlsToState();
      draw();
    });

    safeChange('#vizColorMode', (e: any) => {
      S.viz.colorMode = e.target.value;
      syncVizControlsToState();
      draw();
    });

    safeChange('#vizBars', (e: any) => {
      S.viz.bars = +e.target.value;
      draw();
    });

    safeInput('#vizColor', (e: any) => {
      S.viz.color = e.target.value;
      draw();
    });

    safeInput('#vizColor2', (e: any) => {
      S.viz.color2 = e.target.value;
      draw();
    });

    safeInput('#vizY', (e: any) => {
      S.viz.y = +e.target.value;
      const lbl = $('#vizYLbl');
      if (lbl) lbl.textContent = S.viz.y + '%';
      draw();
    });

    safeInput('#vizX', (e: any) => {
      S.viz.x = +e.target.value;
      const lbl = $('#vizXLbl');
      if (lbl) lbl.textContent = S.viz.x + '%';
      draw();
    });

    safeClick('#btnVizPosBottom', () => {
      S.viz.y = 82;
      syncVizControlsToState();
      draw();
    });

    safeClick('#btnVizPosCenter', () => {
      S.viz.y = 50;
      syncVizControlsToState();
      draw();
    });

    safeClick('#btnVizPosTop', () => {
      S.viz.y = 20;
      syncVizControlsToState();
      draw();
    });

    safeClick('#btnVizPosLeft', () => {
      S.viz.x = 25;
      syncVizControlsToState();
      draw();
    });

    safeClick('#btnVizPosMidX', () => {
      S.viz.x = 50;
      syncVizControlsToState();
      draw();
    });

    safeClick('#btnVizPosRight', () => {
      S.viz.x = 75;
      syncVizControlsToState();
      draw();
    });

    safeInput('#vizSize', (e: any) => {
      S.viz.size = +e.target.value;
      const lbl = $('#vizSizeLbl');
      if (lbl) lbl.textContent = S.viz.size.toFixed(2) + 'x';
      draw();
    });

    safeInput('#vizSens', (e: any) => {
      S.viz.sens = +e.target.value;
      const lbl = $('#vizSensLbl');
      if (lbl) lbl.textContent = S.viz.sens.toFixed(1) + 'x';
      draw();
    });

    safeChange('#vizGlow', (e: any) => {
      S.viz.glow = e.target.checked;
      draw();
    });

    safeOn('#vizLogoFile', 'change', (e: any) => {
      const f = e.target.files?.[0];
      if (!f) return;
      if (S.viz.logoUrl) URL.revokeObjectURL(S.viz.logoUrl);
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        S.viz.logoImg = img;
        S.viz.logoUrl = url;
        const previewImg = $('#vizLogoImgTag') as HTMLImageElement | null;
        const previewIcon = $('#vizLogoIcon');
        if (previewImg) {
          previewImg.src = url;
          previewImg.style.display = 'block';
        }
        if (previewIcon) previewIcon.style.display = 'none';
        draw();
        toast('Đã tải ảnh logo cho sóng tròn.');
      };
      img.src = url;
      e.target.value = '';
    });

    safeClick('#vizLogoClear', () => {
      if (S.viz.logoUrl) {
        URL.revokeObjectURL(S.viz.logoUrl);
        S.viz.logoUrl = '';
      }
      S.viz.logoImg = null;
      const previewImg = $('#vizLogoImgTag') as HTMLImageElement | null;
      const previewIcon = $('#vizLogoIcon');
      if (previewImg) previewImg.style.display = 'none';
      if (previewIcon) previewIcon.style.display = 'inline';
      draw();
      toast('Đã chuyển về đĩa than mặc định.');
    });

    safeClick('#btnToVisualTab', () => {
      const btn = document.querySelector('[data-tab="visual"]') as HTMLElement | null;
      if (btn) btn.click();
    });

    // phát
    const bPlayEl = $('#bPlay');
    if (bPlayEl) {
      bPlayEl.addEventListener('click', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        togglePlay();
      });
    }
    safeClick('#bStart', () => seek(0));
    safeClick('#bStop', stopPlayback);
    safeOn('#scrub', 'input', (e: any) => seek(+e.target.value));
    document.addEventListener('keydown', onKeyDown);

    // timeline
    safeInput('#zoom', (e: any) => { S.pps = +e.target.value; renderTimeline(); });
    safeClick('#btnTlFitZoom', () => {
      const sc = $('#tlScroll');
      const dur = total();
      if (!sc || dur <= 0) return;
      const availW = Math.max(200, sc.clientWidth - 40);
      const idealPps = clamp(Math.floor(availW / dur), 15, 200);
      S.pps = idealPps;
      const zoomInput = $('#zoom') as HTMLInputElement | null;
      if (zoomInput) zoomInput.value = String(idealPps);
      renderTimeline();
      toast('Đã chỉnh zoom vừa khung (' + idealPps + 'px/s)');
    });

    const toggleShortcutsModal = (open: boolean) => {
      const modal = $('#shortcutsModal');
      if (modal) modal.hidden = !open;
    };
    safeClick('#btnKbShortcuts', () => toggleShortcutsModal(true));
    safeClick('#btnCloseShortcuts', () => toggleShortcutsModal(false));
    safeClick('#btnOkShortcuts', () => toggleShortcutsModal(false));
    const scModalEl = $('#shortcutsModal');
    if (scModalEl) {
      scModalEl.addEventListener('click', (e: MouseEvent) => {
        if (e.target === scModalEl) scModalEl.hidden = true;
      });
    }

    /* ---------- CLIPCHAMP-STYLE TRANSITION MODAL ---------- */
    let activeTrSeamIdx = 1;
    let activeTrCategory = 'all';
    let seamPreviewTimeout: any = null;

    const toPascalCase = (key: string) => {
      if (key === 'fade') return 'Fade';
      if (key === 'fadeblack') return 'FadeBlack';
      if (key === 'fadewhite') return 'FadeWhite';
      if (key === 'slideleft') return 'SlideLeft';
      if (key === 'slideright') return 'SlideRight';
      if (key === 'slideup') return 'SlideUp';
      if (key === 'slidedown') return 'SlideDown';
      if (key === 'push') return 'Push';
      if (key === 'wiper') return 'Wiper';
      if (key === 'wiped') return 'Wiped';
      if (key === 'circleopen') return 'Circle';
      if (key === 'centeropen') return 'CenterOpen';
      if (key === 'zoom') return 'ZoomIn';
      if (key === 'zoomout') return 'ZoomOut';
      if (key === 'spin') return 'Spin';
      if (key === 'blur') return 'Blur';
      if (key === 'flash') return 'Flash';
      if (key === 'glitch') return 'Glitch';
      if (key === 'flip') return 'Flip';
      if (key === 'random') return 'Random';
      return 'Fade';
    };

    const previewSeamTransition = (clipIdx: number) => {
      if (clipIdx <= 0 || clipIdx >= S.clips.length) return;
      if (S.playing) pause();
      if (seamPreviewTimeout) { clearTimeout(seamPreviewTimeout); seamPreviewTimeout = null; }

      let seamTime = 0;
      for (let i = 0; i < clipIdx; i++) seamTime += S.clips[i].dur;
      const c = S.clips[clipIdx], prev = S.clips[clipIdx - 1];
      const maxD = Math.max(0.1, Math.min(3.0, prev.dur * 0.5, c.dur * 0.5));
      const trd = Math.max(0.1, Math.min(c.trDur || 1.0, maxD));
      const startT = Math.max(0, seamTime - 1.0);
      const stopT = Math.min(total(), seamTime + trd + 1.0);

      seek(startT);
      resumeAudioContext('Xem thử chuyển cảnh').then(() => {
        play();
        const checkStop = () => {
          if (!S.playing) return;
          if (S.t >= stopT) {
            pause();
            seek(seamTime);
          } else {
            seamPreviewTimeout = setTimeout(checkStop, 40);
          }
        };
        seamPreviewTimeout = setTimeout(checkStop, 40);
      });
    };

    const renderTrCatTabs = () => {
      const tabsEl = $('#trCatTabs');
      if (!tabsEl) return;
      const categories = [
        { key: 'all', label: 'Tất cả' },
        { key: 'Cơ bản', label: 'Cơ bản' },
        { key: 'Trượt', label: 'Trượt' },
        { key: 'Quét', label: 'Quét' },
        { key: 'Phóng', label: 'Phóng' },
        { key: 'Phong cách', label: 'Phong cách' },
        { key: 'Lựa chọn', label: 'Ngẫu nhiên' }
      ];
      tabsEl.innerHTML = categories.map(cat =>
        `<button type="button" class="tr-cat-tab${activeTrCategory === cat.key ? ' active' : ''}" data-cat="${cat.key}">${cat.label}</button>`
      ).join('');

      tabsEl.querySelectorAll('.tr-cat-tab').forEach((btn: any) => {
        btn.addEventListener('click', () => {
          activeTrCategory = (btn as HTMLElement).dataset.cat || 'all';
          renderTrCatTabs();
          renderTrCards();
        });
      });
    };

    const renderTrCards = () => {
      const gridEl = $('#trGrid');
      if (!gridEl) return;
      const c = S.clips[activeTrSeamIdx];
      if (!c) return;

      const items: { key: string; label: string; icon: string; group: string }[] = [];
      TR_GROUPS.forEach(g => {
        if (activeTrCategory === 'all' || activeTrCategory === g.group) {
          g.items.forEach(it => {
            items.push({ ...it, group: g.group });
          });
        }
      });

      gridEl.innerHTML = items.map(it => {
        const isSel = c.tr === it.key;
        const animName = 'anim' + toPascalCase(it.key);
        return `
          <div class="tr-card${isSel ? ' active' : ''}" data-key="${it.key}" title="${esc(it.label)}">
            <div class="tr-card-preview">
              <div class="tr-anim-base">A</div>
              <div class="tr-anim-layer" style="animation-name:${animName};">${it.icon}</div>
            </div>
            <span class="tr-card-name">${it.icon} ${esc(it.label)}</span>
            <span class="tr-card-cat">${esc(it.group)}</span>
          </div>
        `;
      }).join('');

      gridEl.querySelectorAll('.tr-card').forEach((card: any) => {
        card.addEventListener('click', () => {
          const key = (card as HTMLElement).dataset.key || 'none';
          pushTimelineHistory();
          c.tr = key;
          renderTrCards();
          renderTimeline();
          updateInspector();
          draw();
        });
      });
    };

    const openTransitionModal = (clipIdx: number) => {
      if (clipIdx <= 0 || clipIdx >= S.clips.length) return;
      activeTrSeamIdx = clipIdx;
      const modal = $('#transitionModal');
      if (!modal) return;

      const c = S.clips[clipIdx];
      const prev = S.clips[clipIdx - 1];
      const badge = $('#trModalSeamBadge');
      if (badge) {
        badge.textContent = `Nối: Clip #${clipIdx} ("${prev.name}") ➔ Clip #${clipIdx + 1} ("${c.name}")`;
      }

      const maxAllowed = Math.max(0.1, Math.min(3.0, prev.dur * 0.5, c.dur * 0.5));
      c.trDur = Math.min(c.trDur || 1.0, maxAllowed);

      const durInput = $('#trModalDur') as HTMLInputElement | null;
      const durVal = $('#trModalDurVal');
      const durHint = $('#trModalDurHint');
      if (durInput) {
        durInput.max = maxAllowed.toFixed(1);
        durInput.value = c.trDur.toFixed(1);
      }
      if (durVal) durVal.textContent = c.trDur.toFixed(1) + 's';
      if (durHint) durHint.textContent = `(Tự giới hạn tối đa 50% = ${maxAllowed.toFixed(1)}s của clip ngắn hơn)`;

      renderTrCatTabs();
      renderTrCards();

      modal.hidden = false;
    };

    safeClick('#btnTrModalClose', () => { const m = $('#transitionModal'); if (m) m.hidden = true; });
    safeClick('#btnTrModalDone', () => { const m = $('#transitionModal'); if (m) m.hidden = true; });
    const trModalBackdrop = $('#transitionModal');
    if (trModalBackdrop) {
      trModalBackdrop.addEventListener('click', (e: MouseEvent) => {
        if (e.target === trModalBackdrop) trModalBackdrop.hidden = true;
      });
    }

    safeInput('#trModalDur', (e: any) => {
      const c = S.clips[activeTrSeamIdx];
      if (!c) return;
      const prev = S.clips[activeTrSeamIdx - 1];
      const maxAllowed = Math.max(0.1, Math.min(3.0, prev ? prev.dur * 0.5 : 3.0, c.dur * 0.5));
      const val = clamp(+e.target.value || 1.0, 0.1, maxAllowed);
      c.trDur = val;
      const durVal = $('#trModalDurVal');
      if (durVal) durVal.textContent = val.toFixed(1) + 's';
      renderTimeline();
      updateInspector();
      draw();
    });

    safeClick('#btnTrModalPreview', () => {
      previewSeamTransition(activeTrSeamIdx);
    });

    safeClick('#btnTrModalApplyAll', () => {
      const c = S.clips[activeTrSeamIdx];
      if (!c) return;
      pushTimelineHistory();
      const selTr = c.tr;
      const selDur = c.trDur;
      for (let j = 1; j < S.clips.length; j++) {
        const cur = S.clips[j], prev = S.clips[j - 1];
        cur.tr = selTr;
        const maxD = Math.max(0.1, Math.min(3.0, prev.dur * 0.5, cur.dur * 0.5));
        cur.trDur = Math.min(selDur, maxD);
      }
      refreshAll();
      updateInspector();
      toast(`Đã áp dụng chuyển cảnh "${TR[selTr] || selTr}" cho tất cả chỗ nối!`);
    });

    safeClick('#btnTrModalRemove', () => {
      const c = S.clips[activeTrSeamIdx];
      if (!c) return;
      pushTimelineHistory();
      c.tr = 'none';
      renderTrCards();
      renderTimeline();
      updateInspector();
      draw();
      toast('Đã gỡ chuyển cảnh tại chỗ nối này (Cắt thẳng)');
    });

    const tl = $('#tl');
    let drag = false;
    const scrubTo = (e: PointerEvent) => {
      if (!tl) return;
      const r = tl.getBoundingClientRect();
      seek((e.clientX - r.left) / S.pps);
    };
    if (tl) {
      tl.addEventListener('pointerdown', (e: PointerEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('#clips') || target.closest('#alane') || target.closest('#llane')) return;

        S.selAudioId = null;
        S.selLyrId = null;
        renderTimeline();
        drag = true;
        tl.setPointerCapture(e.pointerId);
        scrubTo(e);
      });
      tl.addEventListener('pointermove', (e: PointerEvent) => { if (drag) scrubTo(e); });
      tl.addEventListener('pointerup', (e: PointerEvent) => {
        drag = false;
        try { tl.releasePointerCapture(e.pointerId); } catch (err) {}
      });
      tl.addEventListener('pointercancel', (e: PointerEvent) => {
        drag = false;
        try { tl.releasePointerCapture(e.pointerId); } catch (err) {}
      });
    }

    // Tương tác trên track Clip (#clips): Kéo mép chỉnh độ dài & Kéo khối dời thứ tự
    const clipsEl = $('#clips');
    const clipTip = $('#clipDragTip');
    const dropIndicator = $('#clipDropIndicator');
    let cDragMode: 'body' | 'left' | 'right' | null = null;
    let cDragClip: Clip | null = null;
    let cDragIdx = -1;
    let cStartX = 0;
    let cInitDur = 0;
    let cInitSrcIn = 0;
    let cInitSrcOut = 0;
    let cInitStartSec = 0;
    let cDragHasMoved = false;
    let targetDropIdx = -1;
    let preClipState: TimelineHistoryState | null = null;

    const getTimelineSnapPoints = (excludeClipId?: number): number[] => {
      const pts = new Set<number>();
      pts.add(parseFloat(S.t.toFixed(2))); // Đầu phát

      // Mép các clip khác
      let a = 0;
      pts.add(0);
      S.clips.forEach(c => {
        a += c.dur;
        if (c.id !== excludeClipId) {
          pts.add(parseFloat(a.toFixed(2)));
        }
      });

      // Mép các đoạn nhạc
      S.audioBlocks.forEach(b => {
        pts.add(parseFloat(b.start.toFixed(2)));
        pts.add(parseFloat((b.start + b.dur).toFixed(2)));
      });

      return Array.from(pts);
    };

    const snapTime = (val: number, snapPoints: number[], thresholdSec: number): { time: number; snapped: boolean } => {
      let closest = val;
      let minDiff = thresholdSec;
      let snapped = false;

      for (const pt of snapPoints) {
        const diff = Math.abs(val - pt);
        if (diff < minDiff) {
          minDiff = diff;
          closest = pt;
          snapped = true;
        }
      }

      // Bắt dính mốc 0.5s
      const gridPt = Math.round(val * 2) / 2;
      const gridDiff = Math.abs(val - gridPt);
      if (gridDiff < minDiff && gridDiff < 0.12) {
        closest = gridPt;
        snapped = true;
      }

      return { time: parseFloat(closest.toFixed(2)), snapped };
    };

    if (clipsEl) {
      clipsEl.addEventListener('pointerdown', (e: PointerEvent) => {
        if (!S.clips.length) return;
        const target = e.target as HTMLElement;

        const seamBtn = target.closest('.trz-seam-btn') as HTMLElement | null;
        if (seamBtn) {
          e.stopPropagation();
          e.preventDefault();
          const clipIdx = +(seamBtn.dataset.clipIdx || '0');
          if (clipIdx > 0 && clipIdx < S.clips.length) {
            openTransitionModal(clipIdx);
          }
          return;
        }

        const handleLeft = target.closest('.clip-handle.left');
        const handleRight = target.closest('.clip-handle.right');
        const clipEl = target.closest('.clip') as HTMLElement | null;

        if (!clipEl) {
          const tlEl = $('#tl');
          if (tlEl) {
            const r = tlEl.getBoundingClientRect();
            seek((e.clientX - r.left) / S.pps);
          }
          return;
        }

        e.stopPropagation();
        e.preventDefault();

        const cid = +(clipEl.dataset.id || 0);
        const cIdx = S.clips.findIndex(c => c.id === cid);
        if (cIdx < 0) return;
        const clip = S.clips[cIdx];

        let accumSec = 0;
        for (let i = 0; i < cIdx; i++) {
          accumSec += S.clips[i].dur;
        }

        preClipState = {
          clips: S.clips.map(c => ({ ...c })),
          audioBlocks: S.audioBlocks.map(b => ({ ...b })),
          selAudioId: S.selAudioId,
          sel: S.sel,
          selLyrId: S.selLyrId,
          lyr: S.lyr.map(item => ({ ...item })),
          lrcText: formatLrcFromLyr(S.lyr),
          fadeIn: A.fadeIn,
          fadeOut: A.fadeOut
        };

        S.sel = clip.id;
        S.selAudioId = null;
        S.selLyrId = null;

        cDragClip = clip;
        cDragIdx = cIdx;
        cStartX = e.clientX;
        cInitDur = clip.dur;
        cInitSrcIn = clip.srcIn;
        cInitSrcOut = clip.srcOut;
        cInitStartSec = accumSec;
        cDragHasMoved = false;
        targetDropIdx = cIdx;

        if (handleLeft) {
          cDragMode = 'left';
        } else if (handleRight) {
          cDragMode = 'right';
        } else {
          cDragMode = 'body';
        }

        clipsEl.setPointerCapture(e.pointerId);
        renderTimeline();
        updateInspector();
      });

      clipsEl.addEventListener('pointermove', (e: PointerEvent) => {
        if (!cDragMode || !cDragClip) return;
        const deltaPx = e.clientX - cStartX;
        if (Math.abs(deltaPx) > 3) cDragHasMoved = true;
        const deltaSec = deltaPx / S.pps;
        const snapPts = getTimelineSnapPoints(cDragClip.id);
        const snapThreshold = 10 / S.pps;

        if (cDragMode === 'right') {
          if (cDragClip.type === 'image') {
            const rawTargetEnd = cInitStartSec + cInitDur + deltaSec;
            const { time: snappedEnd, snapped } = snapTime(rawTargetEnd, snapPts, snapThreshold);
            const newDur = Math.max(0.5, parseFloat((snappedEnd - cInitStartSec).toFixed(2)));
            cDragClip.dur = newDur;

            if (clipTip) {
              clipTip.style.display = 'block';
              clipTip.textContent = `▶ Kéo đuôi: Thời lượng ${cDragClip.dur.toFixed(2)}s${snapped ? ' ⚡ (Dính mốc)' : ''}`;
              const tlScroll = $('#tlScroll');
              const tlRect = tlScroll ? tlScroll.getBoundingClientRect() : { left: 0, width: 600 };
              clipTip.style.left = clamp(e.clientX - tlRect.left - 50, 20, tlRect.width - 240) + 'px';
              clipTip.style.top = '2px';
            }
          } else {
            // Video: kéo mép phải cắt đuôi video gốc
            const rawTargetEnd = cInitStartSec + (cInitSrcOut - cDragClip.srcIn) + deltaSec;
            const { time: snappedEnd, snapped } = snapTime(rawTargetEnd, snapPts, snapThreshold);
            const shiftFromSnap = snappedEnd - (cInitStartSec + (cInitSrcOut - cDragClip.srcIn));
            const targetSrcOut = clamp(cInitSrcOut + (snapped ? shiftFromSnap : deltaSec), cDragClip.srcIn + 0.3, cDragClip.full);
            cDragClip.srcOut = parseFloat(targetSrcOut.toFixed(2));
            cDragClip.dur = parseFloat((cDragClip.srcOut - cDragClip.srcIn).toFixed(2));

            if (clipTip) {
              clipTip.style.display = 'block';
              clipTip.textContent = `▶ Cắt đuôi: ${fmt(cDragClip.srcOut)} / ${fmt(cDragClip.full)} | Dài ${cDragClip.dur.toFixed(2)}s${snapped ? ' ⚡' : ''}`;
              const tlScroll = $('#tlScroll');
              const tlRect = tlScroll ? tlScroll.getBoundingClientRect() : { left: 0, width: 600 };
              clipTip.style.left = clamp(e.clientX - tlRect.left - 50, 20, tlRect.width - 270) + 'px';
              clipTip.style.top = '2px';
            }
          }
          updateInspector();
          renderTimeline();
          draw();
        } else if (cDragMode === 'left') {
          if (cDragClip.type === 'image') {
            // ẢNH: Kéo mép trái rút ngắn từ đầu (deltaSec > 0 rút ngắn dur)
            const rawTargetStart = cInitStartSec + deltaSec;
            const { time: snappedStart, snapped } = snapTime(rawTargetStart, snapPts, snapThreshold);
            const shift = snappedStart - cInitStartSec;
            const newDur = Math.max(0.5, parseFloat((cInitDur - shift).toFixed(2)));
            cDragClip.dur = newDur;

            if (clipTip) {
              clipTip.style.display = 'block';
              clipTip.textContent = `◀ Kéo đầu: Thời lượng ${cDragClip.dur.toFixed(2)}s${snapped ? ' ⚡ (Dính mốc)' : ''}`;
              const tlScroll = $('#tlScroll');
              const tlRect = tlScroll ? tlScroll.getBoundingClientRect() : { left: 0, width: 600 };
              clipTip.style.left = clamp(e.clientX - tlRect.left - 50, 20, tlRect.width - 240) + 'px';
              clipTip.style.top = '2px';
            }
          } else {
            // Video: kéo mép trái cắt đầu video gốc
            const rawTargetStart = cInitStartSec + deltaSec;
            const { time: snappedStart, snapped } = snapTime(rawTargetStart, snapPts, snapThreshold);
            const shift = snappedStart - cInitStartSec;
            const targetSrcIn = clamp(cInitSrcIn + (snapped ? shift : deltaSec), 0, cDragClip.srcOut - 0.3);
            cDragClip.srcIn = parseFloat(targetSrcIn.toFixed(2));
            cDragClip.dur = parseFloat((cDragClip.srcOut - cDragClip.srcIn).toFixed(2));

            if (clipTip) {
              clipTip.style.display = 'block';
              clipTip.textContent = `◀ Cắt đầu: ${fmt(cDragClip.srcIn)} ➔ ${fmt(cDragClip.srcOut)} | Dài ${cDragClip.dur.toFixed(2)}s${snapped ? ' ⚡' : ''}`;
              const tlScroll = $('#tlScroll');
              const tlRect = tlScroll ? tlScroll.getBoundingClientRect() : { left: 0, width: 600 };
              clipTip.style.left = clamp(e.clientX - tlRect.left - 50, 20, tlRect.width - 270) + 'px';
              clipTip.style.top = '2px';
            }
          }
          updateInspector();
          renderTimeline();
          draw();
        } else if (cDragMode === 'body') {
          if (!cDragHasMoved) return;

          const clipEl = clipsEl?.querySelector(`.clip[data-id="${cDragClip.id}"]`);
          if (clipEl) clipEl.classList.add('dragging');

          const tlRect = $('#tl')?.getBoundingClientRect() || { left: 0, width: 1000 };
          const pointerXInTl = e.clientX - tlRect.left;

          let accumPx = 0;
          const boundaries: { idx: number; x: number }[] = [{ idx: 0, x: 0 }];
          S.clips.forEach((c, idx) => {
            accumPx += c.dur * S.pps;
            boundaries.push({ idx: idx + 1, x: accumPx });
          });

          let minDist = Infinity;
          let bestIdx = 0;
          let bestDropX = 0;
          boundaries.forEach(b => {
            const dist = Math.abs(pointerXInTl - b.x);
            if (dist < minDist) {
              minDist = dist;
              bestIdx = b.idx;
              bestDropX = b.x;
            }
          });

          targetDropIdx = bestIdx;

          if (dropIndicator) {
            dropIndicator.style.display = 'block';
            dropIndicator.style.left = bestDropX + 'px';
          }

          if (clipTip) {
            clipTip.style.display = 'block';
            const displayPos = targetDropIdx > cDragIdx ? targetDropIdx : targetDropIdx + 1;
            clipTip.textContent = `↔ Dời thứ tự: Thả vào vị trí thứ ${displayPos} / ${S.clips.length}`;
            const tlScroll = $('#tlScroll');
            const scrollRect = tlScroll ? tlScroll.getBoundingClientRect() : { left: 0, width: 600 };
            clipTip.style.left = clamp(e.clientX - scrollRect.left - 50, 20, scrollRect.width - 240) + 'px';
            clipTip.style.top = '2px';
          }
        }
      });

      const endClipDrag = (e: PointerEvent) => {
        if (!cDragMode) return;

        if (dropIndicator) dropIndicator.style.display = 'none';
        if (clipTip) clipTip.style.display = 'none';

        const clipEl = clipsEl?.querySelector(`.clip[data-id="${cDragClip?.id}"]`);
        if (clipEl) clipEl.classList.remove('dragging');

        if (cDragMode === 'body') {
          if (cDragHasMoved && targetDropIdx >= 0 && cDragClip) {
            const fromIdx = cDragIdx;
            let toIdx = targetDropIdx;
            if (toIdx > fromIdx) toIdx--;

            if (toIdx !== fromIdx && toIdx >= 0 && toIdx < S.clips.length) {
              if (preClipState) {
                tlUndoStack.push(preClipState);
                if (tlUndoStack.length > 50) tlUndoStack.shift();
                tlRedoStack.length = 0;
                updateUndoRedoUI();
              }
              const [moved] = S.clips.splice(fromIdx, 1);
              S.clips.splice(toIdx, 0, moved);
              if (S.clips.length > 0) {
                S.clips[0].tr = 'none';
                for (let j = 1; j < S.clips.length; j++) {
                  const p = S.clips[j - 1], cur = S.clips[j];
                  const maxD = Math.max(0.1, Math.min(3.0, p.dur * 0.5, cur.dur * 0.5));
                  cur.trDur = Math.min(cur.trDur || 1.0, maxD);
                }
              }
              S.sel = moved.id;
              if (S.syncWithMusic) applyMusicSync();
              refreshAll();
              toast(`Đã đổi thứ tự: Clip "${moved.name}" xếp thứ ${toIdx + 1}`);
            }
          } else {
            // Click chọn và dời đầu phát
            if (cDragClip) {
              S.sel = cDragClip.id;
              S.selAudioId = null;
              S.selLyrId = null;
              const tlEl = $('#tl');
              if (tlEl) {
                const r = tlEl.getBoundingClientRect();
                seek((e.clientX - r.left) / S.pps);
              }
              renderTimeline();
              updateInspector();
            }
          }
        } else if (cDragMode === 'left' || cDragMode === 'right') {
          if (cDragHasMoved && preClipState) {
            tlUndoStack.push(preClipState);
            if (tlUndoStack.length > 50) tlUndoStack.shift();
            tlRedoStack.length = 0;
            updateUndoRedoUI();
            if (S.syncWithMusic) applyMusicSync();
            refreshAll();
            toast(`Đã chỉnh độ dài clip: ${cDragClip?.dur.toFixed(2)}s`);
          }
        }

        try { clipsEl?.releasePointerCapture(e.pointerId); } catch (err) {}
        cDragMode = null;
        cDragClip = null;
        cDragIdx = -1;
        preClipState = null;
        cDragHasMoved = false;
        targetDropIdx = -1;
      };

      clipsEl.addEventListener('pointerup', endClipDrag);
      clipsEl.addEventListener('pointercancel', endClipDrag);
    }

    // Tương tác trên track Nhạc (#alane)
    const alaneEl = $('#alane');
    const dragTip = $('#audioDragTip');
    let aDragMode: 'body' | 'left' | 'right' | null = null;
    let aDragBlock: AudioBlock | null = null;
    let aStartX = 0;
    let aInitStart = 0;
    let aInitSrcIn = 0;
    let aInitSrcOut = 0;
    let aDragHasChanged = false;
    let preDragState: TimelineHistoryState | null = null;

    if (alaneEl) {
      alaneEl.addEventListener('pointerdown', (e: PointerEvent) => {
        if (!A.loaded || !S.audioBlocks.length) return;
        const target = e.target as HTMLElement;
        const handleLeft = target.closest('.audio-handle.left');
        const handleRight = target.closest('.audio-handle.right');
        const blockEl = target.closest('.audio-block') as HTMLElement | null;

        if (blockEl) {
          e.stopPropagation();
          e.preventDefault();
          const aid = +(blockEl.dataset.aid || 0);
          const block = S.audioBlocks.find(b => b.id === aid);
          if (!block) return;

          preDragState = {
            clips: S.clips.map(c => ({ ...c })),
            audioBlocks: S.audioBlocks.map(b => ({ ...b })),
            selAudioId: S.selAudioId,
            sel: S.sel,
            selLyrId: S.selLyrId,
            lyr: S.lyr.map(item => ({ ...item })),
            lrcText: ($('#lyr') as HTMLTextAreaElement)?.value || '',
            fadeIn: A.fadeIn,
            fadeOut: A.fadeOut
          };
          aDragHasChanged = false;

          S.selAudioId = block.id;
          S.sel = null;
          S.selLyrId = null;

          aDragBlock = block;
          aStartX = e.clientX;
          aInitStart = block.start;
          aInitSrcIn = block.srcIn;
          aInitSrcOut = block.srcOut;

          if (handleLeft) {
            aDragMode = 'left';
          } else if (handleRight) {
            aDragMode = 'right';
          } else {
            aDragMode = 'body';
          }

          alaneEl.setPointerCapture(e.pointerId);
          renderTimeline();

          if (dragTip) {
            dragTip.style.display = 'block';
            dragTip.textContent = aDragMode === 'left'
              ? `◀ Cắt đầu: ${fmt(block.srcIn)} | Dài: ${block.dur.toFixed(2)}s`
              : aDragMode === 'right'
              ? `▶ Cắt đuôi: ${fmt(block.srcOut)} | Dài: ${block.dur.toFixed(2)}s`
              : `↔ Vị trí: ${fmt(block.start)} ➔ ${fmt(block.start + block.dur)}`;
            const tlScroll = $('#tlScroll');
            const tlRect = tlScroll ? tlScroll.getBoundingClientRect() : { left: 0, width: 600 };
            dragTip.style.left = clamp(e.clientX - tlRect.left, 20, tlRect.width - 150) + 'px';
            dragTip.style.top = '100px';
          }
          return;
        }

        // Click ngoài khối nhạc trên alane: dời đầu phát
        const tlEl = $('#tl');
        if (tlEl) {
          const r = tlEl.getBoundingClientRect();
          seek((e.clientX - r.left) / S.pps);
        }
      });

      alaneEl.addEventListener('pointermove', (e: PointerEvent) => {
        if (!aDragMode || !aDragBlock) return;
        const deltaPx = e.clientX - aStartX;
        if (Math.abs(deltaPx) > 1) aDragHasChanged = true;
        const deltaSec = deltaPx / S.pps;
        const durLimit = A.dur || 999999;
        const minDur = 0.3;

        if (aDragMode === 'left') {
          const newSrcIn = clamp(aInitSrcIn + deltaSec, 0, aInitSrcOut - minDur);
          const actualShift = newSrcIn - aInitSrcIn;
          aDragBlock.srcIn = newSrcIn;
          aDragBlock.start = Math.max(0, aInitStart + actualShift);
          aDragBlock.dur = aDragBlock.srcOut - aDragBlock.srcIn;

          if (dragTip) {
            dragTip.textContent = `◀ Cắt đầu: ${fmt(aDragBlock.srcIn)} | Dài: ${aDragBlock.dur.toFixed(2)}s`;
            const tlScroll = $('#tlScroll');
            const tlRect = tlScroll ? tlScroll.getBoundingClientRect() : { left: 0, width: 600 };
            dragTip.style.left = clamp(e.clientX - tlRect.left, 20, tlRect.width - 150) + 'px';
          }
        } else if (aDragMode === 'right') {
          const newSrcOut = clamp(aInitSrcOut + deltaSec, aInitSrcIn + minDur, durLimit);
          aDragBlock.srcOut = newSrcOut;
          aDragBlock.dur = aDragBlock.srcOut - aDragBlock.srcIn;

          if (dragTip) {
            dragTip.textContent = `▶ Cắt đuôi: ${fmt(aDragBlock.srcOut)} | Dài: ${aDragBlock.dur.toFixed(2)}s`;
            const tlScroll = $('#tlScroll');
            const tlRect = tlScroll ? tlScroll.getBoundingClientRect() : { left: 0, width: 600 };
            dragTip.style.left = clamp(e.clientX - tlRect.left, 20, tlRect.width - 150) + 'px';
          }
        } else if (aDragMode === 'body') {
          aDragBlock.start = Math.max(0, parseFloat((aInitStart + deltaSec).toFixed(2)));

          if (dragTip) {
            dragTip.textContent = `↔ Vị trí: ${fmt(aDragBlock.start)} ➔ ${fmt(aDragBlock.start + aDragBlock.dur)}`;
            const tlScroll = $('#tlScroll');
            const tlRect = tlScroll ? tlScroll.getBoundingClientRect() : { left: 0, width: 600 };
            dragTip.style.left = clamp(e.clientX - tlRect.left, 20, tlRect.width - 180) + 'px';
          }
        }

        renderTimeline();
      });

      const endAudioDrag = (e: PointerEvent) => {
        if (aDragMode) {
          if (aDragHasChanged && preDragState) {
            tlUndoStack.push(preDragState);
            if (tlUndoStack.length > 50) tlUndoStack.shift();
            tlRedoStack.length = 0;
            updateUndoRedoUI();
          }
          aDragMode = null;
          aDragBlock = null;
          preDragState = null;
          aDragHasChanged = false;
          try { alaneEl.releasePointerCapture(e.pointerId); } catch (err) {}
          if (dragTip) dragTip.style.display = 'none';
          autoFitImagesToMusic();
          refreshAll();
        }
      };
      alaneEl.addEventListener('pointerup', endAudioDrag);
      alaneEl.addEventListener('pointercancel', endAudioDrag);
    }

    // Tương tác trên track Lyric (#llane)
    const llaneEl = $('#llane');
    let lyrDragMode: 'body' | 'left' | 'right' | null = null;
    let lyrDragItem: LyricItem | null = null;
    let lyrStartX = 0;
    let lyrInitT = 0;
    let lyrInitEndT = 0;

    if (llaneEl) {
      llaneEl.addEventListener('pointerdown', (e: PointerEvent) => {
        const target = e.target as HTMLElement;
        const blockEl = target.closest('.lyr-block') as HTMLElement | null;
        if (!blockEl) return;

        e.stopPropagation();
        e.preventDefault();

        const lid = +(blockEl.dataset.lid || 0);
        const ly = S.lyr.find(l => l.id === lid);
        if (!ly) return;

        selectLyrBlock(ly.id);
        seek(ly.t);

        const handleLeft = target.closest('.lyr-handle.left');
        const handleRight = target.closest('.lyr-handle.right');

        lyrDragItem = ly;
        lyrStartX = e.clientX;
        lyrInitT = ly.t;
        lyrInitEndT = ly.endT || (ly.t + 3);

        if (handleLeft) lyrDragMode = 'left';
        else if (handleRight) lyrDragMode = 'right';
        else lyrDragMode = 'body';

        llaneEl.setPointerCapture(e.pointerId);
      });

      llaneEl.addEventListener('pointermove', (e: PointerEvent) => {
        if (!lyrDragMode || !lyrDragItem) return;
        const deltaPx = e.clientX - lyrStartX;
        const step = e.shiftKey ? 0.01 : 0.05;
        let deltaSec = deltaPx / S.pps;
        deltaSec = Math.round(deltaSec / step) * step;

        if (lyrDragMode === 'left') {
          const newT = Math.max(0, Math.min(lyrInitT + deltaSec, (lyrDragItem.endT || 999) - 0.2));
          lyrDragItem.t = parseFloat(newT.toFixed(2));
        } else if (lyrDragMode === 'right') {
          const newEnd = Math.max(lyrDragItem.t + 0.2, lyrInitEndT + deltaSec);
          lyrDragItem.endT = parseFloat(newEnd.toFixed(2));
        } else if (lyrDragMode === 'body') {
          const dur = (lyrDragItem.endT || (lyrDragItem.t + 3)) - lyrDragItem.t;
          const newT = Math.max(0, lyrInitT + deltaSec);
          lyrDragItem.t = parseFloat(newT.toFixed(2));
          lyrDragItem.endT = parseFloat((newT + dur).toFixed(2));
        }
        renderTimeline();
        draw();
      });

      const endLyrDrag = (e: PointerEvent) => {
        if (lyrDragMode) {
          lyrDragMode = null;
          lyrDragItem = null;
          try { llaneEl.releasePointerCapture(e.pointerId); } catch (err) {}
          syncLyrToEditor(true);
        }
      };
      llaneEl.addEventListener('pointerup', endLyrDrag);
      llaneEl.addEventListener('pointercancel', endLyrDrag);

      llaneEl.addEventListener('dblclick', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const blockEl = target.closest('.lyr-block') as HTMLElement | null;
        if (!blockEl) return;
        const lid = +(blockEl.dataset.lid || 0);
        const ly = S.lyr.find(l => l.id === lid);
        if (ly) {
          showLyrInlineEditor(ly, blockEl);
        }
      });
    }

    // Lyric toolbar buttons
    safeClick('#btnTbAddLyr', addLyricAtPlayhead);
    safeClick('#btnTbSplitLyr', splitLyricAtPlayhead);
    safeClick('#btnTbMergeNext', mergeLyricWithNext);
    safeClick('#btnTbDelLyr', deleteLyricLine);
    safeClick('#btnTbDeselect', () => selectLyrBlock(null));
    safeChange('#lyrTbStart', (e: any) => {
      const ly = selLyr();
      if (ly) {
        ly.t = Math.max(0, parseFloat(e.target.value) || 0);
        syncLyrToEditor(true);
      }
    });
    safeChange('#lyrTbEnd', (e: any) => {
      const ly = selLyr();
      if (ly) {
        ly.endT = Math.max(ly.t + 0.1, parseFloat(e.target.value) || (ly.t + 1));
        syncLyrToEditor(true);
      }
    });

    // chỉnh clip
    const num = (id: string, fn: (c: Clip, v: number) => void) => {
      const el = $(id);
      if (el) {
        el.addEventListener('change', (e: any) => {
          const c = selClip();
          if (!c) return;
          fn(c, parseFloat(e.target.value));
          refreshAll();
        });
      }
    };
    num('#iDur', (c, v) => {
      if (c.type === 'image' && v > 0) {
        pushTimelineHistory();
        c.dur = clamp(v, 0.5, 600);
        if (S.syncWithMusic) applyMusicSync();
      }
    });
    num('#iIn', (c, v) => {
      if (c.type === 'video' && v >= 0) {
        pushTimelineHistory();
        c.srcIn = clamp(v, 0, c.srcOut - 0.3);
        c.dur = c.srcOut - c.srcIn;
        if (S.syncWithMusic) applyMusicSync();
      }
    });
    num('#iOut', (c, v) => {
      if (c.type === 'video' && v > 0) {
        pushTimelineHistory();
        c.srcOut = clamp(v, c.srcIn + 0.3, c.full);
        c.dur = c.srcOut - c.srcIn;
        if (S.syncWithMusic) applyMusicSync();
      }
    });
    num('#iTrD', (c, v) => {
      pushTimelineHistory();
      const cIdx = S.clips.findIndex(x => x.id === c.id);
      const prev = cIdx > 0 ? S.clips[cIdx - 1] : null;
      const maxD = Math.max(0.1, Math.min(3.0, prev ? prev.dur * 0.5 : 3.0, c.dur * 0.5));
      c.trDur = clamp(v || 0.6, 0.1, maxD);
      renderTimeline();
      draw();
    });

    [['#iFit', 'fit'], ['#iFx', 'fx'], ['#iTr', 'tr'], ['#iCol', 'color']].forEach(([id, k]) => {
      const el = $(id);
      if (el) {
        el.addEventListener('change', (e: any) => {
          const c: any = selClip();
          if (c) {
            pushTimelineHistory();
            c[k] = e.target.value;
            refreshAll();
          }
        });
      }
    });

    safeClick('#iL', () => {
      pushTimelineHistory();
      moveClip(-1);
      if (S.syncWithMusic) applyMusicSync();
    });
    safeClick('#iR', () => {
      pushTimelineHistory();
      moveClip(1);
      if (S.syncWithMusic) applyMusicSync();
    });
    safeClick('#iDel', deleteSelected);
    safeClick('#iDup', () => {
      const i = S.clips.findIndex(c => c.id === S.sel);
      if (i < 0) return;
      pushTimelineHistory();
      const n = cloneClip(S.clips[i]);
      n.name = n.name + ' (bản sao)';
      S.clips.splice(i + 1, 0, n);
      S.sel = n.id;
      if (S.syncWithMusic) applyMusicSync();
      refreshAll();
      toast('Đã nhân bản clip: ' + n.name);
    });
    safeClick('#tSplit', splitClipAtPlayhead);

    // xuất
    safeClick('#btnExport', exportVideo);
    safeClick('#expSave', saveExport);
    safeClick('#expClose', closeExport);
    window.addEventListener('resize', onResize);
  }

  // Khởi động
  bind();
  loadSample();
  renderMediaDrawerCards();
  setSize();
  setVolume(A.vol);
  const tlFadeIn = $('#tlFadeIn') as HTMLSelectElement | null;
  if (tlFadeIn) tlFadeIn.value = String(A.fadeIn);
  const tlFadeOut = $('#tlFadeOut') as HTMLSelectElement | null;
  if (tlFadeOut) tlFadeOut.value = String(A.fadeOut);
  updateUndoRedoUI();
  renderWaveformEditor();
  renderLyricUI();
  renderTimeline();
  draw();
  updateAudioStatus();
  document.fonts.ready.then(() => { loadFonts().then(draw); });

  // Cleanup for unmount
  return () => {
    halt();
    stopTransitionPreview();
    if (A.isPreviewing) stopPreview();
    if (A.isTrimPreviewing) stopTrimPreview();
    if (S.viz.logoUrl) URL.revokeObjectURL(S.viz.logoUrl);
    cancelAnimationFrame(vuRaf);
    document.removeEventListener('dragover', onDragOver);
    document.removeEventListener('dragleave', onDragLeave);
    document.removeEventListener('drop', onDrop);
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', onResize);
    clearTimeout(toastTimer);
    clearTimeout(fsIdleTimer);
  };
}
