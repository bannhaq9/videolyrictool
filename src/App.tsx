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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="defTr">Chuyển cảnh</label>
                  <button type="button" className="btn sm" id="btnPreviewTr" style={{ padding: '2px 8px', fontSize: '11px', height: 'auto', minHeight: 'unset' }} title="Xem thử hiệu ứng trên hai ảnh mẫu">▶ Xem thử</button>
                </div>
                <select id="defTr"></select>
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="defTrD">Thời gian chuyển mặc định (0.1 - 3s)</label>
                <input id="defTrD" type="number" min="0.1" max="3" step="0.1" defaultValue="0.6" />
              </div>
            </div>
            <div className="btns">
              <button className="btn" id="applyAll">Áp dụng cho mọi clip</button>
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

            {/* 2. Cắt nhạc nhanh & Khung hướng dẫn Timeline */}
            <div className="panel" style={{ padding: '10px 12px', display: 'grid', gap: '8px', background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: '8px' }}>
              <span className="lbl" style={{ fontWeight: 700, color: 'var(--fg)', fontSize: '12px' }}>Cắt nhạc trên Timeline</span>
              <p className="note" style={{ margin: 0, fontSize: '11.5px' }}>
                💡 <strong>Kéo tay nắm hai đầu</strong> khối nhạc trên Timeline để cắt. Bấm <strong>✂️ Tách (phím S)</strong> tại đầu phát, hoặc <strong>🗑️ Xóa (phím Del)</strong>.
              </p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>Cắt nhanh:</span>
                <button className="btn sm" id="btnPreset30" type="button">30s (Reels/TikTok)</button>
                <button className="btn sm" id="btnPreset60" type="button">60s (Shorts)</button>
                <button className="btn sm" id="btnPresetAll" type="button">Toàn bài</button>
              </div>
            </div>

            {/* 3. Hiệu ứng Fade & Âm lượng */}
            <div className="panel" style={{ padding: '10px 12px', display: 'grid', gap: '8px', background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: '8px' }}>
              <span className="lbl" style={{ fontWeight: 700, color: 'var(--fg)', fontSize: '12px' }}>Fade & Âm lượng</span>
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

              {/* VU Meter */}
              <div style={{ display: 'grid', gap: '4px', marginTop: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="lbl" style={{ fontSize: '11.5px' }}>Mức âm thanh (VU Meter)</span>
                  <span id="vuVal" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)' }}>0% (Yên lặng)</span>
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
            </div>

            {/* 4. Cài đặt hiệu ứng sóng nhạc trên video (tích hợp) */}
            <div className="panel" style={{ padding: '12px', display: 'grid', gap: '10px', background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: '8px' }}>
              <span className="lbl" style={{ fontWeight: 700, color: 'var(--fg)', fontSize: '12px' }}>Hiệu ứng sóng nhạc trên video</span>
              <div className="field">
                <label htmlFor="vizType">Kiểu hiệu ứng</label>
                <select id="vizType" defaultValue="bars">
                  <option value="bars">Thanh Equalizer (cột đứng)</option>
                  <option value="mirror">Thanh Equalizer (đối xứng)</option>
                  <option value="circle">Sóng tròn quanh logo</option>
                  <option value="wave">Vạch sóng âm chạy ngang</option>
                  <option value="none">Tắt hiệu ứng</option>
                </select>
              </div>

              {/* Khung cấu hình Logo cho sóng tròn */}
              <div className="panel" id="vizLogoBox" style={{ padding: '10px', display: 'grid', gap: '8px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '8px' }} hidden>
                <span className="lbl" style={{ fontWeight: 700, color: 'var(--fg)', fontSize: '12px' }}>Logo tâm sóng tròn</span>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div id="vizLogoPreview" style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#0a0e0f', border: '2px solid var(--accent)', display: 'grid', placeItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    <span id="vizLogoIcon" style={{ fontSize: '18px' }}>🎵</span>
                    <img id="vizLogoImgTag" alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'none' }} />
                  </div>
                  <div style={{ display: 'grid', gap: '4px', flex: 1 }}>
                    <label className="btn sm" htmlFor="vizLogoFile" style={{ cursor: 'pointer', textAlign: 'center' }}>
                      Tải ảnh logo / avatar
                    </label>
                    <input id="vizLogoFile" type="file" accept="image/*" hidden />
                    <button className="btn sm" id="vizLogoClear" type="button">Dùng đĩa than mặc định</button>
                  </div>
                </div>
              </div>

              <div className="row2">
                <div className="field">
                  <label htmlFor="vizColorMode">Kiểu màu</label>
                  <select id="vizColorMode" defaultValue="gradient">
                    <option value="gradient">Chuyển sắc (Gradient)</option>
                    <option value="solid">Đơn sắc (1 màu)</option>
                    <option value="rainbow">Cầu vồng</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="vizBars">Số vạch sóng</label>
                  <select id="vizBars" defaultValue="32">
                    <option value="16">16 vạch</option>
                    <option value="24">24 vạch</option>
                    <option value="32">32 vạch (chuẩn)</option>
                    <option value="48">48 vạch</option>
                    <option value="64">64 vạch</option>
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
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Vị trí nhanh:</span>
                <button className="btn sm" id="btnVizPosBottom" type="button">Đáy (82%)</button>
                <button className="btn sm" id="btnVizPosCenter" type="button">Giữa (50%)</button>
                <button className="btn sm" id="btnVizPosTop" type="button">Đỉnh (20%)</button>
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
                <input id="vizGlow" type="checkbox" defaultChecked /> Phát sáng Neon (Glow)
              </label>
            </div>

            {/* 5. Xuất nhạc đã cắt */}
            <div style={{
              padding: '10px 12px',
              background: 'rgba(45, 212, 191, 0.08)',
              border: '1px solid rgba(45, 212, 191, 0.28)',
              borderRadius: '8px',
              display: 'grid',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text)' }}>
                  ✂️ Xuất file nhạc đã cắt
                </span>
                <span id="exportAudioStatus" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  Đoạn chọn + Âm lượng + Fade
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                <button className="btn sm pri" id="btnExportTrimWav" type="button" style={{ flex: '1 1 120px' }}>
                  ⬇ Xuất WAV
                </button>
                <button className="btn sm" id="btnExportTrimMp3" type="button" style={{ flex: '1 1 120px' }}>
                  ⬇ Xuất MP3
                </button>
              </div>
            </div>

            <div className="btns">
              <button className="btn" id="fitMusic">Chia đều ảnh theo nhạc</button>
              <button className="btn danger" id="rmAudio">Bỏ nhạc</button>
            </div>
          </div>

          <div className="tabpane" data-pane="lyric" hidden>
            {/* Thanh điều hướng 3 Bước (Stepper) */}
            <div className="lyr-stepper" role="tablist" aria-label="Các bước cài đặt Lyric">
              <button type="button" className="lyr-step-btn active" id="btnLyrStep1" data-step="1">
                <span className="step-num">1</span>
                <span className="step-title">Nhập lời</span>
              </button>
              <button type="button" className="lyr-step-btn" id="btnLyrStep2" data-step="2">
                <span className="step-num">2</span>
                <span className="step-title">Căn giờ</span>
              </button>
              <button type="button" className="lyr-step-btn" id="btnLyrStep3" data-step="3">
                <span className="step-num">3</span>
                <span className="step-title">Chỉnh sửa</span>
              </button>
            </div>

            {/* BƯỚC 1: NHẬP LỜI */}
            <div id="lyrStep1Pane" className="lyr-step-content" style={{ display: 'grid', gap: '10px' }}>
              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="lyrRawInput" style={{ fontWeight: 700 }}>Dán lời bài hát thường (mỗi dòng một câu)</label>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Không cần gõ số giây</span>
                </div>
                <textarea
                  id="lyrRawInput"
                  rows={8}
                  spellCheck={false}
                  placeholder={'Dán lời bài hát vào đây, mỗi dòng là một câu.\nVí dụ:\nÁnh đèn vàng soi bóng em\nBước chân nhẹ trong đêm dài\nNỗi nhớ này biết gửi về đâu...'}
                  style={{ width: '100%', resize: 'vertical', lineHeight: '1.5', fontSize: '13px' }}
                ></textarea>
              </div>

              <div className="btns" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn pri" id="btnParseLyrics" type="button" style={{ flex: 1, minWidth: '160px' }}>
                  ⚡ Tạo danh sách câu
                </button>
                <label className="btn" htmlFor="fileLrc" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} title="Nhập file lời có sẵn mốc giờ">
                  📁 Nhập file .lrc / .srt
                </label>
                <input id="fileLrc" type="file" accept=".lrc,.srt,.txt,text/plain" hidden />
              </div>

              <p className="note" style={{ margin: 0, fontSize: '11.5px' }}>
                💡 <strong>Gợi ý:</strong> Bạn có thể quay lại sửa lời bất cứ lúc nào. Hệ thống tự động so khớp theo vị trí dòng để giữ nguyên mốc giờ của các câu đã căn trước đó.
              </p>
            </div>

            {/* BƯỚC 2: CĂN GIỜ (TAP-TO-SYNC) */}
            <div id="lyrStep2Pane" className="lyr-step-content" style={{ display: 'none', gap: '12px' }}>
              <div className="lyr-tap-stage">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px' }}>
                  <span id="lyrTapCounter" className="badge success" style={{ fontSize: '11.5px', padding: '3px 8px' }}>
                    Câu 1 / 1
                  </span>
                  <span style={{ color: 'var(--muted)' }}>Phím tắt: <strong>Space</strong> (Bắt đầu câu)</span>
                </div>

                {/* Câu trước mờ đi */}
                <div id="lyrTapPrev" className="lyr-tap-prev">
                  (Bắt đầu từ câu đầu tiên)
                </div>

                {/* Câu kế tiếp rất to, nổi bật */}
                <div id="lyrTapCurrent" className="lyr-tap-current">
                  (Chưa có lời bài hát. Hãy nhập lời ở Bước 1)
                </div>

                {/* Câu sau nữa xem trước */}
                <div id="lyrTapNext" className="lyr-tap-next"></div>

                {/* Nút to để bắt nhịp */}
                <button
                  className="btn pri"
                  id="btnTapMarkNow"
                  type="button"
                  style={{
                    padding: '14px',
                    fontSize: '15px',
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    boxShadow: '0 4px 16px color-mix(in srgb,var(--accent) 35%,transparent)'
                  }}
                >
                  ⚡ Bắt đầu câu này (Phím Space)
                </button>
              </div>

              {/* Điều khiển hỗ trợ bắt nhịp */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>Tốc độ:</span>
                  <div className="seg" role="group" aria-label="Tốc độ căn giờ">
                    <button type="button" id="btnTapSpeed075" data-speed="0.75" style={{ padding: '3px 8px', fontSize: '12px' }}>0.75x</button>
                    <button type="button" id="btnTapSpeed1" data-speed="1.0" aria-pressed="true" style={{ padding: '3px 8px', fontSize: '12px' }}>1x</button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn sm" id="btnTapUndoLine" type="button" title="Hoàn tác câu vừa bấm và lùi nhạc 3s (Ctrl+Z)">
                    ↩ Hoàn tác lần bấm cuối
                  </button>
                  <button className="btn sm" id="btnTapSkipLine" type="button" title="Bỏ qua không căn câu này">
                    ⏩ Bỏ qua
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px', borderTop: '1px solid var(--line)' }}>
                <button className="btn sm pri" id="btnTapGoStep3" type="button">
                  Chuyển sang Bước 3 (Chỉnh sửa) ➔
                </button>
              </div>
            </div>

            {/* BƯỚC 3: CHỈNH SỬA (DANH SÁCH THẺ) */}
            <div id="lyrStep3Pane" className="lyr-step-content" style={{ display: 'none', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <button className="btn sm pri" id="btnCardAddAtHead" type="button" title="Thêm câu mới ngay vị trí đầu phát hiện tại">
                  ➕ Thêm câu tại đầu phát
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span id="lyrCardsTotalBadge" className="badge neutral">0 câu</span>
                  <button className="btn sm" id="btnBackToStep2" type="button" title="Quay lại căn giờ tự động">
                    🎙️ Căn lại giờ
                  </button>
                </div>
              </div>

              {/* Danh sách thẻ cuộn */}
              <div className="lyr-cards-list" id="lyrCardsList">
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '12.5px' }}>
                  Chưa có danh sách câu. Hãy nhập lời ở <strong>Bước 1</strong>.
                </div>
              </div>

              {/* Mục Nâng cao (thu gọn mặc định) */}
              <details className="panel" style={{ padding: '8px 10px', background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: '6px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '12px', color: 'var(--fg)', userSelect: 'none' }}>
                  ⚙️ Nâng cao (Dịch giờ, Xóa giờ...)
                </summary>
                <div style={{ display: 'grid', gap: '10px', marginTop: '10px' }}>
                  <div className="row2">
                    <div className="field">
                      <label htmlFor="shiftV">Dịch tất cả giờ (giây)</label>
                      <input id="shiftV" type="number" step="0.1" defaultValue="0.3" />
                    </div>
                    <div className="field">
                      <label>&nbsp;</label>
                      <div className="btns">
                        <button className="btn sm" id="shiftMinus" type="button">Sớm lại (-)</button>
                        <button className="btn sm" id="shiftPlus" type="button">Trễ ra (+)</button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button className="btn sm danger" id="lyrClearAllTimes" type="button" title="Xóa hết giờ, đưa về chưa căn">
                      🗑️ Xóa toàn bộ giờ (giữ nguyên chữ)
                    </button>
                  </div>
                </div>
              </details>
            </div>

            {/* Input ẩn để tương thích code & xuất text chuẩn */}
            <textarea id="lyr" style={{ display: 'none' }}></textarea>
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
              <button className="ib pri" id="bPlay" type="button" aria-label="Phát" title="Phát / Tạm dừng (Phím Space)">
                <svg viewBox="0 0 24 24" width="18" height="18"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
              </button>
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
          <div className="btns" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn sm" id="btnTlUndo" type="button" title="Hoàn tác (Ctrl+Z)" disabled>
              ↩ Hoàn tác
            </button>
            <button className="btn sm" id="btnTlRedo" type="button" title="Làm lại (Ctrl+Y)" disabled>
              ↪ Làm lại
            </button>
            <label className="btn sm pri" htmlFor="fileMedia2" style={{ cursor: 'pointer' }} title="Thêm ảnh hoặc video">
              + Thêm clip
            </label>
            <input id="fileMedia2" type="file" accept="image/*,video/*" multiple hidden />
            <button className="btn sm" id="btnTlSplit" type="button" title="Cắt tách nhạc hoặc clip tại đầu phát (Phím S)">
              ✂️ Tách (S)
            </button>
            <button className="btn sm danger" id="btnTlDelete" type="button" title="Xóa phần đang chọn (Phím Delete)">
              🗑️ Xóa (Del)
            </button>
            <button className="btn sm" id="btnTlCloseGaps" type="button" title="Xóa khoảng trống, nối liền các đoạn nhạc">
              ⚡ Nối khoảng trống
            </button>
            <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', marginLeft: '2px', borderLeft: '1px solid var(--line)', paddingLeft: '6px' }}>
              <button className="btn sm" id="btnTlPre30" type="button" title="Cắt nhanh 30s cho Reels / TikTok">30s</button>
              <button className="btn sm" id="btnTlPre60" type="button" title="Cắt nhanh 60s cho Shorts">60s</button>
              <button className="btn sm" id="btnTlPreAll" type="button" title="Lấy toàn bộ bài hát">Toàn bài</button>
            </div>
            {/* Fade in / fade out cho khối nhạc (0s, 1s, 2s, 3s) */}
            <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', borderLeft: '1px solid var(--line)', paddingLeft: '6px' }} title="Fade in / Fade out cho đoạn nhạc">
              <span style={{ fontSize: '11px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Fade:</span>
              <select id="tlFadeIn" title="Fade vào đầu bài (giây)" defaultValue="0" style={{ padding: '2px 4px', fontSize: '11px', height: '26px', background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: '4px', color: 'var(--fg)' }}>
                <option value="0">Vào 0s</option>
                <option value="1">Vào 1s</option>
                <option value="2">Vào 2s</option>
                <option value="3">Vào 3s</option>
              </select>
              <select id="tlFadeOut" title="Fade ra đuôi bài (giây)" defaultValue="1" style={{ padding: '2px 4px', fontSize: '11px', height: '26px', background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: '4px', color: 'var(--fg)' }}>
                <option value="0">Ra 0s</option>
                <option value="1">Ra 1s</option>
                <option value="2">Ra 2s</option>
                <option value="3">Ra 3s</option>
              </select>
            </div>
            <button className="btn sm" id="tSplit" style={{ display: 'none' }}>Cắt tại đầu phát</button>
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

          <div className="zoom" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button className="btn sm" id="btnTlFitZoom" type="button" title="Thu phóng vừa toàn bộ timeline" style={{ padding: '2px 7px', fontSize: '11px', whiteSpace: 'nowrap' }}>
              📐 Vừa khung
            </button>
            <input id="zoom" type="range" min="15" max="200" step="5" defaultValue="60" style={{ width: '75px' }} title="Thu phóng timeline" />
            <button className="btn sm" id="btnKbShortcuts" type="button" title="Xem danh sách phím tắt (Keyboard shortcuts)" style={{ padding: '2px 6px', fontSize: '13px' }}>
              ⌨️
            </button>
          </div>
        </div>
        <div className="tl-body">
          <div className="tl-headers" aria-hidden="true">
            <div style={{ height: '22px', borderBottom: '1px solid var(--line)' }}></div>
            <div className="tl-header-lbl" style={{ top: '30px', height: '76px' }}>CLIP</div>
            <div className="tl-header-lbl" style={{ top: '110px', height: '46px' }}>NHẠC</div>
            <div className="tl-header-lbl" style={{ top: '160px', height: '32px' }}>LYRIC</div>
          </div>
          <div className="tl-scroll" id="tlScroll" style={{ flex: 1, minWidth: 0 }}>
            <div className="tl" id="tl">
              <div className="ruler" id="ruler"></div>
              <div id="clips"></div>
              <div className="alane" id="alane"></div>
              <div className="llane" id="llane"></div>
              <div id="ph"></div>
              <div id="audioDragTip" className="audio-time-tip" style={{ display: 'none' }}></div>
            </div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="iTr">Chuyển cảnh vào</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button type="button" className="btn sm" id="btnPreviewClipTr" style={{ padding: '2px 8px', fontSize: '11px', height: 'auto', minHeight: 'unset' }} title="Xem thử hiệu ứng chuyển cảnh này">▶ Xem thử</button>
                <button type="button" className="btn sm" id="btnApplyClipTrAll" style={{ padding: '2px 8px', fontSize: '11px', height: 'auto', minHeight: 'unset' }} title="Áp dụng chuyển cảnh này cho tất cả chỗ nối">Áp dụng tất cả</button>
              </div>
            </div>
            <select id="iTr"></select>
          </div>
          <div className="field">
            <label htmlFor="iTrD">Thời gian chuyển (0.1 - 3s, tối đa 50% clip)</label>
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
      <div id="shortcutsModal" hidden style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 65, display: 'grid', placeItems: 'center', padding: '16px' }}>
        <div className="card" role="dialog" aria-labelledby="scTitle" style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', width: 'min(100%, 460px)', display: 'grid', gap: '14px', boxShadow: '0 12px 36px rgba(0,0,0,0.75)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 id="scTitle" style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--fg)' }}>
              <span>⌨️</span> Danh sách phím tắt
            </h2>
            <button className="btn sm" id="btnCloseShortcuts" type="button" style={{ padding: '2px 8px', fontSize: '13px' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gap: '8px', fontSize: '12.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)' }}>Phát / Tạm dừng</span>
              <kbd style={{ background: 'var(--panel2)', border: '1px solid var(--line)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)' }}>Space</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)' }}>Cắt tách tại đầu phát (nhạc / clip)</span>
              <kbd style={{ background: 'var(--panel2)', border: '1px solid var(--line)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)' }}>S</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)' }}>Xóa phần đang chọn (nhạc, clip, lyric)</span>
              <kbd style={{ background: 'var(--panel2)', border: '1px solid var(--line)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#f87171' }}>Delete / Backspace</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)' }}>Hoàn tác thao tác</span>
              <kbd style={{ background: 'var(--panel2)', border: '1px solid var(--line)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--fg)' }}>Ctrl + Z</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)' }}>Làm lại thao tác</span>
              <kbd style={{ background: 'var(--panel2)', border: '1px solid var(--line)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--fg)' }}>Ctrl + Y / Ctrl + Shift + Z</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)' }}>Tắt / Bật tiếng</span>
              <kbd style={{ background: 'var(--panel2)', border: '1px solid var(--line)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--fg)' }}>M</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)' }}>Tăng / Giảm âm lượng 5%</span>
              <kbd style={{ background: 'var(--panel2)', border: '1px solid var(--line)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--fg)' }}>▲ / ▼</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)' }}>Sửa chữ câu lyric trực tiếp</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#ffd23f' }}>Bấm đúp (Double-click)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)' }}>Kéo mép / thân khối clip</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#00f0ff' }}>Co giãn thời lượng / Đổi thứ tự clip</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
              <span style={{ color: 'var(--muted)' }}>Kéo mép / kéo thân khối nhạc</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#38bdf8' }}>Cắt đầu đuôi / Dời vị trí</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button className="btn pri sm" id="btnOkShortcuts" type="button">Đã hiểu (Esc)</button>
          </div>
        </div>
      </div>

      {/* Clipchamp-style Transition Modal */}
      <div id="transitionModal" hidden style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 66, display: 'grid', placeItems: 'center', padding: '16px' }}>
        <div className="card" role="dialog" aria-labelledby="trModalTitle" style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '14px', padding: '18px 20px', width: 'min(100%, 720px)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 16px 40px rgba(0,0,0,0.85)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>✨</span>
              <div>
                <h2 id="trModalTitle" style={{ margin: 0, fontSize: '15px', color: 'var(--fg)', fontWeight: 700 }}>
                  Hiệu ứng chuyển cảnh
                </h2>
                <span id="trModalSeamBadge" style={{ fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                  Chỗ nối clip
                </span>
              </div>
            </div>
            <button className="btn sm" id="btnTrModalClose" type="button" style={{ padding: '3px 9px', fontSize: '13px' }}>✕</button>
          </div>

          {/* Nhóm danh mục hiệu ứng */}
          <div id="trCatTabs" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            {/* Populated dynamically */}
          </div>

          {/* Lưới các hiệu ứng có animation xem trước */}
          <div id="trGrid" style={{ flex: 1, minHeight: '220px', maxHeight: '340px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px', padding: '4px' }}>
            {/* Populated dynamically */}
          </div>

          {/* Thanh chỉnh thời lượng chuyển cảnh */}
          <div style={{ background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '220px' }}>
              <label htmlFor="trModalDur" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--fg)', whiteSpace: 'nowrap' }}>
                Thời gian chuyển:
              </label>
              <input id="trModalDur" type="range" min="0.1" max="3.0" step="0.1" defaultValue="1.0" style={{ flex: 1, accentColor: '#00f0ff' }} />
              <span id="trModalDurVal" style={{ minWidth: '42px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '12px', color: '#00f0ff', background: 'rgba(0,240,255,0.12)', border: '1px solid rgba(0,240,255,0.3)', padding: '2px 6px', borderRadius: '4px' }}>
                1.0s
              </span>
            </div>
            <span id="trModalDurHint" style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
              (Tự giới hạn tối đa 50% độ dài clip ngắn hơn)
            </span>
          </div>

          {/* Thanh công cụ thao tác */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '4px', borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn sm" id="btnTrModalPreview" type="button" title="Xem thử hiệu ứng này kèm 1s trước và 1s sau điểm nối">
                ▶ Xem thử chỗ nối
              </button>
              <button className="btn sm" id="btnTrModalApplyAll" type="button" title="Áp dụng hiệu ứng và thời gian này cho tất cả chỗ nối giữa các clip">
                Áp dụng cho tất cả chỗ nối
              </button>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button className="btn sm danger" id="btnTrModalRemove" type="button" title="Hủy chuyển cảnh tại chỗ nối này">
                Cắt thẳng (Không chuyển)
              </button>
              <button className="btn pri sm" id="btnTrModalDone" type="button">
                Xong
              </button>
            </div>
          </div>
        </div>
      </div>

      <div id="toast" role="status" hidden></div>
    </div>
  );
}
