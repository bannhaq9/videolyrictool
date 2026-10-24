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
  const TR: Record<string, string> = { fade: 'Mờ dần', slide: 'Trượt', zoom: 'Phóng to', none: 'Cắt thẳng' };
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

  const S = {
    orient: 'v',
    res: 720,
    clips: [] as Clip[],
    sel: null as number | null,
    selLyrId: null as number | null,
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
    def: { dur: 4, fit: 'cover', fx: 'zoomin', tr: 'fade' },
    syncWithMusic: false,
    syncMusicMode: 'even' as 'even' | 'extendLast',
    speed: 1.0,
    viz: {
      type: 'bars' as 'none' | 'bars' | 'mirror' | 'circle' | 'wave',
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
    fadeOut: 1.5,
    wfZoom: 1,
    fade: true,
    ctx: null as AudioContext | null,
    gain: null as GainNode | null,
    analyser: null as AnalyserNode | null,
    dest: null as MediaStreamAudioDestinationNode | null,
    srcNode: null as MediaElementAudioSourceNode | null,
    url: '',
    file: null as File | null,
    loadState: 'Chưa tải',
    error: '',
    isPreviewing: false,
    isTrimPreviewing: false,
    rawPeaks: [] as number[],
    buffer: null as AudioBuffer | null
  };
  A.el.preload = 'auto';
  A.el.crossOrigin = 'anonymous';
  A.el.preservesPitch = true;
  (A.el as any).webkitPreservesPitch = true;
  (A.el as any).mozPreservesPitch = true;

  let uid = 0, lyrUid = 0, raf = 0, t0 = 0, tbase = 0, endCb: (() => Promise<void> | void) | null = null,
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
    const aw = Math.max(200, st.clientWidth - 24);
    const mh = Math.max(240, Math.min(window.innerHeight * 0.62, 640));
    const sc = Math.min(aw / cv.width, mh / cv.height);
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
      trDur: 0.6,
      color: 'none',
      thumb: '',
      sample: false
    }, o) as Clip;
  }
  const musicDuration = () => {
    if (!A.loaded || A.dur <= 0) return 0;
    const end = A.end > A.start ? A.end : A.dur;
    return Math.max(0, end - A.start);
  };

  const total = () => {
    if (S.syncWithMusic && A.loaded && musicDuration() > 0) {
      return Math.max(0.5, musicDuration());
    }
    return S.clips.reduce((a, c) => a + c.dur, 0);
  };

  function applyMusicSync(showToast = false) {
    if (!S.syncWithMusic) return;
    const mDur = musicDuration();
    if (!A.loaded || mDur <= 0) {
      if (showToast) toast('Chưa có nhạc hoặc đoạn chọn không hợp lệ. Hãy chọn file nhạc trước.');
      return;
    }
    const targetTotal = Math.max(0.5, mDur);
    if (!S.clips.length) return;

    const imgs = S.clips.filter(c => c.type === 'image');
    if (!imgs.length) {
      if (showToast) toast('Không có ảnh nào để căn theo độ dài bài hát.');
      return;
    }

    const vids = S.clips.filter(c => c.type === 'video');
    const vidsDur = vids.reduce((a, c) => a + c.dur, 0);

    if (S.syncMusicMode === 'even') {
      const rem = targetTotal - vidsDur;
      if (rem <= 0) {
        if (showToast) toast('Đoạn nhạc chọn ngắn hơn tổng các đoạn video đã có.');
        return;
      }
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
      if (showToast) toast('Ảnh đã được tự chia đều theo đoạn nhạc đã chọn (' + fmt(targetTotal) + ').');
    } else {
      // 'extendLast': Ảnh cuối kéo dài cho tới hết đoạn nhạc
      const lastImg = [...S.clips].reverse().find(c => c.type === 'image');
      if (lastImg) {
        const otherDur = S.clips.filter(c => c !== lastImg).reduce((a, c) => a + c.dur, 0);
        const lastDur = Math.max(0.3, Math.round((targetTotal - otherDur) * 100) / 100);
        lastImg.dur = lastDur;
        if (showToast) toast('Ảnh cuối (' + lastImg.name + ') đã kéo dài cho tới hết đoạn nhạc (' + fmt(targetTotal) + ').');
      }
    }
    refreshAll();
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
    if ($('#lyr').value.trim() === SAMPLE_LYR) {
      $('#lyr').value = '';
      S.lyr = [];
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
    if (S.syncWithMusic) applyMusicSync();
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
        name: 'Ảnh mẫu ' + (i + 1),
        el,
        dur: 3,
        sample: true,
        fx: ['zoomin', 'panl', 'zoomout', 'panr'][i],
        tr: i ? 'fade' : 'none'
      });
      c.thumb = thumbFrom(el);
      S.clips.push(c);
    });
    S.sel = S.clips[0].id;
    $('#lyr').value = SAMPLE_LYR;
    S.lyr = parseLyr(SAMPLE_LYR);
  }

  /* ---------- vẽ khung hình ---------- */
  const bgc = document.createElement('canvas'), bgx = bgc.getContext('2d')!;
  function srcSize(el: any) {
    return { w: el.videoWidth || el.naturalWidth || el.width || 1, h: el.videoHeight || el.naturalHeight || el.height || 1 };
  }
  function drawMedia(c: Clip, local: number, o: { zoom?: number; alpha?: number; dx?: number }) {
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
    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.translate(W / 2 + (o.dx || 0) + px * W, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    if (c.color !== 'none' && 'filter' in ctx) (ctx as any).filter = FILTERS[c.color];
    try {
      if (c.fit === 'contain') {
        bgc.width = W > H ? 64 : 36;
        bgc.height = W > H ? 36 : 64;
        const s0 = Math.max(bgc.width / w, bgc.height / h);
        bgx.drawImage(el, (bgc.width - w * s0) / 2, (bgc.height - h * s0) / 2, w * s0, h * s0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bgc, 0, 0, W, H);
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.fillRect(0, 0, W, H);
        const s = Math.min(W / w, H / h);
        ctx.drawImage(el, (W - w * s) / 2, (H - h * s) / 2, w * s, h * s);
      } else {
        const s = Math.max(W / w, H / h);
        ctx.drawImage(el, (W - w * s) / 2, (H - h * s) / 2, w * s, h * s);
      }
    } catch (e) {}
    ctx.restore();
  }
  function renderFrame(t: number) {
    const W = cv.width, H = cv.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const L = locate(t);
    if (L) {
      const c = S.clips[L.i], prev = S.clips[L.i - 1];
      const trd = prev ? Math.min(c.trDur, prev.dur, c.dur) : 0;
      if (prev && c.tr !== 'none' && L.local < trd) {
        const k = ease(L.local / trd);
        if (c.tr === 'fade') { drawMedia(prev, prev.dur, {}); drawMedia(c, L.local, { alpha: k }); }
        else if (c.tr === 'slide') { drawMedia(prev, prev.dur, { dx: -W * k }); drawMedia(c, L.local, { dx: W * (1 - k) }); }
        else { drawMedia(prev, prev.dur, {}); drawMedia(c, L.local, { alpha: k, zoom: 1.35 - 0.35 * k }); }
      } else drawMedia(c, L.local, {});
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

    if (st.next && nxt && nxt.text && nxt.t - t < 7) {
      const f2 = fs * 0.62;
      drawText(nxt.text, yc + th / 2 + f2 * 1.1, f2, null, 0.78 * a, { color: nxt.color, hi: nxt.hi });
    }
  }
  function drawTitle(t: number) {
    const ti = S.title;
    if (!ti.text || t >= ti.dur) return;
    const a = Math.min(clamp(t / 0.3, 0, 1), clamp((ti.dur - t) / 0.4, 0, 1));
    const fs = S.style.size / 100 * Math.min(cv.width, cv.height) * 1.45;
    drawText(ti.text, cv.height * 0.2, fs, null, a);
  }

  /* ---------- hiệu ứng sóng nhạc ---------- */
  function drawVisualizer(t: number) {
    const vz = S.viz;
    if (!vz || vz.type === 'none') return;
    const W = cv.width, H = cv.height;

    // Lấy dữ liệu phân tích từ AnalyserNode hoặc mô phỏng nhịp khi tạm dừng
    const isLive = (S.playing || exporting) && !!A.analyser && !A.el.paused;
    const binCount = A.analyser ? A.analyser.frequencyBinCount : 128;
    const freqData = new Uint8Array(binCount);
    const timeData = new Uint8Array(binCount);

    if (isLive && A.analyser) {
      A.analyser.getByteFrequencyData(freqData);
      A.analyser.getByteTimeDomainData(timeData);
    } else {
      // Sóng xem trước trực quan khi đang tạm dừng / tua
      for (let i = 0; i < binCount; i++) {
        const p = i / binCount;
        const bassWave = Math.sin(t * 3.5) * 0.25 + 0.75;
        const wave = Math.sin(i * 0.18 + t * 4) * 0.3 + 0.7;
        const decay = Math.pow(Math.max(0.01, 1 - p), 0.75);
        freqData[i] = Math.min(255, Math.floor(190 * decay * wave * bassWave));
        timeData[i] = Math.floor(128 + Math.sin(i * 0.12 + t * 5) * 40 * Math.sin(p * Math.PI));
      }
    }

    ctx.save();

    // Hiệu ứng phát sáng Neon
    if (vz.glow) {
      ctx.shadowColor = vz.color;
      ctx.shadowBlur = Math.round(15 * vz.size);
    }

    // Hàm tạo màu (đơn sắc, gradient, hoặc cầu vồng)
    const getColor = (prog: number, x1: number, y1: number, x2: number, y2: number) => {
      if (vz.colorMode === 'solid') return vz.color;
      if (vz.colorMode === 'rainbow') {
        const hue = Math.round(((prog * 360) + (t * 50)) % 360);
        return 'hsl(' + hue + ', 95%, 60%)';
      }
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, vz.color);
      grad.addColorStop(1, vz.color2);
      return grad;
    };

    const cx = W * (vz.x / 100);
    const cy = H * (vz.y / 100);

    if (vz.type === 'bars' || vz.type === 'mirror') {
      const numBars = clamp(vz.bars || 32, 16, 64);
      const totalW = Math.min(W * 0.94, W * 0.82 * vz.size);
      const startX = cx - totalW / 2;
      const barSlot = totalW / numBars;
      const barW = Math.max(3, barSlot * 0.72);
      const maxH = H * 0.24 * vz.size;
      const isMirror = vz.type === 'mirror';

      for (let i = 0; i < numBars; i++) {
        // Phân bổ tần số: tập trung nhiều dải bass & mid
        const freqIdx = Math.floor(Math.pow(i / numBars, 1.32) * (binCount * 0.65));
        const rawVal = freqData[Math.min(binCount - 1, freqIdx)] || 0;
        const normalized = (rawVal / 255) * vz.sens;
        const barH = Math.max(isMirror ? 6 : 4, normalized * maxH);

        const bx = startX + i * barSlot + (barSlot - barW) / 2;
        const prog = i / (numBars - 1 || 1);

        if (isMirror) {
          // Equalizer đối xứng trên/dưới baseline
          const by = cy - barH / 2;
          ctx.fillStyle = getColor(prog, bx, cy - maxH / 2, bx, cy + maxH / 2);
          ctx.beginPath();
          if ((ctx as any).roundRect) {
            (ctx as any).roundRect(bx, by, barW, barH, barW / 2);
          } else {
            ctx.rect(bx, by, barW, barH);
          }
          ctx.fill();
        } else {
          // Equalizer cột đứng từ baseline hướng lên
          const by = cy - barH;
          ctx.fillStyle = getColor(prog, bx, cy - maxH, bx, cy);
          ctx.beginPath();
          if ((ctx as any).roundRect) {
            (ctx as any).roundRect(bx, by, barW, barH, [barW / 2, barW / 2, 0, 0]);
          } else {
            ctx.rect(bx, by, barW, barH);
          }
          ctx.fill();

          // Phản xạ mờ nhẹ dưới chân cột
          ctx.save();
          ctx.globalAlpha = 0.24;
          ctx.fillStyle = vz.color;
          ctx.fillRect(bx, cy + 2, barW, Math.min(barH * 0.35, 24));
          ctx.restore();
        }
      }

      // Vạch đường chân (baseline) cho cột đứng
      if (!isMirror) {
        ctx.strokeStyle = vz.color;
        ctx.lineWidth = Math.max(2, 2.5 * vz.size);
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(startX - 8, cy);
        ctx.lineTo(startX + totalW + 8, cy);
        ctx.stroke();
      }
    } else if (vz.type === 'circle') {
      // Sóng tròn tỏa đều 360 độ quanh logo
      let bassSum = 0;
      const bassBins = Math.min(8, binCount);
      for (let b = 0; b < bassBins; b++) bassSum += freqData[b];
      const bassAvg = (bassSum / (bassBins * 255)) * vz.sens;

      const baseR = Math.min(W, H) * 0.16 * vz.size;
      const pulseR = baseR * (1 + bassAvg * 0.09);
      const numPins = clamp((vz.bars || 32) * 2, 36, 72);
      const pinMaxLen = baseR * 0.78 * vz.sens;

      // Các tia sóng phổ tần tỏa tròn
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

      // Vòng tròn viền phát sáng quanh tâm
      ctx.beginPath();
      ctx.arc(cx, cy, pulseR + 4, 0, Math.PI * 2);
      ctx.strokeStyle = vz.color;
      ctx.lineWidth = Math.max(2, 3 * vz.size);
      ctx.stroke();

      // Logo hoặc Đĩa than ở tâm
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.clip();

      if (vz.logoImg && vz.logoImg.complete && vz.logoImg.naturalWidth > 0) {
        // Ảnh logo người dùng tải lên
        const img = vz.logoImg;
        const scale = Math.max((pulseR * 2) / img.naturalWidth, (pulseR * 2) / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
      } else {
        // Đĩa than vinyl thời thượng mặc định
        ctx.fillStyle = '#0f1418';
        ctx.fillRect(cx - pulseR, cy - pulseR, pulseR * 2, pulseR * 2);

        // Các vòng rãnh đĩa vinyl tinh tế
        ctx.strokeStyle = 'rgba(255,255,255,0.09)';
        ctx.lineWidth = 1;
        for (let r = pulseR * 0.35; r < pulseR * 0.95; r += 7 * vz.size) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Nhãn tâm đĩa than
        const labelR = pulseR * 0.42;
        const labelGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, labelR);
        labelGrad.addColorStop(0, vz.color2);
        labelGrad.addColorStop(1, vz.color);
        ctx.fillStyle = labelGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, labelR, 0, Math.PI * 2);
        ctx.fill();

        // Lỗ trục giữa đĩa
        ctx.fillStyle = '#0a0d0f';
        ctx.beginPath();
        ctx.arc(cx, cy, pulseR * 0.08, 0, Math.PI * 2);
        ctx.fill();

        // Biểu tượng nốt nhạc vàng óng / trắng neon
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold ' + Math.round(labelR * 0.7) + 'px "Be Vietnam Pro",sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♫', cx, cy);
      }
      ctx.restore();

      // Viền sáng mỏng bảo vệ mép logo
      ctx.beginPath();
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

    } else if (vz.type === 'wave') {
      // Vạch sóng âm chạy ngang (Oscilloscope / Waveform)
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

      // Vùng phủ mờ gradient dưới sóng
      const gradFill = ctx.createLinearGradient(0, cy - maxAmp, 0, cy + maxAmp);
      gradFill.addColorStop(0, vz.color);
      gradFill.addColorStop(1, 'transparent');

      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = gradFill;
      ctx.beginPath();
      ctx.moveTo(points[0].x, cy);
      for (let i = 0; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.lineTo(points[points.length - 1].x, cy);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Đường cong sóng uốn lượn mượt mà
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

  /* ---------- lyric ---------- */
  const TAGRE = /^\s*\[(\d+):(\d{1,2}(?:[.,]\d+)?)\](?:<(\d+):(\d{1,2}(?:[.,]\d+)?)>)?/;
  const STYLE_RE = /\s*\{(?:c=([^}\s]+))?(?:\s*h=([^}\s]+))?(?:\s*s=([\d.]+))?\}\s*$/;

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

  /* History undo/redo */
  interface LyricHistoryState {
    lyr: LyricItem[];
    selLyrId: number | null;
    lrcText: string;
  }
  const lyrUndoStack: LyricHistoryState[] = [];
  const lyrRedoStack: LyricHistoryState[] = [];

  function pushLyricHistory() {
    const state: LyricHistoryState = {
      lyr: S.lyr.map(item => ({ ...item })),
      selLyrId: S.selLyrId,
      lrcText: ($('#lyr') as HTMLTextAreaElement)?.value || ''
    };
    lyrUndoStack.push(state);
    if (lyrUndoStack.length > 60) lyrUndoStack.shift();
    lyrRedoStack.length = 0;
  }

  function undoLyric() {
    if (!lyrUndoStack.length) return toast('Không còn thao tác để hoàn tác.');
    const current: LyricHistoryState = {
      lyr: S.lyr.map(item => ({ ...item })),
      selLyrId: S.selLyrId,
      lrcText: ($('#lyr') as HTMLTextAreaElement)?.value || ''
    };
    lyrRedoStack.push(current);
    const prev = lyrUndoStack.pop()!;
    S.lyr = prev.lyr.map(item => ({ ...item }));
    S.selLyrId = prev.selLyrId;
    if ($('#lyr')) ($('#lyr') as HTMLTextAreaElement).value = prev.lrcText;
    renderTimeline();
    renderLyricWaveform();
    updateLyricEditorUI();
    updateInspector();
    draw();
    toast('Đã hoàn tác (Ctrl+Z)');
  }

  function redoLyric() {
    if (!lyrRedoStack.length) return toast('Không có thao tác để làm lại.');
    const current: LyricHistoryState = {
      lyr: S.lyr.map(item => ({ ...item })),
      selLyrId: S.selLyrId,
      lrcText: ($('#lyr') as HTMLTextAreaElement)?.value || ''
    };
    lyrUndoStack.push(current);
    const next = lyrRedoStack.pop()!;
    S.lyr = next.lyr.map(item => ({ ...item }));
    S.selLyrId = next.selLyrId;
    if ($('#lyr')) ($('#lyr') as HTMLTextAreaElement).value = next.lrcText;
    renderTimeline();
    renderLyricWaveform();
    updateLyricEditorUI();
    updateInspector();
    draw();
    toast('Đã làm lại (Ctrl+Y)');
  }

  function syncLyrToEditor(pushHistory = true) {
    if (pushHistory) pushLyricHistory();
    const lrc = formatLrcFromLyr(S.lyr);
    const lyrEl = $('#lyr') as HTMLTextAreaElement | null;
    if (lyrEl) lyrEl.value = lrc;
    renderLyricWaveform();
    updateLyricEditorUI();
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
      S.sel = null; // Unselect clip so clip inspector is replaced
      const ly = S.lyr.find(l => l.id === id);
      if (ly) {
        const rows = getLyricRows();
        const rIdx = rows.findIndex(r => r.time != null && Math.abs(r.time - ly.t) < 0.05);
        if (rIdx >= 0) lyrSelIdx = rIdx;
      }
    }
    renderTimeline();
    updateInspector();
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
    const next = S.lyr[idx + 1];
    if (!next) return toast('Đây là câu cuối cùng, không có câu sau để gộp.');
    pushLyricHistory();
    cur.text = (cur.text + ' ' + next.text).trim();
    cur.endT = Math.max(cur.endT, next.endT);
    S.lyr.splice(idx + 1, 1);
    syncLyrToEditor(false);
    toast('Đã gộp với câu sau');
  }

  function deleteLyricLine() {
    const cur = selLyr();
    if (!cur) return toast('Hãy chọn một câu trên timeline để xóa.');
    pushLyricHistory();
    const idx = S.lyr.findIndex(l => l.id === cur.id);
    S.lyr.splice(idx, 1);
    S.selLyrId = S.lyr[Math.min(idx, S.lyr.length - 1)]?.id || null;
    syncLyrToEditor(false);
    toast('Đã xóa câu');
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
  function rawLines() {
    return $('#lyr').value.split(/\r?\n/)
      .map((l: string) => l.replace(/^\s*(\[\d+:\d{1,2}(?:[.,]\d+)?\]\s*)+/, '').trim())
      .filter((l: string) => l && !/^\[[A-Za-z#]+:.*\]$/.test(l));
  }
  let lyrSelIdx = 0;

  interface LyrRow {
    lineIndex: number;
    time: number | null;
    text: string;
  }

  function getLyricRows(): LyrRow[] {
    const el = $('#lyr') as HTMLTextAreaElement | null;
    if (!el) return [];
    const lines = el.value.split(/\r?\n/);
    const rows: LyrRow[] = [];
    lines.forEach((l, i) => {
      const trimmed = l.trim();
      if (!trimmed || /^\[[A-Za-z#]+:.*\]$/.test(trimmed)) return;
      const m = TAGRE.exec(trimmed);
      let time: number | null = null;
      let text = trimmed;
      if (m) {
        time = +m[1] * 60 + parseFloat(m[2].replace(',', '.'));
        text = trimmed.slice(m[0].length).trim();
      }
      rows.push({ lineIndex: i, time, text });
    });
    return rows;
  }

  function updateLyricEditorUI() {
    const rows = getLyricRows();
    if (!rows.length) {
      const badge = $('#lyrSelBadge'); if (badge) badge.textContent = 'Câu 0/0';
      const timeLbl = $('#lyrSelTime'); if (timeLbl) timeLbl.textContent = '--:--.--';
      const textEl = $('#lyrSelText'); if (textEl) textEl.textContent = '(Chưa có lời bài hát. Hãy dán lời vào ô bên dưới)';
      return;
    }
    lyrSelIdx = clamp(lyrSelIdx, 0, rows.length - 1);
    const cur = rows[lyrSelIdx];
    const badge = $('#lyrSelBadge');
    if (badge) badge.textContent = 'Câu ' + (lyrSelIdx + 1) + '/' + rows.length;
    const timeLbl = $('#lyrSelTime');
    if (timeLbl) timeLbl.textContent = cur.time != null ? fmt(cur.time) : 'Chưa có mốc';
    const textEl = $('#lyrSelText');
    if (textEl) textEl.textContent = cur.text || '(Dòng trống)';
  }

  function selectLyricLine(idx: number) {
    const rows = getLyricRows();
    if (!rows.length) return;
    lyrSelIdx = clamp(idx, 0, rows.length - 1);
    updateLyricEditorUI();
    renderLyricWaveform();
  }

  function renderLyricWaveform() {
    const cvEl = $('#lyrWfCv') as HTMLCanvasElement | null;
    const trackEl = $('#lyrWfTrack');
    if (!cvEl || !trackEl) return;
    const width = trackEl.clientWidth || 360;
    const height = 80;
    cvEl.width = width;
    cvEl.height = height;
    cvEl.style.width = width + 'px';

    const ctxW = cvEl.getContext('2d')!;
    ctxW.clearRect(0, 0, width, height);

    const dur = Math.max(total(), A.dur || 1);

    // Nền & Baseline
    ctxW.fillStyle = '#151f22';
    ctxW.fillRect(0, 0, width, height);
    ctxW.fillStyle = 'rgba(255,255,255,0.08)';
    ctxW.fillRect(0, 48, width, 1);

    // Thước đo thời gian trên sóng lyric
    const rulerEl = $('#lyrWfRuler');
    if (rulerEl) {
      let rHtml = '';
      const step = dur > 180 ? 20 : dur > 90 ? 15 : dur > 40 ? 10 : 5;
      for (let s = 0; s <= dur; s += step) {
        const x = (s / dur) * width;
        rHtml += '<span style="position:absolute;left:' + x + 'px;font-size:9px;font-family:var(--font-mono);color:var(--muted)">' + fmt(s) + '</span>';
      }
      rulerEl.innerHTML = rHtml;
    }

    // Sóng âm bài hát
    const peaks = A.rawPeaks.length ? A.rawPeaks : A.peaks;
    if (peaks.length) {
      const pps = width / peaks.length;
      ctxW.fillStyle = '#475569';
      for (let i = 0; i < peaks.length; i++) {
        const x = i * pps;
        const pk = peaks[i];
        const h = Math.max(2, pk * 55);
        ctxW.fillRect(x, 48 - h / 2, Math.max(1, pps - 0.5), h);
      }
    }

    // Các vạch mốc lời bài hát (Lyric Markers)
    const rows = getLyricRows();
    rows.forEach((r, idx) => {
      if (r.time == null) return;
      const x = (r.time / dur) * width;
      const isSel = idx === lyrSelIdx;

      ctxW.save();
      if (isSel) {
        // Vạch câu đang chọn nổi bật (vàng neon phát sáng)
        ctxW.shadowColor = '#ffd23f';
        ctxW.shadowBlur = 8;
        ctxW.strokeStyle = '#ffd23f';
        ctxW.lineWidth = 2.5;
        ctxW.beginPath();
        ctxW.moveTo(x, 16);
        ctxW.lineTo(x, height);
        ctxW.stroke();

        // Cờ đánh dấu câu đang chọn ở trên đỉnh
        ctxW.fillStyle = '#ffd23f';
        ctxW.beginPath();
        if ((ctxW as any).roundRect) {
          (ctxW as any).roundRect(Math.max(2, x - 14), 1, 28, 14, 3);
        } else {
          ctxW.rect(Math.max(2, x - 14), 1, 28, 14);
        }
        ctxW.fill();

        ctxW.fillStyle = '#0f1418';
        ctxW.font = 'bold 9px var(--font-mono)';
        ctxW.textAlign = 'center';
        ctxW.textBaseline = 'middle';
        ctxW.fillText('#' + (idx + 1), Math.max(2, x - 14) + 14, 8);
      } else {
        // Vạch các câu khác (cyan / teal dịu mắt)
        ctxW.strokeStyle = 'rgba(45, 212, 191, 0.7)';
        ctxW.lineWidth = 1.5;
        ctxW.beginPath();
        ctxW.moveTo(x, 18);
        ctxW.lineTo(x, height);
        ctxW.stroke();

        // Chấm số thứ tự câu
        ctxW.fillStyle = 'rgba(45, 212, 191, 0.85)';
        ctxW.beginPath();
        ctxW.arc(x, 14, 3, 0, Math.PI * 2);
        ctxW.fill();
      }
      ctxW.restore();
    });

    // Cập nhật vị trí playhead
    const lyrPlayhead = $('#lyrWfPlayhead');
    if (lyrPlayhead) {
      lyrPlayhead.style.left = clamp((S.t / dur) * 100, 0, 100) + '%';
    }
  }

  function setLyrText(txt: string) {
    $('#lyr').value = txt;
    S.lyr = parseLyr(txt);
    renderTimeline();
    renderLyricWaveform();
    updateLyricEditorUI();
    draw();
  }

  function setLineTime(rowIdx: number, newTime: number | null) {
    const el = $('#lyr') as HTMLTextAreaElement | null;
    if (!el) return;
    const lines = el.value.split(/\r?\n/);
    let curRow = 0;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed || /^\[[A-Za-z#]+:.*\]$/.test(trimmed)) continue;
      if (curRow === rowIdx) {
        const cleanText = trimmed.replace(/^\s*(\[\d+:\d{1,2}(?:[.,]\d+)?\]\s*)+/, '').trim();
        if (newTime != null) {
          lines[i] = '[' + fmt(Math.max(0, newTime)) + '] ' + cleanText;
        } else {
          lines[i] = cleanText;
        }
        break;
      }
      curRow++;
    }
    setLyrText(lines.join('\n'));
    updateLyricEditorUI();
    renderLyricWaveform();
  }

  function shiftLineTime(rowIdx: number, delta: number) {
    const rows = getLyricRows();
    if (!rows[rowIdx]) return;
    const baseTime = rows[rowIdx].time != null ? rows[rowIdx].time! : S.t;
    const target = Math.max(0, baseTime + delta);
    setLineTime(rowIdx, target);
    toast('Câu ' + (rowIdx + 1) + ': ' + fmt(target) + ' (' + (delta > 0 ? '+' : '') + delta.toFixed(2) + 's)');
  }

  function setSpeed(rate: number) {
    S.speed = rate;
    A.el.preservesPitch = true;
    (A.el as any).webkitPreservesPitch = true;
    (A.el as any).mozPreservesPitch = true;
    A.el.playbackRate = rate;
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
    toast('Tốc độ phát: ' + rate + 'x (giữ nguyên cao độ)');
  }

  function jumpBack3s() {
    const newT = Math.max(0, S.t - 3);
    seek(newT);
    if (tap.on) {
      if (tap.i > 0) {
        tap.i = Math.max(0, tap.i - 1);
        tap.times[tap.i] = null;
        updateTap();
      }
    } else {
      const rows = getLyricRows();
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].time != null && rows[i].time! <= newT + 0.3) {
          lyrSelIdx = i;
          break;
        }
      }
      updateLyricEditorUI();
      renderLyricWaveform();
    }
    toast('Đã lùi 3 giây');
  }

  function writeTimes(times: (number | null)[]) {
    setLyrText(rawLines().map((l: string, i: number) => times[i] != null ? '[' + fmt(times[i]!) + '] ' + l : l).join('\n'));
  }
  function evenLyrics() {
    const lines = rawLines();
    if (!lines.length) return toast('Hãy dán lời bài hát trước.');
    let T = total();
    if (A.loaded) T = Math.max(T, A.dur - A.start);
    if (T <= 0) return toast('Chưa có clip hoặc nhạc để chia theo thời lượng.');
    const w = lines.map((l: string) => l.length + 8), sum = w.reduce((a: number, b: number) => a + b, 0);
    let c = 0;
    const times = w.map((x: number) => { const t = T * c / sum; c += x; return t; });
    writeTimes(times);
  }
  function shiftLyr(d: number) {
    const txt = $('#lyr').value.replace(/\[(\d+):(\d{1,2}(?:[.,]\d+)?)\]/g, (_m: string, a: string, b: string) =>
      '[' + fmt(Math.max(0, +a * 60 + parseFloat(b.replace(',', '.')) + d)) + ']'
    );
    setLyrText(txt);
  }
  const tap = { on: false, i: 0, lines: [] as string[], times: [] as (number | null)[] };
  function startTap() {
    const lines = rawLines();
    if (!lines.length) return toast('Hãy dán lời bài hát trước.');
    if (!total()) return toast('Hãy thêm clip trước khi gõ nhịp.');
    tap.on = true; tap.i = 0; tap.lines = lines; tap.times = [];
    $('#tapbox').hidden = false;
    updateTap();
    seek(0);
    resumeAudioContext('Gõ nhịp').then(() => {
      play();
    });
  }
  function updateTap() {
    $('#tapNext').textContent = tap.i < tap.lines.length ? tap.lines[tap.i] : 'Hết lời';
  }
  function tapNext() {
    if (!tap.on) return;
    tap.times[tap.i] = Math.max(0, S.t - (+$('#tapLag').value || 0));
    tap.i++;
    if (tap.i >= tap.lines.length) endTap();
    else updateTap();
  }
  function endTap() {
    if (!tap.on) return;
    tap.on = false;
    $('#tapbox').hidden = true;
    pause();
    writeTimes(tap.times);
    toast('Đã gán giờ cho ' + tap.times.filter(x => x != null).length + ' dòng.');
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
    if (A.ctx && A.ctx.state !== 'closed' && A.srcNode) return true;
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
      if (!A.analyser) {
        A.analyser = A.ctx.createAnalyser();
        A.analyser.fftSize = 256;
        A.analyser.smoothingTimeConstant = 0.6;
      }
      if (!A.dest) {
        A.dest = A.ctx.createMediaStreamDestination();
      }
      if (!A.srcNode) {
        A.srcNode = A.ctx.createMediaElementSource(A.el);
        A.srcNode.connect(A.gain);
        A.gain.connect(A.analyser);
        A.analyser.connect(A.ctx.destination);
        A.analyser.connect(A.dest);
      }
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

  let vuRaf = 0;
  function updateVUMeter() {
    if (!A.analyser || (!S.playing && !A.isPreviewing && A.el.paused)) {
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

  function updatePreviewUI() {
    const cur = A.el.currentTime || 0;
    const dur = A.dur || A.el.duration || 0;
    const scrub = $('#prevScrub');
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
    if (!A.loaded && !A.el.src) {
      return toast('Hãy chọn file nhạc trước.');
    }
    if (S.playing) pause();
    await resumeAudioContext('Nghe thử');
    A.isPreviewing = true;
    applyVol(true);
    try {
      await A.el.play();
      toast('Đang phát nghe thử file nhạc độc lập');
    } catch (e: any) {
      setAudioError('Lỗi phát nghe thử: ' + (e?.message || e));
      A.isPreviewing = false;
    }
    updateAudioStatus();
    startVUMeter();
  }

  function pausePreview() {
    A.el.pause();
    A.isPreviewing = false;
    updateAudioStatus();
  }

  function stopPreview() {
    A.el.pause();
    A.el.currentTime = 0;
    A.isPreviewing = false;
    const scrub = $('#prevScrub');
    if (scrub) scrub.value = 0;
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
      } catch (err2: any) {
        A.loaded = false;
        A.loadState = 'Thất bại';
        setAudioError('Lỗi đọc file: ' + (err2?.message || err2));
      }
    }

    $('#audioInfo').textContent = A.loaded ? (A.name + ' (' + fmt(A.dur) + ')') : 'Không đọc được file nhạc này.';
    renderWaveformEditor();
    renderLyricWaveform();
    if (S.syncWithMusic) applyMusicSync();
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

  function updateTrimPlayhead() {
    const playhead = $('#wfPlayhead');
    const timeLbl = $('#wfPlayTime');
    const dur = A.dur || 1;
    const trackWidth = $('#wfTrack')?.clientWidth || 360;

    if (!A.isTrimPreviewing) {
      if (playhead) playhead.hidden = true;
      return;
    }

    const cur = A.el.currentTime;
    if (cur >= A.end || cur < A.start) {
      stopTrimPreview();
      return;
    }

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
    if (!A.loaded || A.dur <= 0) return toast('Hãy chọn file nhạc trước.');
    if (S.playing) pause();
    await resumeAudioContext('Nghe thử đoạn chọn');

    A.isTrimPreviewing = true;
    A.el.currentTime = A.start;
    applyVol(true);
    try {
      await A.el.play();
      toast('Đang nghe thử đoạn: ' + fmt(A.start) + ' -> ' + fmt(A.end));
    } catch (e: any) {
      setAudioError('Lỗi phát nghe thử: ' + (e?.message || e));
      A.isTrimPreviewing = false;
    }
    const btn = $('#btnPlayTrim');
    if (btn) btn.textContent = '⏸ Tạm dừng';
    startVUMeter();
    updateTrimPlayhead();
  }

  function stopTrimPreview() {
    A.isTrimPreviewing = false;
    A.el.pause();
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
      const pos = A.isTrimPreviewing ? Math.max(0, A.el.currentTime - A.start) : S.t;
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
    if (A.gain) {
      A.gain.gain.value = targetVol;
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

    const start = Math.max(0, A.start);
    const end = (A.end > start && A.end <= (A.dur || 999999)) ? A.end : (A.dur || 1);
    const dur = end - start;
    if (dur <= 0.05) {
      return toast('Đoạn nhạc chọn quá ngắn để xuất.');
    }

    try {
      if (statusEl) statusEl.textContent = 'Đang giải mã âm thanh...';
      toast(`Đang kết xuất đoạn nhạc ${fmt(start)} ➔ ${fmt(end)} (${format.toUpperCase()})...`);

      const rawBuf = await getDecodedAudioBuffer();
      if (!rawBuf) {
        if (statusEl) statusEl.textContent = prevStatus;
        return toast('Không đọc được dữ liệu âm thanh để xuất.');
      }

      if (statusEl) statusEl.textContent = 'Đang xử lý âm lượng & fade...';
      const rendered = await renderTrimmedAudio(rawBuf, {
        start,
        end,
        vol: A.vol,
        fadeIn: A.fadeIn,
        fadeOut: A.fadeOut
      });

      const cleanName = (A.name || 'audio')
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
      const startTag = fmt(start).replace(':', 'm');
      const endTag = fmt(end).replace(':', 'm');
      const baseFilename = `${cleanName}_cut_${startTag}-${endTag}`;

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
          if (statusEl) statusEl.textContent = 'Đoạn chọn + Âm lượng + Fade';
        }, 3500);
      }
    } catch (err: any) {
      console.error('Lỗi xuất nhạc:', err);
      toast('Lỗi khi xuất nhạc: ' + (err?.message || err));
      if (statusEl) statusEl.textContent = 'Lỗi xuất nhạc';
    }
  }

  async function startAudio() {
    if (!A.loaded) return;
    ensureGraph();
    if (A.ctx && A.ctx.state === 'suspended') {
      try {
        await A.ctx.resume();
        toast('Đã kích hoạt AudioContext (' + A.ctx.state + ')');
      } catch (e) {}
    }
    const want = A.start + S.t;
    const effectiveEnd = A.end > A.start ? A.end : A.dur;
    if (want >= effectiveEnd) return;
    A.el.currentTime = want;
    A.el.preservesPitch = true;
    (A.el as any).webkitPreservesPitch = true;
    (A.el as any).mozPreservesPitch = true;
    A.el.playbackRate = S.speed || 1.0;
    applyVol(false);
    try {
      await A.el.play();
    } catch (e: any) {
      console.warn('Audio play error:', e);
      setAudioError('Không thể phát thẻ audio: ' + (e?.message || e));
    }
    updateAudioStatus();
    startVUMeter();
  }

  function syncAudio() {
    if (!A.loaded) return;
    const want = A.start + S.t;
    const effectiveEnd = A.end > A.start ? A.end : A.dur;
    if (want >= effectiveEnd) {
      if (!A.el.paused) A.el.pause();
      return;
    }
    if (want < effectiveEnd && A.el.paused) {
      A.el.play().catch(() => {});
    }
    if (Math.abs(A.el.currentTime - want) > 0.4) {
      A.el.currentTime = want;
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
      if (prev && prev.type === 'video' && c.tr !== 'none' && L.local < Math.min(c.trDur, prev.dur, c.dur)) {
        act.add(prev);
        setVid(prev, Math.max(prev.srcIn, prev.srcOut - 0.05), false);
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
    raf = requestAnimationFrame(tick);
  }
  function play() {
    if (S.playing || !S.clips.length) return;
    if (A.isPreviewing) stopPreview();
    if (S.t >= total() - 0.01) S.t = 0;
    S.playing = true;
    tbase = S.t;
    t0 = performance.now();
    startAudio();
    raf = requestAnimationFrame(tick);
    updateUI();
  }
  function halt() {
    S.playing = false;
    cancelAnimationFrame(raf);
    A.el.pause();
    S.clips.forEach(c => {
      if (c.type === 'video' && !c.el.paused) c.el.pause();
    });
  }
  function pause() {
    halt();
    syncVideos(S.t, false);
    draw();
    updateUI();
  }
  function finish() {
    halt();
    updateUI();
    const cb = endCb;
    endCb = null;
    if (tap.on) endTap();
    if (cb) cb();
  }
  function seek(t: number) {
    S.t = clamp(t, 0, total());
    if (S.playing) {
      tbase = S.t;
      t0 = performance.now();
    }
    const want = A.start + S.t;
    const effectiveEnd = A.end > A.start ? A.end : A.dur;
    if (A.loaded && want <= effectiveEnd) {
      A.el.currentTime = want;
    }
    syncVideos(S.t, S.playing);
    draw();
    updateUI();
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

    if (aVol && fromInputId !== 'aVol') {
      aVol.value = String(clamped);
    }
    if (stageVol && fromInputId !== 'stageVol') {
      stageVol.value = String(clamped);
    }
    const percent = Math.round(clamped * 100);
    if (stageVolLbl) {
      stageVolLbl.textContent = percent + '%';
    }

    if (bMute) {
      if (clamped === 0) {
        bMute.innerHTML = ICON_VOL_MUTE;
        bMute.setAttribute('aria-label', 'Bật tiếng (phím M)');
        bMute.setAttribute('title', 'Bật tiếng (phím M)');
      } else if (clamped <= 0.5) {
        bMute.innerHTML = ICON_VOL_LOW;
        bMute.setAttribute('aria-label', 'Tắt tiếng (phím M)');
        bMute.setAttribute('title', 'Tắt tiếng (phím M)');
      } else {
        bMute.innerHTML = ICON_VOL_HIGH;
        bMute.setAttribute('aria-label', 'Tắt tiếng (phím M)');
        bMute.setAttribute('title', 'Tắt tiếng (phím M)');
      }
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
    if (A.isPreviewing) stopPreview();
    if (A.isTrimPreviewing) stopTrimPreview();
    seek(0);
    updateUI();
    toast('Đã dừng phát và về 00:00');
  }

  function updateUI() {
    const T = total();
    $('#scrub').max = T.toFixed(2);
    $('#scrub').value = S.t;
    $('#timeLbl').textContent = fmt(S.t) + ' / ' + fmt(T);
    $('#bPlay').innerHTML = S.playing ? ICON_PAUSE : ICON_PLAY;
    $('#bPlay').setAttribute('aria-label', S.playing ? 'Tạm dừng' : 'Phát');
    const ph = $('#ph');
    if (ph) ph.style.left = (S.t * S.pps) + 'px';
    if (S.playing) {
      const sc = $('#tlScroll'), x = S.t * S.pps;
      if (x > sc.scrollLeft + sc.clientWidth - 40 || x < sc.scrollLeft) {
        sc.scrollLeft = Math.max(0, x - 40);
      }
    }
    if (exporting && T > 0) $('#expBar').style.width = (S.t / T * 100).toFixed(1) + '%';
    const lyrPh = $('#lyrWfPlayhead');
    if (lyrPh) {
      const dur = Math.max(total(), A.dur || 1);
      lyrPh.style.left = clamp((S.t / dur) * 100, 0, 100) + '%';
    }
  }
  function renderTimeline() {
    const T = Math.max(total(), A.loaded ? Math.max(A.dur - A.start, 0) : 0, 10), pps = S.pps;
    const width = Math.ceil(T * pps) + 60;
    $('#tl').style.width = width + 'px';
    const stepT = pps >= 90 ? 1 : pps >= 45 ? 2 : pps >= 28 ? 5 : 10;
    let r = '';
    for (let s = 0; s <= T + 1; s += 1) {
      const x = s * pps;
      if (s % stepT === 0) r += '<i style="left:' + x + 'px;height:12px"></i><span style="left:' + x + 'px">' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '</span>';
      else if (pps >= 30) r += '<i style="left:' + x + 'px"></i>';
    }
    $('#ruler').innerHTML = r;
    let a = 0, h = '';
    S.clips.forEach((c, i) => {
      const w = Math.max(8, c.dur * pps - 2);
      const trw = i > 0 && c.tr !== 'none' ? Math.min(c.trDur, c.dur, S.clips[i - 1].dur) * pps : 0;
      h += '<div class="clip' + (c.id === S.sel ? ' sel' : '') + '" data-id="' + c.id + '" style="left:' + (a * pps) + 'px;width:' + w + 'px;background-image:url(' + c.thumb + ')">'
        + (trw ? '<i class="trz" style="width:' + Math.min(trw, w) + 'px" title="Chuyển cảnh"></i>' : '')
        + '<span class="cn">' + esc(c.name) + '</span><span class="cd">' + c.dur.toFixed(1) + 's</span><span class="kind">' + (c.type === 'video' ? 'video' : 'ảnh') + '</span></div>';
      a += c.dur;
    });
    $('#clips').innerHTML = h;
    const al = $('#alane');
    if (A.loaded) {
      const segDur = musicDuration();
      const aw = Math.ceil(Math.max(segDur, 0) * pps);
      al.style.width = aw + 'px';
      al.innerHTML = '<canvas></canvas>';
      const c = al.firstChild as HTMLCanvasElement, cw = Math.min(aw, 8000);
      c.width = Math.max(cw, 1);
      c.height = 44;
      c.style.width = aw + 'px';
      const x = c.getContext('2d')!, inside = total();
      x.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#0a8';
      const per = 20;
      for (let px = 0; px < cw; px++) {
        const tt = (px / cw) * segDur + A.start;
        const pk = A.peaks[Math.min(A.peaks.length - 1, Math.floor(tt * per))] || 0;
        const hh = Math.max(1, pk * 40);
        x.globalAlpha = (px / cw) * segDur <= inside ? 0.95 : 0.3;
        x.fillRect(px, 22 - hh / 2, 1, hh);
      }
    } else {
      al.style.width = '100%';
      al.innerHTML = '<span class="empty">Chưa có nhạc. Thêm ở tab Nhạc.</span>';
    }
    let l = '';
    S.lyr.forEach((ly, i) => {
      const nx = S.lyr[i + 1], w = Math.max(10, ((nx ? nx.t : ly.t + 3) - ly.t) * pps - 3);
      l += '<b style="left:' + (ly.t * pps) + 'px;width:' + w + 'px">' + esc(ly.text || '(trống)') + '</b>';
    });
    $('#llane').innerHTML = l;
    updateInspector();
    updateUI();
  }
  function selClip() { return S.clips.find(c => c.id === S.sel) || null; }
  function updateInspector() {
    const c = selClip(), ids = ['iDur', 'iIn', 'iOut', 'iFit', 'iFx', 'iTr', 'iTrD', 'iCol', 'iL', 'iR', 'iDup', 'iDel'];
    ids.forEach(i => { const el = $('#' + i); if (el) el.disabled = !c; });
    $('#iName').textContent = c ? c.name : 'Chọn một clip trên timeline để chỉnh.';
    if (!c) return;
    const v = c.type === 'video';
    $('#gDur').hidden = v;
    $('#gIn').hidden = !v;
    $('#gOut').hidden = !v;
    $('#iDur').value = c.dur.toFixed(1);
    $('#iIn').value = c.srcIn.toFixed(1);
    $('#iOut').value = c.srcOut.toFixed(1);
    $('#iOut').max = c.full;
    $('#iFit').value = c.fit;
    $('#iFx').value = c.fx;
    $('#iTr').value = c.tr;
    $('#iTrD').value = c.trDur;
    $('#iCol').value = c.color;
  }
  function refreshAll() {
    if (S.sel && !selClip()) S.sel = S.clips[0]?.id ?? null;
    S.t = clamp(S.t, 0, total());
    syncVideos(S.t, false);
    renderTimeline();
    draw();
  }
  function fill(sel: string, obj: Record<string, string>) {
    const el = $(sel);
    if (!el) return;
    el.innerHTML = Object.entries(obj).map(([k, v]) => '<option value="' + k + '">' + v + '</option>').join('');
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
  function splitAtHead() {
    const L = locate(S.t);
    if (!L) return toast('Chưa có clip để cắt.');
    const c = S.clips[L.i], local = L.local;
    if (local < 0.2 || c.dur - local < 0.2) return toast('Đưa đầu phát vào giữa clip (cách mép ít nhất 0,2 giây) rồi cắt.');
    const n = cloneClip(c);
    n.tr = 'none';
    if (c.type === 'image') {
      n.dur = c.dur - local;
      c.dur = local;
    } else {
      const out = c.srcOut;
      c.srcOut = c.srcIn + local;
      c.dur = local;
      n.srcIn = c.srcOut;
      n.srcOut = out;
      n.dur = out - n.srcIn;
    }
    n.sample = c.sample;
    S.clips.splice(L.i + 1, 0, n);
    S.sel = n.id;
    refreshAll();
    toast('Đã cắt thành hai clip.');
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
    endTap();
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

    // Phím M: Tắt / Bật tiếng
    if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      toggleMute();
      return;
    }

    // Phím mũi tên (▲ / ▼): Chỉnh âm lượng 5%
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      e.preventDefault();
      const delta = e.code === 'ArrowUp' ? 0.05 : -0.05;
      setVolume(A.vol + delta);
      toast('Âm lượng: ' + Math.round(A.vol * 100) + '%');
      return;
    }

    // Phím Space: Phát / Tạm dừng
    if (e.code === 'Space') {
      if (tap.on) {
        e.preventDefault();
        tapNext();
        return;
      }
      if (tg === 'BUTTON' && !tap.on) return;
      e.preventDefault();

      // Nếu đang mở tab Lyric: đặt mốc câu đang chọn
      const lyrPane = document.querySelector('[data-pane="lyric"]') as HTMLElement | null;
      const isLyrTabActive = lyrPane && !lyrPane.hidden;
      if (isLyrTabActive) {
        if (!S.playing) {
          resumeAudioContext('Phím Space').then(() => { play(); });
        }
        const lag = +($('#tapLag') as HTMLInputElement)?.value || 0;
        const targetTime = Math.max(0, S.t - lag);
        setLineTime(lyrSelIdx, targetTime);
        const rows = getLyricRows();
        const autoNext = ($('#chkAutoNext') as HTMLInputElement)?.checked ?? true;
        if (autoNext && lyrSelIdx < rows.length - 1) {
          lyrSelIdx++;
          updateLyricEditorUI();
          renderLyricWaveform();
        }
        toast('Đã đặt mốc câu ' + (lyrSelIdx + 1) + ' tại ' + fmt(targetTime));
        return;
      }

      if (S.playing) pause();
      else {
        if (A.isPreviewing) stopPreview();
        resumeAudioContext('Phím Space').then(() => {
          play();
        });
      }
      return;
    }

    // Phím mũi tên (◀ / ▶) dời mốc lyric 0.05 giây
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      const lyrPane = document.querySelector('[data-pane="lyric"]') as HTMLElement | null;
      const isLyrTabActive = lyrPane && !lyrPane.hidden;
      if (isLyrTabActive) {
        e.preventDefault();
        shiftLineTime(lyrSelIdx, e.code === 'ArrowLeft' ? -0.05 : 0.05);
        return;
      }
    }
  }
  function onResize() {
    fitStage();
    renderWaveformEditor();
    renderLyricWaveform();
  }

  function bind() {
    fill('#defFx', FX); fill('#defTr', TR); fill('#iFx', FX); fill('#iTr', TR); fill('#iCol', COL);
    const defFxEl = $('#defFx'); if (defFxEl) defFxEl.value = S.def.fx;
    const defTrEl = $('#defTr'); if (defTrEl) defTrEl.value = S.def.tr;
    const sFontEl = $('#sFont'); if (sFontEl) sFontEl.innerHTML = FONTS.map(f => '<option value="' + f + '" style="font-family:\'' + f + '\'">' + f + '</option>').join('');

    // Khởi tạo giá trị ban đầu cho các ô điều khiển sóng nhạc
    const vzInit = S.viz;
    const vzTypeEl = $('#vizType') as HTMLSelectElement | null; if (vzTypeEl) vzTypeEl.value = vzInit.type;
    const vzColorEl = $('#vizColor') as HTMLInputElement | null; if (vzColorEl) vzColorEl.value = vzInit.color;
    const vzColor2El = $('#vizColor2') as HTMLInputElement | null; if (vzColor2El) vzColor2El.value = vzInit.color2;
    const vzColorModeEl = $('#vizColorMode') as HTMLSelectElement | null; if (vzColorModeEl) vzColorModeEl.value = vzInit.colorMode;
    const vzBarsEl = $('#vizBars') as HTMLSelectElement | null; if (vzBarsEl) vzBarsEl.value = String(vzInit.bars);
    const vzYEl = $('#vizY') as HTMLInputElement | null; if (vzYEl) vzYEl.value = String(vzInit.y);
    const vzXEl = $('#vizX') as HTMLInputElement | null; if (vzXEl) vzXEl.value = String(vzInit.x);
    const vzSizeEl = $('#vizSize') as HTMLInputElement | null; if (vzSizeEl) vzSizeEl.value = String(vzInit.size);
    const vzSensEl = $('#vizSens') as HTMLInputElement | null; if (vzSensEl) vzSensEl.value = String(vzInit.sens);
    const vzGlowEl = $('#vizGlow') as HTMLInputElement | null; if (vzGlowEl) vzGlowEl.checked = vzInit.glow;
    const vzLogoBox = $('#vizLogoBox'); if (vzLogoBox) vzLogoBox.hidden = vzInit.type !== 'circle';
    const vzYLbl = $('#vizYLbl'); if (vzYLbl) vzYLbl.textContent = vzInit.y + '%';
    const vzXLbl = $('#vizXLbl'); if (vzXLbl) vzXLbl.textContent = vzInit.x + '%';
    const vzSizeLbl = $('#vizSizeLbl'); if (vzSizeLbl) vzSizeLbl.textContent = vzInit.size.toFixed(2) + 'x';
    const vzSensLbl = $('#vizSensLbl'); if (vzSensLbl) vzSensLbl.textContent = vzInit.sens.toFixed(1) + 'x';

    document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
      document.querySelectorAll('[data-pane]').forEach((p: any) => { p.hidden = p.dataset.pane !== (b as any).dataset.tab; });
      if ((b as any).dataset.tab === 'lyric') {
        renderLyricWaveform();
        updateLyricEditorUI();
      }
    }));

    const setOrient = (o: string) => {
      S.orient = o;
      $('#oV')?.setAttribute('aria-pressed', String(o === 'v'));
      $('#oH')?.setAttribute('aria-pressed', String(o === 'h'));
      setSize();
      draw();
    };
    safeClick('#oV', () => setOrient('v'));
    safeClick('#oH', () => setOrient('h'));
    safeChange('#res', (e: any) => { S.res = +e.target.value; setSize(); draw(); });

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
    safeClick('#applyAll', () => {
      S.clips.forEach((c, i) => {
        if (c.type === 'image') { c.dur = S.def.dur; c.fx = S.def.fx; c.fit = S.def.fit; }
        if (i > 0) c.tr = S.def.tr;
      });
      refreshAll();
      toast('Đã áp dụng cho tất cả clip.');
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

    const btnPre30 = $('#btnPreset30');
    if (btnPre30) {
      btnPre30.onclick = () => {
        if (!A.loaded || A.dur <= 0) return toast('Hãy chọn file nhạc trước.');
        const span = 30;
        if (A.dur <= span) {
          A.start = 0;
          A.end = A.dur;
        } else {
          const cur = A.start;
          if (cur + span <= A.dur) {
            A.end = cur + span;
          } else {
            A.end = A.dur;
            A.start = Math.max(0, A.dur - span);
          }
        }
        renderWaveformEditor();
        if (S.syncWithMusic) applyMusicSync();
        renderTimeline();
        toast('Đã chọn đoạn 30 giây (' + fmt(A.start) + ' - ' + fmt(A.end) + ') cho Reels / TikTok');
      };
    }

    const btnPre60 = $('#btnPreset60');
    if (btnPre60) {
      btnPre60.onclick = () => {
        if (!A.loaded || A.dur <= 0) return toast('Hãy chọn file nhạc trước.');
        const span = 60;
        if (A.dur <= span) {
          A.start = 0;
          A.end = A.dur;
        } else {
          const cur = A.start;
          if (cur + span <= A.dur) {
            A.end = cur + span;
          } else {
            A.end = A.dur;
            A.start = Math.max(0, A.dur - span);
          }
        }
        renderWaveformEditor();
        if (S.syncWithMusic) applyMusicSync();
        renderTimeline();
        toast('Đã chọn đoạn 60 giây (' + fmt(A.start) + ' - ' + fmt(A.end) + ') cho Shorts');
      };
    }

    const btnPreAll = $('#btnPresetAll');
    if (btnPreAll) {
      btnPreAll.onclick = () => {
        if (!A.loaded || A.dur <= 0) return toast('Hãy chọn file nhạc trước.');
        A.start = 0;
        A.end = A.dur;
        renderWaveformEditor();
        if (S.syncWithMusic) applyMusicSync();
        renderTimeline();
        toast('Đã chọn toàn bộ bài hát (' + fmt(A.dur) + ')');
      };
    }

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
      if (A.el) {
        A.el.currentTime = +e.target.value;
        updatePreviewUI();
      }
    });

    A.el.addEventListener('error', () => {
      const err = A.el.error;
      let msg = 'Lỗi phát file nhạc';
      if (err) {
        if (err.code === 1) msg = 'Phát nhạc bị hủy';
        else if (err.code === 2) msg = 'Lỗi mạng khi tải nhạc';
        else if (err.code === 3) msg = 'Lỗi giải mã audio';
        else if (err.code === 4) msg = 'Định dạng file không được hỗ trợ bởi trình duyệt';
        if (err.message) msg += ' (' + err.message + ')';
      }
      setAudioError(msg);
      updateAudioStatus();
    });
    A.el.addEventListener('timeupdate', () => {
      if (A.isPreviewing) updatePreviewUI();
      if (A.isTrimPreviewing) updateTrimPlayhead();
    });
    A.el.addEventListener('play', () => {
      startVUMeter();
      updateAudioStatus();
    });
    A.el.addEventListener('pause', () => {
      updateAudioStatus();
    });
    A.el.addEventListener('ended', () => {
      if (A.isPreviewing) stopPreview();
      if (A.isTrimPreviewing) stopTrimPreview();
      updateAudioStatus();
    });

    safeClick('#rmAudio', () => {
      halt();
      if (A.isPreviewing) stopPreview();
      if (A.isTrimPreviewing) stopTrimPreview();
      A.el.removeAttribute('src');
      A.el.load();
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
      const aInfo = $('#audioInfo');
      if (aInfo) aInfo.textContent = 'Chưa có nhạc. Video vẫn xem và xuất được, chỉ là không có tiếng.';
      renderWaveformEditor();
      refreshAll();
      updateAudioStatus();
      updateUI();
    });
    safeClick('#fitMusic', () => {
      if (!A.loaded) return toast('Hãy chọn nhạc trước.');
      const imgs = S.clips.filter(c => c.type === 'image');
      if (!imgs.length) return toast('Không có ảnh nào để chia.');
      const vt = S.clips.filter(c => c.type === 'video').reduce((a, c) => a + c.dur, 0);
      const rem = A.dur - A.start - vt;
      if (rem <= 0) return toast('Nhạc ngắn hơn phần video đã có.');
      const each = Math.max(0.5, Math.round(rem / imgs.length * 10) / 10);
      imgs.forEach(c => { c.dur = each; });
      refreshAll();
      toast('Mỗi ảnh hiện ' + each.toFixed(1) + ' giây.');
    });

    // lyric
    safeOn('#lyr', 'input', (e: any) => {
      S.lyr = parseLyr(e.target.value);
      renderTimeline();
      renderLyricWaveform();
      updateLyricEditorUI();
      draw();
    });
    safeClick('#tapStart', startTap);
    safeClick('#tapBtn', tapNext);
    safeClick('#tapEnd', endTap);
    safeClick('#tapUndo', () => { if (tap.on && tap.i > 0) { tap.i--; tap.times[tap.i] = null; updateTap(); } });
    safeClick('#tapBack3', jumpBack3s);
    safeClick('#btnJumpBack3s', jumpBack3s);

    // Tốc độ phát (0.5x, 0.75x, 1x)
    safeClick('#btnSpeed05', () => setSpeed(0.5));
    safeClick('#btnSpeed075', () => setSpeed(0.75));
    safeClick('#btnSpeed1', () => setSpeed(1.0));

    // Điều khiển câu lyric đang chọn
    safeClick('#btnLyrPrev', () => selectLyricLine(lyrSelIdx - 1));
    safeClick('#btnLyrNext', () => selectLyricLine(lyrSelIdx + 1));
    safeClick('#btnLyrMinus005', () => shiftLineTime(lyrSelIdx, -0.05));
    safeClick('#btnLyrPlus005', () => shiftLineTime(lyrSelIdx, 0.05));
    safeClick('#btnLyrMarkNow', () => {
      const lag = +($('#tapLag') as HTMLInputElement)?.value || 0;
      const targetTime = Math.max(0, S.t - lag);
      setLineTime(lyrSelIdx, targetTime);
      const rows = getLyricRows();
      const autoNext = ($('#chkAutoNext') as HTMLInputElement)?.checked ?? true;
      if (autoNext && lyrSelIdx < rows.length - 1) {
        lyrSelIdx++;
        updateLyricEditorUI();
        renderLyricWaveform();
      }
      toast('Đã đặt mốc câu ' + (lyrSelIdx + 1) + ' tại ' + fmt(targetTime));
    });
    safeClick('#btnPlayFromSel', () => {
      const rows = getLyricRows();
      if (rows[lyrSelIdx] && rows[lyrSelIdx].time != null) {
        seek(rows[lyrSelIdx].time!);
      }
      if (!S.playing) {
        resumeAudioContext('Nghe câu này').then(() => { play(); });
      }
    });

    // Tương tác trực tiếp trên sóng âm lyric
    const lyrTrack = $('#lyrWfTrack');
    const lyrHover = $('#lyrWfHover');
    const lyrHoverTime = $('#lyrWfHoverTime');

    if (lyrTrack) {
      lyrTrack.addEventListener('mousemove', (e: MouseEvent) => {
        const r = lyrTrack.getBoundingClientRect();
        const x = clamp(e.clientX - r.left, 0, r.width);
        const dur = Math.max(total(), A.dur || 1);
        const tHover = (x / r.width) * dur;
        if (lyrHover) {
          lyrHover.style.left = x + 'px';
          lyrHover.style.display = 'block';
        }
        if (lyrHoverTime) {
          lyrHoverTime.textContent = 'Mốc: ' + fmt(tHover) + ' (Bấm để gán câu ' + (lyrSelIdx + 1) + ')';
        }
      });

      lyrTrack.addEventListener('mouseleave', () => {
        if (lyrHover) lyrHover.style.display = 'none';
        if (lyrHoverTime) lyrHoverTime.textContent = 'Bấm vào sóng để đặt mốc';
      });

      lyrTrack.addEventListener('click', (e: MouseEvent) => {
        const r = lyrTrack.getBoundingClientRect();
        const x = clamp(e.clientX - r.left, 0, r.width);
        const dur = Math.max(total(), A.dur || 1);
        const clickTime = (x / r.width) * dur;
        setLineTime(lyrSelIdx, clickTime);
        seek(clickTime);
        toast('Đã gán câu ' + (lyrSelIdx + 1) + ' tại ' + fmt(clickTime));
        const autoNext = ($('#chkAutoNext') as HTMLInputElement)?.checked ?? true;
        const rows = getLyricRows();
        if (autoNext && lyrSelIdx < rows.length - 1) {
          lyrSelIdx++;
          updateLyricEditorUI();
          renderLyricWaveform();
        }
      });
    }

    safeClick('#lyrEven', evenLyrics);
    safeClick('#lyrClear', () => setLyrText(rawLines().join('\n')));
    safeClick('#shiftMinus', () => shiftLyr(-Math.abs(+$('#shiftV')?.value || 0)));
    safeClick('#shiftPlus', () => shiftLyr(Math.abs(+$('#shiftV')?.value || 0)));
    safeOn('#fileLrc', 'change', async (e: any) => {
      const f = e.target.files[0];
      if (f) { setLyrText(await f.text()); toast('Đã nhập lời từ ' + f.name); }
      e.target.value = '';
    });

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

    // sóng nhạc (hiệu ứng theo nhạc)
    safeChange('#vizType', (e: any) => {
      S.viz.type = e.target.value;
      const logoBox = $('#vizLogoBox');
      if (logoBox) logoBox.hidden = S.viz.type !== 'circle';
      // Tự động gợi ý vị trí thích hợp nếu người dùng chưa đổi vị trí
      const yInput = $('#vizY') as HTMLInputElement | null;
      const yLbl = $('#vizYLbl');
      if (S.viz.type === 'circle' && S.viz.y === 82) {
        S.viz.y = 50;
        if (yInput) yInput.value = '50';
        if (yLbl) yLbl.textContent = '50%';
      } else if (S.viz.type !== 'circle' && S.viz.y === 50) {
        S.viz.y = 82;
        if (yInput) yInput.value = '82';
        if (yLbl) yLbl.textContent = '82%';
      }
      draw();
    });

    safeChange('#vizColorMode', (e: any) => {
      S.viz.colorMode = e.target.value;
      const c2Box = $('#vizColor2Box');
      if (c2Box) c2Box.style.opacity = S.viz.colorMode === 'solid' ? '0.35' : '1';
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
      const el = $('#vizY') as HTMLInputElement | null; if (el) el.value = '82';
      const lbl = $('#vizYLbl'); if (lbl) lbl.textContent = '82%';
      draw();
    });

    safeClick('#btnVizPosCenter', () => {
      S.viz.y = 50;
      const el = $('#vizY') as HTMLInputElement | null; if (el) el.value = '50';
      const lbl = $('#vizYLbl'); if (lbl) lbl.textContent = '50%';
      draw();
    });

    safeClick('#btnVizPosTop', () => {
      S.viz.y = 20;
      const el = $('#vizY') as HTMLInputElement | null; if (el) el.value = '20';
      const lbl = $('#vizYLbl'); if (lbl) lbl.textContent = '20%';
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
    safeClick('#bPlay', async () => {
      if (A.isPreviewing) stopPreview();
      if (S.playing) {
        pause();
      } else {
        await resumeAudioContext('Nút Phát');
        play();
      }
    });
    safeClick('#bStart', () => seek(0));
    safeClick('#bStop', stopPlayback);
    safeOn('#scrub', 'input', (e: any) => seek(+e.target.value));
    document.addEventListener('keydown', onKeyDown);

    // timeline
    safeInput('#zoom', (e: any) => { S.pps = +e.target.value; renderTimeline(); });
    const tl = $('#tl');
    let drag = false;
    const scrubTo = (e: PointerEvent) => {
      if (!tl) return;
      const r = tl.getBoundingClientRect();
      seek((e.clientX - r.left) / S.pps);
    };
    if (tl) {
      tl.addEventListener('pointerdown', (e: PointerEvent) => {
        const targetEl = (e.target as HTMLElement).closest('.clip') as HTMLElement | null;
        if (targetEl && targetEl.dataset.id) {
          S.sel = +targetEl.dataset.id;
          renderTimeline();
        }
        drag = true;
        tl.setPointerCapture(e.pointerId);
        scrubTo(e);
      });
      tl.addEventListener('pointermove', (e: PointerEvent) => { if (drag) scrubTo(e); });
      tl.addEventListener('pointerup', () => { drag = false; });
      tl.addEventListener('pointercancel', () => { drag = false; });
    }

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
    num('#iDur', (c, v) => { if (c.type === 'image' && v > 0) c.dur = clamp(v, 0.3, 600); });
    num('#iIn', (c, v) => { if (c.type === 'video' && v >= 0) { c.srcIn = clamp(v, 0, c.srcOut - 0.3); c.dur = c.srcOut - c.srcIn; } });
    num('#iOut', (c, v) => { if (c.type === 'video' && v > 0) { c.srcOut = clamp(v, c.srcIn + 0.3, c.full); c.dur = c.srcOut - c.srcIn; } });
    num('#iTrD', (c, v) => { c.trDur = clamp(v || 0.6, 0.1, 3); });

    [['#iFit', 'fit'], ['#iFx', 'fx'], ['#iTr', 'tr'], ['#iCol', 'color']].forEach(([id, k]) => {
      const el = $(id);
      if (el) {
        el.addEventListener('change', (e: any) => {
          const c: any = selClip();
          if (c) { c[k] = e.target.value; refreshAll(); }
        });
      }
    });

    safeClick('#iL', () => { moveClip(-1); if (S.syncWithMusic) applyMusicSync(); });
    safeClick('#iR', () => { moveClip(1); if (S.syncWithMusic) applyMusicSync(); });
    safeClick('#iDel', () => {
      const i = S.clips.findIndex(c => c.id === S.sel);
      if (i < 0) return;
      S.clips.splice(i, 1);
      S.sel = S.clips[Math.min(i, S.clips.length - 1)]?.id ?? null;
      if (S.syncWithMusic) applyMusicSync();
      refreshAll();
    });
    safeClick('#iDup', () => {
      const i = S.clips.findIndex(c => c.id === S.sel);
      if (i < 0) return;
      const n = cloneClip(S.clips[i]);
      S.clips.splice(i + 1, 0, n);
      S.sel = n.id;
      if (S.syncWithMusic) applyMusicSync();
      refreshAll();
    });
    safeClick('#tSplit', () => {
      splitAtHead();
      if (S.syncWithMusic) applyMusicSync();
    });

    // xuất
    safeClick('#btnExport', exportVideo);
    safeClick('#expSave', saveExport);
    safeClick('#expClose', closeExport);
    window.addEventListener('resize', onResize);
  }

  // Khởi động
  bind();
  loadSample();
  setSize();
  setVolume(A.vol);
  renderWaveformEditor();
  renderLyricWaveform();
  updateLyricEditorUI();
  renderTimeline();
  draw();
  updateAudioStatus();
  document.fonts.ready.then(() => { loadFonts().then(draw); });

  // Cleanup for unmount
  return () => {
    halt();
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
  };
}
