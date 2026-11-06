// Thuật toán đối khớp lời bài hát và nhận dạng giọng nói AI (Needleman-Wunsch Alignment)

export interface RecognizedWord {
  text: string;
  start: number;
  end: number;
}

export interface LyricInputLine {
  id: number;
  text: string;
  t?: number;
  endT?: number;
  lane?: number;
}

export interface AlignmentResultLine {
  id: number;
  text: string;
  t: number;
  endT: number;
  confidence: number; // 0..1
  needsReview: boolean;
  matchedWordCount: number;
  totalWordCount: number;
  lane: number;
}

export interface AlignmentSummary {
  lines: AlignmentResultLine[];
  totalLines: number;
  confidentLines: number;
  reviewLines: number;
  averageConfidence: number;
}

// Bỏ dấu tiếng Việt phục vụ so sánh ngữ âm mờ
export function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Chuẩn hóa một từ: chữ thường, bỏ toàn bộ dấu câu
export function cleanWord(str: string): string {
  return str
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>\[\]\\|]/g, '')
    .trim();
}

// Kiểm tra dòng ghi chú không hát (ví dụ: [Điệp khúc], [Chorus], (Nhạc dạo)...)
export function isNonVocalAnnotation(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/^\[(điệp khúc|chorus|verse|đoạn \d+|solo|intro|outro|giang tấu|nhạc dạo|nhạc nền|pre-chorus|bridge|hook)\]$/i.test(trimmed)) {
    return true;
  }
  if (/^\((nhạc dạo|solo|nhạc|guitar|piano|nhạc nền)\)$/i.test(trimmed)) {
    return true;
  }
  return false;
}

// Khoảng cách Levenshtein giữa 2 chuỗi
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

// Tỉ lệ tương đồng Levenshtein (0..1)
function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

// Điểm tương đồng giữa một từ người dùng và một từ nhận dạng từ Whisper
function computeWordScore(userNorm: string, userUnaccent: string, recNorm: string, recUnaccent: string): number {
  if (!userNorm || !recNorm) return -0.8;

  // 1. Khớp hoàn toàn cả dấu tiếng Việt
  if (userNorm === recNorm) return 2.0;

  // 2. Khớp hoàn toàn bản không dấu (ví dụ: "nang" vs "nắng")
  if (userUnaccent === recUnaccent && userUnaccent.length > 0) return 1.6;

  // 3. Tương đồng Levenshtein cao trên bản có dấu
  const simAcc = similarity(userNorm, recNorm);
  if (simAcc >= 0.7) {
    return 1.2 * simAcc;
  }

  // 4. Tương đồng Levenshtein trên bản không dấu
  const simUnacc = similarity(userUnaccent, recUnaccent);
  if (simUnacc >= 0.7) {
    return 1.0 * simUnacc;
  }

  return -0.8;
}

export function alignLyricsWithWhisper(
  inputLines: LyricInputLine[],
  recognizedWords: RecognizedWord[],
  options: {
    audioTimelineOffsetSec?: number; // Độ lệch giờ của đoạn nhạc trên timeline
    onlyUnsynced?: boolean;          // Chỉ căn các câu chưa có giờ
    maxAudioSec?: number;            // Tổng thời lượng bài nhạc
  } = {}
): AlignmentSummary {
  const {
    audioTimelineOffsetSec = 0,
    onlyUnsynced = false,
    maxAudioSec = 9999
  } = options;

  // 1. Phân tách danh sách câu người dùng thành chuỗi từ token
  interface UserWordToken {
    lineId: number;
    lineIndex: number;
    wordIndex: number;
    rawText: string;
    norm: string;
    unaccent: string;
  }

  const userWords: UserWordToken[] = [];
  const lineStats: Array<{ id: number; text: string; wordIndices: number[]; isAnnotation: boolean; originalT?: number; originalEndT?: number; lane?: number }> = [];

  inputLines.forEach((line, lineIdx) => {
    const isAnnot = isNonVocalAnnotation(line.text);
    const words = line.text.split(/\s+/).filter(w => cleanWord(w).length > 0);
    const indices: number[] = [];

    if (!isAnnot) {
      words.forEach((w, wIdx) => {
        const norm = cleanWord(w);
        const unaccent = removeVietnameseTones(norm);
        const globalWordIdx = userWords.length;
        userWords.push({
          lineId: line.id,
          lineIndex: lineIdx,
          wordIndex: wIdx,
          rawText: w,
          norm,
          unaccent
        });
        indices.push(globalWordIdx);
      });
    }

    lineStats.push({
      id: line.id,
      text: line.text,
      wordIndices: indices,
      isAnnotation: isAnnot,
      originalT: line.t,
      originalEndT: line.endT,
      lane: line.lane
    });
  });

  // Chuẩn hóa danh sách từ Whisper
  const recWords = recognizedWords
    .map(w => {
      const norm = cleanWord(w.text);
      return {
        ...w,
        norm,
        unaccent: removeVietnameseTones(norm)
      };
    })
    .filter(w => w.norm.length > 0);

  // 2. Thuật toán quy hoạch động Needleman-Wunsch căn hai dãy từ
  const M = userWords.length;
  const N = recWords.length;

  const GAP_USER = -0.6; // Bỏ sót từ trong lời bài hát (AI không nghe thấy)
  const GAP_REC = -0.6;  // Chèn từ thừa từ AI nghe tạp âm hoặc bè

  // Khởi tạo ma trận DP
  // Với kích thước lớn (ví dụ 1000 x 1000), dùng Float32Array để tiết kiệm bộ nhớ và tối ưu tốc độ
  const scoreMatrix = new Float32Array((M + 1) * (N + 1));
  const pointerMatrix = new Int8Array((M + 1) * (N + 1)); // 1: chéo (match/mismatch), 2: lên (gap rec), 3: trái (gap user)

  const getIdx = (i: number, j: number) => i * (N + 1) + j;

  for (let i = 0; i <= M; i++) {
    scoreMatrix[getIdx(i, 0)] = i * GAP_USER;
    pointerMatrix[getIdx(i, 0)] = 3;
  }
  for (let j = 0; j <= N; j++) {
    scoreMatrix[getIdx(0, j)] = j * GAP_REC;
    pointerMatrix[getIdx(0, j)] = 2;
  }
  pointerMatrix[0] = 0;

  for (let i = 1; i <= M; i++) {
    const uWord = userWords[i - 1];
    for (let j = 1; j <= N; j++) {
      const rWord = recWords[j - 1];
      const matchScore = computeWordScore(uWord.norm, uWord.unaccent, rWord.norm, rWord.unaccent);

      const scoreDiag = scoreMatrix[getIdx(i - 1, j - 1)] + matchScore;
      const scoreUp = scoreMatrix[getIdx(i - 1, j)] + GAP_USER;
      const scoreLeft = scoreMatrix[getIdx(i, j - 1)] + GAP_REC;

      let bestScore = scoreDiag;
      let ptr = 1;

      if (scoreUp > bestScore) {
        bestScore = scoreUp;
        ptr = 2;
      }
      if (scoreLeft > bestScore) {
        bestScore = scoreLeft;
        ptr = 3;
      }

      const curIdx = getIdx(i, j);
      scoreMatrix[curIdx] = bestScore;
      pointerMatrix[curIdx] = ptr;
    }
  }

  // 3. Truy vết (Backtracking) để tìm các cặp từ khớp
  const alignedUserWords: Map<number, { recIdx: number; start: number; end: number; matchScore: number }> = new Map();
  let currI = M;
  let currJ = N;

  while (currI > 0 && currJ > 0) {
    const ptr = pointerMatrix[getIdx(currI, currJ)];
    if (ptr === 1) {
      const uWord = userWords[currI - 1];
      const rWord = recWords[currJ - 1];
      const score = computeWordScore(uWord.norm, uWord.unaccent, rWord.norm, rWord.unaccent);
      if (score > 0) {
        alignedUserWords.set(currI - 1, {
          recIdx: currJ - 1,
          start: rWord.start,
          end: rWord.end,
          matchScore: score
        });
      }
      currI--;
      currJ--;
    } else if (ptr === 2) {
      currI--;
    } else {
      currJ--;
    }
  }

  // 4. Gom lại theo từng câu
  const resultLines: AlignmentResultLine[] = [];

  lineStats.forEach((lineStat, lineIdx) => {
    // Nếu chọn chỉ căn câu chưa có giờ và câu này đã có giờ hợp lệ
    const hasOriginalTime = typeof lineStat.originalT === 'number' && lineStat.originalT > 0;
    if (onlyUnsynced && hasOriginalTime) {
      resultLines.push({
        id: lineStat.id,
        text: lineStat.text,
        t: lineStat.originalT!,
        endT: lineStat.originalEndT || (lineStat.originalT! + 3.0),
        confidence: 1.0,
        needsReview: false,
        matchedWordCount: lineStat.wordIndices.length,
        totalWordCount: lineStat.wordIndices.length,
        lane: typeof lineStat.lane === 'number' ? lineStat.lane : 0
      });
      return;
    }

    if (lineStat.isAnnotation || lineStat.wordIndices.length === 0) {
      resultLines.push({
        id: lineStat.id,
        text: lineStat.text,
        t: -1, // Sẽ nội suy sau
        endT: -1,
        confidence: 0,
        needsReview: true,
        matchedWordCount: 0,
        totalWordCount: 0,
        lane: 0
      });
      return;
    }

    const matchedTimes: Array<{ start: number; end: number }> = [];
    lineStat.wordIndices.forEach(wIdx => {
      const match = alignedUserWords.get(wIdx);
      if (match) {
        matchedTimes.push({ start: match.start, end: match.end });
      }
    });

    const totalWords = lineStat.wordIndices.length;
    const matchedCount = matchedTimes.length;
    const confidence = totalWords > 0 ? parseFloat((matchedCount / totalWords).toFixed(2)) : 0;

    if (matchedCount >= 1 && confidence >= 0.4) {
      // Đủ tin cậy: lấy đầu từ khớp đầu tiên và đuôi từ khớp cuối cùng
      matchedTimes.sort((a, b) => a.start - b.start);
      const startT = Math.max(0, matchedTimes[0].start + audioTimelineOffsetSec);
      const endT = Math.max(startT + 0.8, matchedTimes[matchedTimes.length - 1].end + audioTimelineOffsetSec);

      resultLines.push({
        id: lineStat.id,
        text: lineStat.text,
        t: parseFloat(startT.toFixed(2)),
        endT: parseFloat(endT.toFixed(2)),
        confidence,
        needsReview: confidence < 0.6,
        matchedWordCount: matchedCount,
        totalWordCount: totalWords,
        lane: typeof lineStat.lane === 'number' ? lineStat.lane : 0
      });
    } else {
      // Không đủ tin cậy, gắn cờ để nội suy
      resultLines.push({
        id: lineStat.id,
        text: lineStat.text,
        t: -1,
        endT: -1,
        confidence,
        needsReview: true,
        matchedWordCount: matchedCount,
        totalWordCount: totalWords,
        lane: typeof lineStat.lane === 'number' ? lineStat.lane : 0
      });
    }
  });

  // 5. Nội suy các câu không khớp được hoặc tỉ lệ khớp thấp (<0.4)
  for (let i = 0; i < resultLines.length; i++) {
    if (resultLines[i].t >= 0) continue;

    // Tìm câu khớp có giờ hợp lệ trước đó
    let prevValidIdx = -1;
    for (let p = i - 1; p >= 0; p--) {
      if (resultLines[p].t >= 0) {
        prevValidIdx = p;
        break;
      }
    }

    // Tìm câu khớp có giờ hợp lệ sau đó
    let nextValidIdx = -1;
    for (let n = i + 1; n < resultLines.length; n++) {
      if (resultLines[n].t >= 0) {
        nextValidIdx = n;
        break;
      }
    }

    let prevEnd = prevValidIdx >= 0 ? resultLines[prevValidIdx].endT : audioTimelineOffsetSec;
    let nextStart = nextValidIdx >= 0 ? resultLines[nextValidIdx].t : Math.min(maxAudioSec, prevEnd + 30);

    if (nextStart <= prevEnd) {
      nextStart = prevEnd + 4.0;
    }

    // Đếm số câu và số từ cần nội suy trong khoảng này
    const rangeStartIdx = prevValidIdx + 1;
    const rangeEndIdx = nextValidIdx >= 0 ? nextValidIdx - 1 : resultLines.length - 1;
    const unalignedCount = rangeEndIdx - rangeStartIdx + 1;

    let totalWordsInRange = 0;
    for (let k = rangeStartIdx; k <= rangeEndIdx; k++) {
      const wCount = Math.max(1, resultLines[k].totalWordCount || resultLines[k].text.split(/\s+/).length);
      totalWordsInRange += wCount;
    }

    const availableDuration = Math.max(1.5 * unalignedCount, nextStart - prevEnd);
    let runningT = prevEnd;

    for (let k = rangeStartIdx; k <= rangeEndIdx; k++) {
      const wCount = Math.max(1, resultLines[k].totalWordCount || resultLines[k].text.split(/\s+/).length);
      const allocatedDur = Math.max(0.8, (wCount / totalWordsInRange) * availableDuration);
      resultLines[k].t = parseFloat(runningT.toFixed(2));
      resultLines[k].endT = parseFloat((runningT + allocatedDur).toFixed(2));
      resultLines[k].needsReview = true;
      runningT += allocatedDur;
    }

    // Nhảy qua khoảng vừa nội suy
    i = rangeEndIdx;
  }

  // 6. Hậu xử lý (Post-Processing)
  // - Kéo dài giờ kết thúc thêm 0.2s nhưng không vượt giờ bắt đầu câu kế
  // - Độ dài tối thiểu 0.8 giây
  // - Sắp xếp theo timeline
  resultLines.sort((a, b) => a.t - b.t);

  for (let i = 0; i < resultLines.length; i++) {
    const cur = resultLines[i];
    const next = resultLines[i + 1];

    // Độ dài tối thiểu 0.8s
    if (cur.endT <= cur.t + 0.8) {
      cur.endT = parseFloat((cur.t + 0.8).toFixed(2));
    }

    // Kéo dài thêm 0.2s
    const extendedEnd = cur.endT + 0.2;
    if (next) {
      cur.endT = parseFloat(Math.min(extendedEnd, Math.max(cur.t + 0.8, next.t - 0.05)).toFixed(2));
    } else {
      cur.endT = parseFloat(Math.min(extendedEnd, maxAudioSec).toFixed(2));
    }
  }

  // Tự động phân hàng để không bị trùng thời gian trên cùng 1 hàng lyric
  const placed: Array<{ lane: number; t: number; endT: number }> = [];
  resultLines.forEach(item => {
    let desiredLane = typeof item.lane === 'number' ? Math.min(3, Math.max(0, item.lane)) : 0;
    let foundLane = -1;
    const order = [desiredLane, 0, 1, 2, 3].filter((v, i, a) => a.indexOf(v) === i);

    for (const lane of order) {
      const hasOverlap = placed.some(p => p.lane === lane && item.t < p.endT - 0.04 && item.endT > p.t + 0.04);
      if (!hasOverlap) {
        foundLane = lane;
        break;
      }
    }
    if (foundLane === -1) foundLane = desiredLane;
    item.lane = foundLane;
    placed.push({ lane: foundLane, t: item.t, endT: item.endT });
  });

  const confidentLines = resultLines.filter(l => !l.needsReview).length;
  const reviewLines = resultLines.length - confidentLines;
  const avgConf = resultLines.length > 0
    ? parseFloat((resultLines.reduce((acc, l) => acc + l.confidence, 0) / resultLines.length).toFixed(2))
    : 0;

  return {
    lines: resultLines,
    totalLines: resultLines.length,
    confidentLines,
    reviewLines,
    averageConfidence: avgConf
  };
}
