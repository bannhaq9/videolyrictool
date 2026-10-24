/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { initStudio } from './LyricStudio.ts';

export default function App() {
  useEffect(() => {
    const cleanup = initStudio();
    return () => {
      cleanup();
    };
  }, []);

  return (
    <div className="app">
      <header className="top">
        <h1>
          Lyric Video Studio
          <small>Ghép ảnh, video và nhạc thành video có lời chạy theo bài hát</small>
        </h1>
        <div className="grp">
          <div className="seg" role="group" aria-label="Định dạng khung hình">
            <button id="oV" aria-pressed="true">Dọc 9:16</button>
            <button id="oH" aria-pressed="false">Ngang 16:9</button>
          </div>
          <select id="res" aria-label="Độ phân giải" style={{ width: 'auto' }}>
            <option value="720">720p (nhanh)</option>
            <option value="1080">1080p (nét)</option>
          </select>
          <button className="btn pri" id="btnExport">Xuất video</button>
        </div>
      </header>

      <div className="main">
        <section className="panel" aria-label="Công cụ">
          <div className="tabs" role="tablist">
            <button role="tab" data-tab="media" aria-selected="true">Hình</button>
            <button role="tab" data-tab="music" aria-selected="false">Nhạc</button>
            <button role="tab" data-tab="visual" aria-selected="false">Sóng nhạc</button>
            <button role="tab" data-tab="lyric" aria-selected="false">Lyric</button>
            <button role="tab" data-tab="text" aria-selected="false">Chữ</button>
          </div>

          <div className="tabpane" data-pane="media">
            <label className="drop" id="drop1" htmlFor="fileMedia">
              <strong>Thêm ảnh hoặc video</strong>
              <span>Bấm chọn hoặc kéo thả vào đây, chọn được nhiều file</span>
            </label>
            <input id="fileMedia" type="file" accept="image/*,video/*" multiple hidden />
            <p className="note" id="sampleNote">Đang hiện ảnh mẫu và lời mẫu. Thêm ảnh của bạn thì phần mẫu sẽ tự mất.</p>
            <div className="row2">
              <div className="field">
                <label htmlFor="defDur">Giây mỗi ảnh</label>
                <input id="defDur" type="number" min="0.5" max="60" step="0.5" defaultValue="4" />
              </div>
              <div className="field">
                <label htmlFor="defFit">Khung ảnh</label>
                <select id="defFit" defaultValue="cover">
                  <option value="cover">Phủ kín khung</option>
                  <option value="contain">Vừa ảnh, nền mờ</option>
                </select>
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="defFx">Chuyển động ảnh</label>
                <select id="defFx"></select>
              </div>
              <div className="field">
                <label htmlFor="defTr">Chuyển cảnh</label>
                <select id="defTr"></select>
              </div>
            </div>
            <div className="btns">
              <button className="btn" id="applyAll">Áp dụng 3 mục trên cho mọi clip</button>
            </div>
            <p className="note">Ảnh dọc làm video ngang (hoặc ngược lại) thì chọn &quot;Vừa ảnh, nền mờ&quot; để không bị cắt mất phần ảnh.</p>
          </div>

          <div className="tabpane" data-pane="music" hidden>
            <label className="drop" htmlFor="fileAudio">
              <strong>Chọn file nhạc</strong>
              <span>MP3, M4A, WAV, OGG</span>
            </label>
            <input id="fileAudio" type="file" accept="audio/*" hidden />
            <p className="note" id="audioInfo">Chưa có nhạc. Video vẫn xem và xuất được, chỉ là không có tiếng.</p>

            {/* 1. Khung Trạng thái nhạc */}
            <div className="panel" id="audioStatusBox" style={{ padding: '12px', display: 'grid', gap: '8px', background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <span className="lbl" style={{ fontWeight: 700, color: 'var(--fg)', fontSize: '12px' }}>Trạng thái nhạc</span>
                <span id="astCtxBadge" className="badge neutral">AudioContext: Chưa tạo</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '85px minmax(0, 1fr)', gap: '4px 8px', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--muted)' }}>File:</span>
                <span id="astName" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>Chưa chọn</span>

                <span style={{ color: 'var(--muted)' }}>Độ dài:</span>
                <span id="astDur">00:00.00</span>

                <span style={{ color: 'var(--muted)' }}>Tải file:</span>
                <span id="astLoad">Chưa tải</span>

                <span style={{ color: 'var(--muted)' }}>AudioCtx:</span>
                <span id="astCtx">chưa khởi tạo</span>

                <span style={{ color: 'var(--muted)' }}>Lỗi:</span>
                <span id="astError" style={{ color: 'var(--accent)', wordBreak: 'break-word', fontWeight: 500 }}>Không có lỗi</span>
              </div>
              <div className="btns" style={{ marginTop: '4px' }}>
                <button className="btn sm pri" id="btnResumeCtx" type="button">Kích hoạt âm thanh (Resume)</button>
                <button className="btn sm" id="btnReloadAudio" type="button">Tải lại nhạc</button>
              </div>
            </div>

            {/* 2. Nghe thử file nhạc độc lập */}
            <div className="panel" style={{ padding: '10px 12px', display: 'grid', gap: '6px', background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="lbl" style={{ fontWeight: 700, color: 'var(--fg)', fontSize: '12px' }}>Nghe thử nhạc (độc lập)</span>
                <span id="prevTimeLbl" style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--muted)' }}>00:00.00 / 00:00.00</span>
              </div>
              <input id="prevScrub" type="range" min="0" max="0" step="0.1" defaultValue="0" style={{ width: '100%' }} />
              <div className="btns">
                <button className="btn sm pri" id="btnPrevPlay" type="button">▶ Nghe thử</button>
                <button className="btn sm" id="btnPrevStop" type="button">⏹ Dừng</button>
              </div>
            </div>

            {/* 3. Trình chỉnh & cắt nhạc (Sóng âm lớn) */}
            <div className="panel" id="waveformEditorBox" style={{ padding: '12px', display: 'grid', gap: '10px', background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span className="lbl" style={{ fontWeight: 700, color: 'var(--fg)', fontSize: '12px' }}>Trình chỉnh & cắt nhạc</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Zoom:</span>
                  <input id="wfZoom" type="range" min="1" max="10" step="0.5" defaultValue="1" style={{ width: '80px' }} />
                  <span id="wfZoomLbl" style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', minWidth: '22px' }}>1x</span>
                </div>
              </div>

              {/* Presets cắt nhanh */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>Cắt nhanh:</span>
                <button className="btn sm" id="btnPreset30" type="button">30s (Reels/TikTok)</button>
                <button className="btn sm" id="btnPreset60" type="button">60s (Shorts)</button>
                <button className="btn sm" id="btnPresetAll" type="button">Toàn bài</button>
              </div>

              {/* Sóng âm lớn & Khung kéo chọn mốc */}
              <div className="wf-wrap" id="wfWrap">
                <div className="wf-track" id="wfTrack">
                  <div className="wf-ruler" id="wfRuler"></div>
                  <canvas id="wfCv" width="360" height="100"></canvas>
                  <div className="wf-overlay-left" id="wfOverlayLeft"></div>
                  <div className="wf-overlay-right" id="wfOverlayRight"></div>
                  <div className="wf-region" id="wfRegion" title="Kéo để di chuyển cả đoạn chọn">
                    <div className="wf-fade-slope-in" id="wfFadeSlopeIn"></div>
                    <div className="wf-fade-slope-out" id="wfFadeSlopeOut"></div>
                  </div>
                  <div className="wf-handle" id="wfHandleStart" title="Kéo mốc Bắt đầu">
                    <div className="wf-handle-cap">◀</div>
                    <div className="wf-handle-cap">◀</div>
                  </div>
                  <div className="wf-handle" id="wfHandleEnd" title="Kéo mốc Kết thúc">
                    <div className="wf-handle-cap">▶</div>
                    <div className="wf-handle-cap">▶</div>
                  </div>
                  <div className="wf-playhead" id="wfPlayhead" hidden></div>
                </div>
              </div>

              {/* Thông số thời gian đoạn chọn */}
              <div className="row3">
                <div className="field">
                  <label htmlFor="aTrimStart">Bắt đầu (giây)</label>
                  <input id="aTrimStart" type="number" min="0" step="0.1" defaultValue="0" />
                </div>
                <div className="field">
                  <label htmlFor="aTrimEnd">Kết thúc (giây)</label>
                  <input id="aTrimEnd" type="number" min="0" step="0.1" defaultValue="0" />
                </div>
                <div className="field">
                  <label>Độ dài chọn</label>
                  <div style={{ height: '32px', display: 'flex', alignItems: 'center', padding: '0 8px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>
                    <span id="aTrimDur">00:00.00</span>
                  </div>
                </div>
              </div>

              {/* Fade vào / Fade ra tùy chỉnh */}
              <div className="row2">
                <div className="field">
                  <label htmlFor="aFadeIn">Fade vào (giây)</label>
                  <input id="aFadeIn" type="number" min="0" max="10" step="0.1" defaultValue="0" />
                </div>
                <div className="field">
                  <label htmlFor="aFadeOut">Fade ra (giây)</label>
                  <input id="aFadeOut" type="number" min="0" max="10" step="0.1" defaultValue="1.5" />
                </div>
              </div>

              {/* Nghe thử đoạn chọn */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', paddingTop: '4px' }}>
                <button className="btn sm pri" id="btnPlayTrim" type="button" style={{ minWidth: '150px' }}>▶ Nghe thử đoạn chọn</button>
                <button className="btn sm" id="btnStopTrim" type="button">⏹ Dừng</button>
                <span id="wfPlayTime" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--muted)', marginLeft: 'auto' }}>00:00.00</span>
              </div>

              {/* Xuất nhạc đã cắt */}
              <div style={{
                marginTop: '6px',
                padding: '10px 12px',
                background: 'rgba(45, 212, 191, 0.08)',
                border: '1px solid rgba(45, 212, 191, 0.28)',
                borderRadius: '8px',
                display: 'grid',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>✂️</span> Xuất nhạc đã cắt
                  </span>
                  <span id="exportAudioStatus" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                    Đoạn chọn + Âm lượng + Fade
                  </span>
                </div>
                <p className="note" style={{ margin: 0, fontSize: '11.5px', color: 'var(--muted)' }}>
                  Xuất riêng file âm thanh đoạn đã chọn kèm hiệu ứng fade vào/ra và mức âm lượng đã chỉnh.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn sm pri" id="btnExportTrimWav" type="button" style={{ flex: '1 1 140px', background: 'var(--teal)', borderColor: 'var(--teal)' }}>
                    ⬇ Xuất WAV (Chuẩn gốc)
                  </button>
                  <button className="btn sm" id="btnExportTrimMp3" type="button" style={{ flex: '1 1 140px' }}>
                    ⬇ Xuất MP3 (192kbps)
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Thanh đo mức âm thanh (VU Meter) */}
            <div style={{ display: 'grid', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="lbl">Mức âm thanh (VU Meter)</span>
                <span id="vuVal" style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--muted)' }}>0% (Yên lặng)</span>
              </div>
              <div className="vu-bar">
                <div id="vuFill" className="vu-fill"></div>
                <div className="vu-scale">
                  <span>-40dB</span>
                  <span>-20dB</span>
                  <span>-6dB</span>
                  <span>0dB</span>
                </div>
              </div>
            </div>

            <div className="field">
              <label htmlFor="aVol">Âm lượng tổng</label>
              <input id="aVol" type="range" min="0" max="1" step="0.01" defaultValue="1" />
            </div>

            {/* Chế độ Theo độ dài bài hát */}
            <div className="panel" style={{ padding: '10px 12px', display: 'grid', gap: '8px', background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: '8px' }}>
              <label className="chk" style={{ fontWeight: 600 }}>
                <input id="syncWithMusic" type="checkbox" />
                <span>Theo độ dài bài hát</span>
              </label>
              <p className="note" style={{ margin: 0 }}>
                Thời lượng video bằng độ dài nhạc (trừ đoạn bỏ qua ở đầu).
              </p>
              <div className="field" id="syncModeGroup" hidden>
                <label htmlFor="syncMusicMode">Cách điều chỉnh ảnh</label>
                <select id="syncMusicMode" defaultValue="even">
                  <option value="even">Ảnh tự chia đều</option>
                  <option value="extendLast">Ảnh cuối kéo dài cho tới hết bài</option>
                </select>
              </div>
            </div>

            <div className="btns">
              <button className="btn pri" id="btnExportWavQuick" type="button">⬇ Xuất nhạc đã cắt (.wav)</button>
              <button className="btn" id="fitMusic">Chia đều ảnh theo độ dài nhạc</button>
              <button className="btn" id="btnToVisualTab" type="button">Cài đặt sóng nhạc ▶</button>
              <button className="btn danger" id="rmAudio">Bỏ nhạc</button>
            </div>
          </div>

          <div className="tabpane" data-pane="visual" hidden>
            <div className="field">
              <label htmlFor="vizType">Kiểu hiệu ứng sóng nhạc</label>
              <select id="vizType" defaultValue="bars">
                <option value="bars">Thanh Equalizer (cột đứng)</option>
                <option value="mirror">Thanh Equalizer (đối xứng)</option>
                <option value="circle">Sóng tròn quanh logo</option>
                <option value="wave">Vạch sóng âm chạy ngang</option>
                <option value="none">Tắt hiệu ứng</option>
              </select>
            </div>

            {/* Khung cấu hình Logo cho sóng tròn */}
            <div className="panel" id="vizLogoBox" style={{ padding: '12px', display: 'grid', gap: '8px', background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: '8px' }} hidden>
              <span className="lbl" style={{ fontWeight: 700, color: 'var(--fg)', fontSize: '12px' }}>Logo tâm sóng tròn</span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div id="vizLogoPreview" style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#0a0e0f', border: '2px solid var(--accent)', display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  <span id="vizLogoIcon" style={{ fontSize: '20px' }}>🎵</span>
                  <img id="vizLogoImgTag" alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'none' }} />
                </div>
                <div style={{ display: 'grid', gap: '6px', flex: 1 }}>
                  <label className="btn sm" htmlFor="vizLogoFile" style={{ cursor: 'pointer', textAlign: 'center' }}>
                    Tải ảnh logo / avatar của bạn
                  </label>
                  <input id="vizLogoFile" type="file" accept="image/*" hidden />
                  <button className="btn sm" id="vizLogoClear" type="button">Dùng đĩa than mặc định</button>
                </div>
              </div>
              <p className="note" style={{ margin: 0 }}>Ảnh logo được cắt tròn ở tâm và phập phồng (pulse) theo nhịp bass.</p>
            </div>

            <div className="row2">
              <div className="field">
                <label htmlFor="vizColorMode">Kiểu màu sắc</label>
                <select id="vizColorMode" defaultValue="gradient">
                  <option value="gradient">Chuyển sắc (Gradient)</option>
                  <option value="solid">Đơn sắc (1 màu)</option>
                  <option value="rainbow">Cầu vồng chuyển động</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="vizBars">Số vạch sóng</label>
                <select id="vizBars" defaultValue="32">
                  <option value="16">16 vạch</option>
                  <option value="24">24 vạch</option>
                  <option value="32">32 vạch (chuẩn)</option>
                  <option value="48">48 vạch</option>
                  <option value="64">64 vạch (chi tiết)</option>
                </select>
              </div>
            </div>

            <div className="row2">
              <div className="field">
                <label htmlFor="vizColor">Màu chính</label>
                <input id="vizColor" type="color" defaultValue="#00f0ff" />
              </div>
              <div className="field" id="vizColor2Box">
                <label htmlFor="vizColor2">Màu phụ / Gradient</label>
                <input id="vizColor2" type="color" defaultValue="#ff007f" />
              </div>
            </div>

            <div className="row2">
              <div className="field">
                <label htmlFor="vizY">Vị trí dọc Y: <span id="vizYLbl" style={{ fontFamily: 'var(--font-mono)' }}>82%</span></label>
                <input id="vizY" type="range" min="10" max="90" step="1" defaultValue="82" />
              </div>
              <div className="field">
                <label htmlFor="vizX">Vị trí ngang X: <span id="vizXLbl" style={{ fontFamily: 'var(--font-mono)' }}>50%</span></label>
                <input id="vizX" type="range" min="10" max="90" step="1" defaultValue="50" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>Đặt vị trí nhanh:</span>
              <button className="btn sm" id="btnVizPosBottom" type="button">Dưới đáy (82%)</button>
              <button className="btn sm" id="btnVizPosCenter" type="button">Chính giữa (50%)</button>
              <button className="btn sm" id="btnVizPosTop" type="button">Trên đỉnh (20%)</button>
            </div>

            <div className="row2">
              <div className="field">
                <label htmlFor="vizSize">Độ lớn: <span id="vizSizeLbl" style={{ fontFamily: 'var(--font-mono)' }}>1.0x</span></label>
                <input id="vizSize" type="range" min="0.3" max="2.5" step="0.05" defaultValue="1" />
              </div>
              <div className="field">
                <label htmlFor="vizSens">Độ nhạy: <span id="vizSensLbl" style={{ fontFamily: 'var(--font-mono)' }}>1.2x</span></label>
                <input id="vizSens" type="range" min="0.4" max="3.0" step="0.1" defaultValue="1.2" />
              </div>
            </div>

            <label className="chk">
              <input id="vizGlow" type="checkbox" defaultChecked /> Hiệu ứng phát sáng Neon (Glow)
            </label>
          </div>

          <div className="tabpane" data-pane="lyric" hidden>
            {/* 1. Trình gán mốc & Sóng âm lyric */}
            <div className="panel" style={{ padding: '12px', display: 'grid', gap: '10px', background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span className="lbl" style={{ fontWeight: 700, color: 'var(--fg)', fontSize: '12px' }}>Sóng âm lyric & Gán mốc</span>
                <span id="lyrWfHoverTime" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)' }}>Bấm vào sóng để đặt mốc</span>
              </div>

              {/* Sóng âm với các vạch câu hát */}
              <div className="wf-wrap" id="lyrWfWrap">
                <div className="wf-track" id="lyrWfTrack" style={{ cursor: 'crosshair', height: '80px', position: 'relative' }}>
                  <div className="wf-ruler" id="lyrWfRuler" style={{ height: '16px' }}></div>
                  <canvas id="lyrWfCv" width="360" height="80" style={{ display: 'block', height: '80px', width: '100%' }}></canvas>
                  <div id="lyrWfPlayhead" style={{ position: 'absolute', top: 0, bottom: 0, width: '2px', background: '#ef4444', pointerEvents: 'none', zIndex: 10, left: '0%' }}>
                    <div style={{ position: 'absolute', top: 0, left: '-4px', border: '5px solid transparent', borderTopColor: '#ef4444' }}></div>
                  </div>
                  <div id="lyrWfHover" style={{ position: 'absolute', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.7)', pointerEvents: 'none', zIndex: 8, display: 'none' }}></div>
                </div>
              </div>

              {/* Thẻ hiển thị câu đang chọn */}
              <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '6px', padding: '10px', display: 'grid', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span id="lyrSelBadge" className="badge success">Câu 1/1</span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Đang chọn</span>
                  </div>
                  <span id="lyrSelTime" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>00:00.00</span>
                </div>
                <div id="lyrSelText" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg)', minHeight: '20px', wordBreak: 'break-word' }}>
                  (Chưa có lời bài hát)
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: '2px' }}>
                  <button className="btn sm" id="btnLyrPrev" type="button" title="Câu trước (Phím ▲)">◀ Câu trước</button>
                  <button className="btn sm" id="btnLyrNext" type="button" title="Câu sau (Phím ▼)">Câu sau ▶</button>
                  <button className="btn sm" id="btnLyrMinus005" type="button" title="Dời sớm 0.05s (Phím ◀)">-0.05s</button>
                  <button className="btn sm" id="btnLyrPlus005" type="button" title="Dời trễ 0.05s (Phím ▶)">+0.05s</button>
                  <button className="btn sm pri" id="btnLyrMarkNow" type="button" style={{ marginLeft: 'auto' }} title="Đặt mốc tại giây hiện tại (Space)">⚡ Đặt mốc (Space)</button>
                </div>
              </div>

              {/* Tốc độ phát & Lùi 3s */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>Tốc độ:</span>
                  <div className="seg" role="group" aria-label="Tốc độ phát">
                    <button type="button" id="btnSpeed05" data-speed="0.5" aria-pressed="false" style={{ padding: '4px 8px', fontSize: '12px' }}>0.5x</button>
                    <button type="button" id="btnSpeed075" data-speed="0.75" aria-pressed="false" style={{ padding: '4px 8px', fontSize: '12px' }}>0.75x</button>
                    <button type="button" id="btnSpeed1" data-speed="1.0" aria-pressed="true" style={{ padding: '4px 8px', fontSize: '12px' }}>1x</button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn sm" id="btnJumpBack3s" type="button" title="Lùi lại 3 giây">⏪ Lùi 3 giây</button>
                  <button className="btn sm" id="btnPlayFromSel" type="button">▶ Nghe thử câu này</button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: 'var(--muted)' }}>
                <span>Phím tắt: <strong>Space</strong> (đặt mốc) • <strong>◀ / ▶</strong> (±0.05s)</span>
                <label className="chk" style={{ fontSize: '11.5px', margin: 0 }}>
                  <input id="chkAutoNext" type="checkbox" defaultChecked />
                  <span>Tự sang câu kế</span>
                </label>
              </div>
            </div>

            {/* Tapbox khi gõ nhịp toàn bài */}
            <div className="tapbox" id="tapbox" hidden>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="lbl">Dòng sắp hát (Gõ nhịp)</span>
                <button className="btn sm" id="tapBack3" type="button">⏪ Lùi 3 giây để gõ lại</button>
              </div>
              <div className="next" id="tapNext"></div>
              <div className="btns">
                <button className="btn pri" id="tapBtn">Bấm khi bắt đầu hát (Space)</button>
                <button className="btn" id="tapUndo">Lùi 1 dòng</button>
                <button className="btn" id="tapEnd">Xong</button>
              </div>
            </div>

            {/* Các nút thao tác chung */}
            <div className="btns">
              <button className="btn pri" id="tapStart">Gõ nhịp theo nhạc (Toàn bài)</button>
              <button className="btn" id="lyrEven">Chia đều theo thời lượng</button>
              <button className="btn" id="lyrClear">Xóa giờ</button>
            </div>

            <div className="field">
              <label htmlFor="lyr">Lời bài hát (sửa trực tiếp hoặc dán mới)</label>
              <textarea
                id="lyr"
                rows={7}
                spellCheck={false}
                placeholder="Dán lời bài hát, mỗi dòng một câu. Dòng có dạng [00:12.50] Lời hát sẽ hiện đúng giây đó."
              ></textarea>
            </div>

            <div className="row2">
              <div className="field">
                <label htmlFor="shiftV">Dịch tất cả giờ (giây)</label>
                <input id="shiftV" type="number" step="0.1" defaultValue="0.3" />
              </div>
              <div className="field">
                <label>&nbsp;</label>
                <div className="btns">
                  <button className="btn" id="shiftMinus">Sớm lại</button>
                  <button className="btn" id="shiftPlus">Trễ ra</button>
                </div>
              </div>
            </div>

            <div className="row2">
              <div className="field">
                <label htmlFor="tapLag">Bù phản xạ khi gõ (giây)</label>
                <input id="tapLag" type="number" min="0" max="0.6" step="0.05" defaultValue="0.15" />
              </div>
              <div className="field">
                <label htmlFor="fileLrc">Nhập file .lrc / .txt</label>
                <input id="fileLrc" type="file" accept=".lrc,.txt,text/plain" />
              </div>
            </div>
            <p className="note">
              Bấm vào sóng âm để gán mốc chính xác từng câu; hoặc bấm &quot;Gõ nhịp theo nhạc&quot; để gõ liên tục theo bài hát ở tốc độ 0.5x, 0.75x hoặc 1x.
            </p>
          </div>

          <div className="tabpane" data-pane="text" hidden>
            <div className="field">
              <label htmlFor="sFont">Font chữ</label>
              <select id="sFont"></select>
            </div>
            <div className="btns">
              <label className="btn sm" htmlFor="fileFont" style={{ cursor: 'pointer' }}>
                Tải font của bạn (.ttf .otf .woff)
              </label>
              <input id="fileFont" type="file" accept=".ttf,.otf,.woff,.woff2" hidden />
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="sSize">Cỡ chữ</label>
                <input id="sSize" type="range" min="3" max="14" step="0.2" defaultValue="7" />
              </div>
              <div className="field">
                <label htmlFor="sWeight">Độ đậm</label>
                <select id="sWeight" defaultValue="700">
                  <option value="400">Thường</option>
                  <option value="700">Đậm</option>
                  <option value="800">Rất đậm</option>
                </select>
              </div>
            </div>
            <div className="row3">
              <div className="field">
                <label htmlFor="sColor">Màu chữ</label>
                <input id="sColor" type="color" defaultValue="#ffffff" />
              </div>
              <div className="field">
                <label htmlFor="sHi">Màu chạy</label>
                <input id="sHi" type="color" defaultValue="#ffd23f" />
              </div>
              <div className="field">
                <label htmlFor="sOutC">Màu viền</label>
                <input id="sOutC" type="color" defaultValue="#000000" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="sOut">Độ dày viền</label>
                <input id="sOut" type="range" min="0" max="14" step="0.5" defaultValue="6" />
              </div>
              <div className="field">
                <label htmlFor="sBox">Nền mờ sau chữ</label>
                <input id="sBox" type="range" min="0" max="0.85" step="0.05" defaultValue="0" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="sY">Vị trí dọc của lời</label>
              <input id="sY" type="range" min="8" max="92" step="1" defaultValue="74" />
            </div>
            <div className="field">
              <label htmlFor="sAnim">Hiệu ứng chữ</label>
              <select id="sAnim" defaultValue="fade">
                <option value="fade">Mờ dần</option>
                <option value="rise">Bay lên</option>
                <option value="pop">Nảy (pop)</option>
                <option value="type">Gõ từng chữ</option>
                <option value="slide">Trượt từ trái</option>
              </select>
            </div>
            <label className="chk">
              <input id="sKara" type="checkbox" defaultChecked /> Chữ đổi màu chạy theo nhạc (karaoke)
            </label>
            <label className="chk">
              <input id="sNext" type="checkbox" defaultChecked /> Hiện thêm dòng kế tiếp bên dưới
            </label>
            <label className="chk">
              <input id="sShadow" type="checkbox" defaultChecked /> Đổ bóng
            </label>
            <label className="chk">
              <input id="sUpper" type="checkbox" /> VIẾT HOA TOÀN BỘ
            </label>
            <div className="field">
              <label htmlFor="tText">Tiêu đề đầu video (bỏ trống nếu không dùng)</label>
              <input id="tText" type="text" placeholder="Ví dụ: Tên bài hát - Ca sĩ" />
            </div>
            <div className="field">
              <label htmlFor="tDur">Tiêu đề hiện trong (giây)</label>
              <input id="tDur" type="number" min="1" max="30" step="0.5" defaultValue="3" />
            </div>
          </div>
        </section>

        <section className="stagecol" aria-label="Xem trước">
          <div className="stage panel" id="stage">
            <canvas id="cv" width="720" height="1280"></canvas>
          </div>
          <div className="panel transport">
            <div className="transport-btns">
              <button className="ib" id="bStart" type="button" aria-label="Về đầu" title="Về đầu">
                <svg viewBox="0 0 24 24" width="15" height="15">
                  <path d="M6 5h2v14H6zM20 5v14L9 12z" fill="currentColor" />
                </svg>
              </button>
              <button className="ib pri" id="bPlay" type="button" aria-label="Phát" title="Phát / Tạm dừng (Phím Space)"></button>
              <button className="ib" id="bStop" type="button" aria-label="Dừng (về 00:00)" title="Dừng hẳn và về 00:00">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <rect x="5.5" y="5.5" width="13" height="13" rx="1.5" fill="currentColor" />
                </svg>
              </button>
            </div>
            <div className="transport-scrub">
              <input id="scrub" type="range" min="0" max="0" step="0.01" defaultValue="0" aria-label="Tua" />
              <span className="time" id="timeLbl">00:00.00 / 00:00.00</span>
            </div>
            <div className="vol-ctrl" title="Âm lượng (Phím M tắt/bật, Mũi tên lên/xuống chỉnh 5%)">
              <button className="ib sm" id="bMute" type="button" aria-label="Tắt/Bật tiếng (M)" title="Tắt/Bật tiếng (Phím M)">
                <svg viewBox="0 0 24 24" width="15" height="15">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="currentColor"/>
                </svg>
              </button>
              <input id="stageVol" type="range" min="0" max="1" step="0.01" defaultValue="1" aria-label="Âm lượng phát" />
              <span className="vol-val" id="stageVolLbl">100%</span>
            </div>
          </div>
        </section>
      </div>

      <section className="panel tl-wrap" aria-label="Timeline">
        <div className="tl-bar">
          <div className="btns">
            <label className="btn sm pri" htmlFor="fileMedia2" style={{ cursor: 'pointer' }}>
              Thêm clip
            </label>
            <input id="fileMedia2" type="file" accept="image/*,video/*" multiple hidden />
            <button className="btn sm" id="tSplit">Cắt tại đầu phát</button>
          </div>

          {/* Thanh công cụ chỉnh Lyric trên Timeline (Requirement 5) */}
          <div id="lyrToolbar" className="lyr-toolbar" style={{ display: 'none', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span className="badge success" id="lyrTbBadge" style={{ fontSize: '11px', padding: '2px 7px' }}>Câu #1</span>
            <button className="btn sm" id="btnTbAddLyr" type="button" title="Thêm câu mới tại đầu phát">➕ Thêm câu</button>
            <button className="btn sm" id="btnTbSplitLyr" type="button" title="Tách câu tại đầu phát thành 2 câu">✂️ Tách câu</button>
            <button className="btn sm" id="btnTbMergeNext" type="button" title="Gộp câu này với câu kế tiếp">🔗 Gộp sau</button>
            <button className="btn sm danger" id="btnTbDelLyr" type="button" title="Xóa câu này">🗑️ Xóa</button>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
              <span style={{ color: 'var(--muted)' }}>Bắt đầu:</span>
              <input type="number" id="lyrTbStart" step="0.05" min="0" style={{ width: '64px', padding: '3px 4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }} />
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
              <span style={{ color: 'var(--muted)' }}>Kết thúc:</span>
              <input type="number" id="lyrTbEnd" step="0.05" min="0" style={{ width: '64px', padding: '3px 4px', fontSize: '11px', fontFamily: 'var(--font-mono)' }} />
            </div>
            <button className="btn sm" id="btnTbDeselect" type="button" title="Đóng bảng chỉnh câu" style={{ padding: '2px 6px', fontSize: '11px' }}>✕</button>
          </div>

          <div className="zoom">
            <label htmlFor="zoom">Thu phóng</label>
            <input id="zoom" type="range" min="20" max="200" step="5" defaultValue="60" />
          </div>
        </div>
        <div className="tl-scroll" id="tlScroll">
          <div className="tl" id="tl">
            <div className="ruler" id="ruler"></div>
            <span className="lane-lbl" style={{ top: '30px' }}>Clip</span>
            <div id="clips"></div>
            <span className="lane-lbl" style={{ top: '112px' }}>Nhạc</span>
            <div className="alane" id="alane"></div>
            <span className="lane-lbl" style={{ top: '162px' }}>Lyric</span>
            <div className="llane" id="llane"></div>
            <div id="ph"></div>
          </div>
        </div>

        {/* Bảng chỉnh Clip bên dưới timeline */}
        <div className="insp" id="inspClip">
          <div className="field" id="gDur">
            <label htmlFor="iDur">Thời lượng (giây)</label>
            <input id="iDur" type="number" min="0.3" max="600" step="0.1" />
          </div>
          <div className="field" id="gIn" hidden>
            <label htmlFor="iIn">Cắt từ giây</label>
            <input id="iIn" type="number" min="0" step="0.1" />
          </div>
          <div className="field" id="gOut" hidden>
            <label htmlFor="iOut">Đến giây</label>
            <input id="iOut" type="number" min="0" step="0.1" />
          </div>
          <div className="field">
            <label htmlFor="iFit">Khung</label>
            <select id="iFit" defaultValue="cover">
              <option value="cover">Phủ kín</option>
              <option value="contain">Vừa ảnh, nền mờ</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="iFx">Chuyển động</label>
            <select id="iFx"></select>
          </div>
          <div className="field">
            <label htmlFor="iTr">Chuyển cảnh vào</label>
            <select id="iTr"></select>
          </div>
          <div className="field">
            <label htmlFor="iTrD">Thời gian chuyển</label>
            <input id="iTrD" type="number" min="0.1" max="3" step="0.1" />
          </div>
          <div className="field">
            <label htmlFor="iCol">Màu</label>
            <select id="iCol"></select>
          </div>
          <div className="btns">
            <button className="btn sm" id="iL">Dời sang trái</button>
            <button className="btn sm" id="iR">Dời sang phải</button>
            <button className="btn sm" id="iDup">Nhân bản</button>
            <button className="btn sm danger" id="iDel">Xóa clip</button>
            <span className="note" id="iName" style={{ alignSelf: 'center' }}></span>
          </div>
        </div>

        {/* Bảng chỉnh Lyric trực tiếp bên dưới timeline (Requirement 6) */}
        <div className="insp" id="inspLyric" style={{ display: 'none' }}>
          <div className="field" style={{ gridColumn: '1 / -1', minWidth: '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span className="lbl" style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '12px' }}>
                ✏️ Chỉnh câu Lyric trên Timeline
              </span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span id="inspLyrBadge" className="badge success">Câu #1</span>
                <span id="inspLyrDurBadge" className="badge neutral" style={{ fontFamily: 'var(--font-mono)' }}>0.00s</span>
              </div>
            </div>
            <textarea
              id="inspLyrText"
              rows={2}
              style={{ width: '100%', fontSize: '13px', padding: '6px 8px', borderRadius: '6px', background: 'var(--panel2)', border: '1px solid var(--line)', fontFamily: 'var(--font-ui)' }}
              placeholder="Nhập nội dung câu hát..."
            ></textarea>
          </div>

          <div className="field">
            <label htmlFor="inspLyrStart">Bắt đầu (giây)</label>
            <input id="inspLyrStart" type="number" min="0" step="0.05" />
          </div>

          <div className="field">
            <label htmlFor="inspLyrEnd">Kết thúc (giây)</label>
            <input id="inspLyrEnd" type="number" min="0" step="0.05" />
          </div>

          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="inspLyrColor">Màu chữ riêng</label>
              <label className="chk" style={{ fontSize: '10.5px', textTransform: 'none' }}>
                <input id="inspLyrColorDef" type="checkbox" defaultChecked />
                <span>Mặc định</span>
              </label>
            </div>
            <input id="inspLyrColor" type="color" defaultValue="#ffffff" disabled />
          </div>

          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="inspLyrHi">Màu chạy riêng</label>
              <label className="chk" style={{ fontSize: '10.5px', textTransform: 'none' }}>
                <input id="inspLyrHiDef" type="checkbox" defaultChecked />
                <span>Mặc định</span>
              </label>
            </div>
            <input id="inspLyrHi" type="color" defaultValue="#ffd23f" disabled />
          </div>

          <div className="field">
            <label htmlFor="inspLyrSize">Cỡ chữ riêng (để trống = chung)</label>
            <input id="inspLyrSize" type="number" min="0" max="25" step="0.5" placeholder="Để trống = dùng chung" />
          </div>

          <div className="btns" style={{ gridColumn: '1 / -1' }}>
            <button className="btn sm pri" id="btnInspSplitLyr" type="button">✂️ Tách câu tại đầu phát</button>
            <button className="btn sm" id="btnInspMergeNext" type="button">🔗 Gộp câu sau</button>
            <button className="btn sm" id="btnInspAddLyr" type="button">➕ Thêm câu mới</button>
            <button className="btn sm danger" id="btnInspDelLyr" type="button">🗑️ Xóa câu này</button>
            <button className="btn sm" id="btnInspCloseLyr" type="button">Đóng / Về chỉnh clip</button>
            <span className="note" style={{ alignSelf: 'center', marginLeft: 'auto', fontSize: '11px', color: 'var(--muted)' }}>
              Phím tắt: Bấm đúp để sửa chữ | Kéo mép chỉnh giờ | Ctrl+Z hoàn tác | Ctrl+Y làm lại
            </span>
          </div>
        </div>
      </section>

      <div id="exp" hidden>
        <div className="card" role="dialog" aria-labelledby="expT">
          <h2 id="expT">Đang xuất video</h2>
          <p className="note" id="expMsg">
            Giữ tab này mở và đừng chuyển sang tab khác cho tới khi xong. Video được ghi theo thời gian thật.
          </p>
          <div className="bar">
            <i id="expBar"></i>
          </div>
          <video id="expVideo" controls playsInline hidden></video>
          <div className="btns">
            <button className="btn pri" id="expSave" hidden>Lưu video</button>
            <button className="btn" id="expClose">Hủy</button>
          </div>
        </div>
      </div>
      <div id="toast" role="status" hidden></div>
    </div>
  );
}
