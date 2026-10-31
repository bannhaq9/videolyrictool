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
    <div className="studio-app">
      {/* 1. THANH TRÊN CÙNG (56px) */}
      <header className="studio-header">
        <div className="header-left">
          <div className="brand-badge" title="Lyric Video Studio">
            <span className="brand-icon">♫</span>
            <span>Lyric Video Studio</span>
          </div>

          <div className="project-title-box">
            <input
              id="projectTitleInput"
              type="text"
              defaultValue="Dự án chưa đặt tên"
              title="Bấm để đổi tên dự án"
              className="project-title-input"
            />
            <span className="project-edit-icon">✎</span>
          </div>
        </div>

        <div className="header-center">
          <button type="button" className="header-btn" id="btnTopUndo" title="Hoàn tác (Ctrl+Z)" disabled>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
              <path d="M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
            </svg>
            <span>Hoàn tác</span>
          </button>
          <button type="button" className="header-btn" id="btnTopRedo" title="Làm lại (Ctrl+Y)" disabled>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
              <path d="M18.4 10.6C16.55 9 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/>
            </svg>
            <span>Làm lại</span>
          </button>
        </div>

        <div className="header-right">
          <div className="segmented-control" role="group" aria-label="Tỷ lệ khung hình">
            <button id="oV" aria-pressed="true" title="Khung dọc 9:16 (TikTok, Reels, Shorts)">
              <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor"><rect x="4" y="1" width="8" height="14" rx="1.5" /></svg>
              <span>9:16</span>
            </button>
            <button id="oH" aria-pressed="false" title="Khung ngang 16:9 (YouTube, Máy tính)">
              <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor"><rect x="1" y="4" width="14" height="8" rx="1.5" /></svg>
              <span>16:9</span>
            </button>
          </div>

          <select id="res" aria-label="Độ phân giải" className="quality-select">
            <option value="720">720p (nhanh)</option>
            <option value="1080">1080p (nét)</option>
          </select>

          <button className="btn-export-teal" id="btnExport" type="button" title="Xuất video hoàn chỉnh">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7"/>
            </svg>
            <span>Xuất video</span>
          </button>
        </div>
      </header>

      {/* 2. VÙNG GIỮA (MIDDLE WORKSPACE) */}
      <div className="studio-middle">
        {/* DOCK ICON BÊN TRÁI (64px) */}
        <nav className="nav-dock" aria-label="Thanh công cụ">
          <button type="button" className="nav-dock-btn active" data-tab="media" title="Thư viện tệp ảnh & video">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
            </svg>
            <span>Thư viện</span>
          </button>

          <button type="button" className="nav-dock-btn" data-tab="music" title="Quản lý nhạc & âm thanh">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
            <span>Nhạc</span>
          </button>

          <button type="button" className="nav-dock-btn" data-tab="visual" title="Hiệu ứng sóng nhạc">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
            </svg>
            <span>Sóng nhạc</span>
          </button>

          <button type="button" className="nav-dock-btn" data-tab="lyric" title="Căn chỉnh lời bài hát (Lyric)">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V8h10v2z"/>
            </svg>
            <span>Lyric</span>
          </button>

          <button type="button" className="nav-dock-btn" data-tab="text" title="Định dạng chữ & Font">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M5 4v3h5.5v12h3V7H19V4H5z"/>
            </svg>
            <span>Chữ</span>
          </button>
        </nav>

        {/* PANEL NỘI DUNG BÊN TRÁI (320px) */}
        <aside className="studio-drawer" id="studioDrawer" aria-label="Bảng nội dung tab">
          <div className="drawer-header">
            <span id="drawerTitle">Thư viện media</span>
            <button type="button" className="btn sm" id="btnToggleDrawer" title="Thu gọn / Mở rộng bảng">⇥</button>
          </div>

          <div className="drawer-scroll">
            {/* TAB THƯ VIỆN */}
            <div className="tabpane" data-pane="media">
              <label className="import-purple-btn" htmlFor="fileMedia">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>+ Thêm tệp media</span>
              </label>
              <input id="fileMedia" type="file" accept="image/*,video/*" multiple hidden />

              <div className="field">
                <label>Tệp media đã thêm</label>
                <div id="mediaDrawerCards" className="media-drawer-cards-grid"></div>
              </div>

              <label className="drop" id="drop1" htmlFor="fileMedia">
                <strong>Kéo thả tệp vào đây</strong>
                <span>Chọn được nhiều ảnh và video cùng lúc</span>
              </label>
              <p className="note" id="sampleNote">Đang dùng mẫu "Hoa nở bên tường.jpg". Thêm tệp của bạn thì mẫu sẽ tự cập nhật.</p>

              <div className="row2">
                <div className="field">
                  <label htmlFor="defDur">Giây mỗi ảnh</label>
                  <input id="defDur" type="number" min="0.5" max="60" step="0.5" defaultValue="4" />
                </div>
                <div className="field">
                  <label htmlFor="defFit">Khung ảnh</label>
                  <select id="defFit" defaultValue="cover">
                    <option value="cover">Phủ kín khung (Cover)</option>
                    <option value="contain">Vừa ảnh, nền mờ (Contain)</option>
                  </select>
                </div>
              </div>

              <div className="row2">
                <div className="field">
                  <label htmlFor="defFx">Chuyển động</label>
                  <select id="defFx"></select>
                </div>
                <div className="field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label htmlFor="defTr">Chuyển cảnh</label>
                    <button type="button" className="btn sm" id="btnPreviewTr" style={{ padding: '2px 6px', fontSize: '10.5px' }}>▶ Xem</button>
                  </div>
                  <select id="defTr"></select>
                </div>
              </div>

              <div className="field">
                <label htmlFor="defTrD">Thời gian chuyển (0.1 - 3s)</label>
                <input id="defTrD" type="number" min="0.1" max="3" step="0.1" defaultValue="0.6" />
              </div>

              <button className="btn" id="applyAll" type="button">Áp dụng cho mọi clip</button>
            </div>

            {/* TAB NHẠC */}
            <div className="tabpane" data-pane="music" hidden>
              <label className="drop" htmlFor="fileAudio">
                <strong>Chọn file nhạc của bạn</strong>
                <span>Hỗ trợ MP3, M4A, WAV, OGG</span>
              </label>
              <input id="fileAudio" type="file" accept="audio/*" hidden />
              <p className="note" id="audioInfo">Chưa có nhạc. Video vẫn xem và xuất được bình thường.</p>

              <div className="field" id="audioStatusBox" style={{ padding: '10px', background: 'var(--panel2)', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span className="lbl" style={{ margin: 0 }}>Trạng thái âm thanh</span>
                  <span id="astCtxBadge" className="badge neutral">AudioContext</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '3px 6px', fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--muted)' }}>File:</span>
                  <span id="astName" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Chưa chọn</span>
                  <span style={{ color: 'var(--muted)' }}>Độ dài:</span>
                  <span id="astDur">00:00.00</span>
                  <span style={{ color: 'var(--muted)' }}>AudioCtx:</span>
                  <span id="astCtx">chưa chạy</span>
                  <span style={{ color: 'var(--muted)' }}>Lỗi:</span>
                  <span id="astError" style={{ color: 'var(--danger)', wordBreak: 'break-word' }}>Không có lỗi</span>
                </div>
                <div className="btns" style={{ marginTop: '8px' }}>
                  <button className="btn sm pri" id="btnResumeCtx" type="button">Kích hoạt âm thanh</button>
                  <button className="btn sm" id="btnReloadAudio" type="button">Tải lại nhạc</button>
                </div>
              </div>

              <div className="field">
                <label>Cắt nhanh theo thời lượng</label>
                <div className="btns">
                  <button className="btn sm" id="btnPreset30" type="button">30s (TikTok/Reels)</button>
                  <button className="btn sm" id="btnPreset60" type="button">60s (Shorts)</button>
                  <button className="btn sm" id="btnPresetAll" type="button">Toàn bài</button>
                </div>
              </div>

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

              <div className="field">
                <label htmlFor="aVol">Âm lượng tổng</label>
                <input id="aVol" type="range" min="0" max="1" step="0.01" defaultValue="1" />
              </div>

              <div style={{ padding: '10px', background: 'var(--accent-subtle)', border: '1px solid var(--accent)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '11.5px', color: 'var(--fg)' }}>✂️ Xuất âm thanh đã chỉnh</span>
                  <span id="exportAudioStatus" style={{ fontSize: '10.5px', color: 'var(--muted)' }}>WAV / MP3</span>
                </div>
                <div className="btns">
                  <button className="btn sm pri" id="btnExportTrimWav" type="button">⬇ Xuất WAV</button>
                  <button className="btn sm" id="btnExportTrimMp3" type="button">⬇ Xuất MP3</button>
                </div>
              </div>

              <div className="btns">
                <button className="btn sm" id="fitMusic" type="button">Chia đều ảnh theo nhạc</button>
                <button className="btn sm danger" id="rmAudio" type="button">Bỏ nhạc</button>
              </div>
            </div>

            {/* TAB SÓNG NHẠC */}
            <div className="tabpane" data-pane="visual" hidden>
              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>13 Mẫu sóng nhạc (1-Click)</label>
                  <span style={{ fontSize: '10.5px', color: 'var(--accent)' }}>Sắc nét</span>
                </div>
                <div className="viz-preset-grid">
                  <button type="button" className="viz-preset-btn active-preset" data-preset-key="tiktok" data-preset-type="bars">
                    <span className="viz-icon">📊</span>
                    <span className="viz-name">TikTok Viral</span>
                    <span className="viz-sub">Equalizer</span>
                  </button>
                  <button type="button" className="viz-preset-btn" data-preset-key="lofi" data-preset-type="ribbon">
                    <span className="viz-icon">✨</span>
                    <span className="viz-name">Lofi Chill</span>
                    <span className="viz-sub">Dải lụa</span>
                  </button>
                  <button type="button" className="viz-preset-btn" data-preset-key="vinyl" data-preset-type="circle">
                    <span className="viz-icon">💿</span>
                    <span className="viz-name">Đĩa Than</span>
                    <span className="viz-sub">Sóng tròn</span>
                  </button>
                  <button type="button" className="viz-preset-btn" data-preset-key="ecg" data-preset-type="ecg">
                    <span className="viz-icon">💓</span>
                    <span className="viz-name">Nhịp Tim</span>
                    <span className="viz-sub">Laser ECG</span>
                  </button>
                  <button type="button" className="viz-preset-btn" data-preset-key="edm" data-preset-type="ring">
                    <span className="viz-icon">⚡</span>
                    <span className="viz-name">EDM Ring</span>
                    <span className="viz-sub">Xung kích</span>
                  </button>
                  <button type="button" className="viz-preset-btn" data-preset-key="stereo" data-preset-type="stereo">
                    <span className="viz-icon">↔️</span>
                    <span className="viz-name">Stereo 2 Bên</span>
                    <span className="viz-sub">Hai mép</span>
                  </button>
                  <button type="button" className="viz-preset-btn" data-preset-key="cyber" data-preset-type="polygon">
                    <span className="viz-icon">⬢</span>
                    <span className="viz-name">Lục Giác</span>
                    <span className="viz-sub">Cyber Core</span>
                  </button>
                  <button type="button" className="viz-preset-btn" data-preset-key="led" data-preset-type="dots">
                    <span className="viz-icon">🎛️</span>
                    <span className="viz-name">Ma Trận LED</span>
                    <span className="viz-sub">Retro dots</span>
                  </button>
                  <button type="button" className="viz-preset-btn" data-preset-key="flame" data-preset-type="flame">
                    <span className="viz-icon">🔥</span>
                    <span className="viz-name">Ngọn Lửa</span>
                    <span className="viz-sub">Spikes</span>
                  </button>
                  <button type="button" className="viz-preset-btn" data-preset-key="mountain" data-preset-type="mountain">
                    <span className="viz-icon">⛰️</span>
                    <span className="viz-name">Dãy Núi 3D</span>
                    <span className="viz-sub">Synthwave</span>
                  </button>
                  <button type="button" className="viz-preset-btn" data-preset-key="blob" data-preset-type="blob">
                    <span className="viz-icon">💧</span>
                    <span className="viz-name">Giọt Nước</span>
                    <span className="viz-sub">Liquid</span>
                  </button>
                  <button type="button" className="viz-preset-btn" data-preset-key="mirror" data-preset-type="mirror">
                    <span className="viz-icon">🪞</span>
                    <span className="viz-name">Đối Xứng</span>
                    <span className="viz-sub">Gương lật</span>
                  </button>
                  <button type="button" className="viz-preset-btn" data-preset-key="wave" data-preset-type="wave">
                    <span className="viz-icon">〰️</span>
                    <span className="viz-name">Sóng Biển</span>
                    <span className="viz-sub">Oscilloscope</span>
                  </button>
                </div>
              </div>

              <div className="field">
                <label htmlFor="vizType">Kiểu sóng âm</label>
                <select id="vizType" defaultValue="bars">
                  <option value="bars">📊 Thanh Equalizer (Cột đứng + Hạt đỉnh)</option>
                  <option value="mirror">🪞 Thanh Equalizer đối xứng (Gương lật)</option>
                  <option value="circle">💿 Sóng tròn 360° đĩa than / Avatar</option>
                  <option value="wave">〰️ Vạch sóng âm chạy ngang</option>
                  <option value="dots">🎛️ Ma trận bóng LED xếp tầng</option>
                  <option value="ribbon">✨ Dải lụa Neon uốn lượn</option>
                  <option value="ring">⚡ Sóng xung kích tỏa tròn</option>
                  <option value="ecg">💓 Nhịp đập tim Laser</option>
                  <option value="polygon">⬢ Lục giác năng lượng Cyber</option>
                  <option value="stereo">↔️ Thanh sóng 2 bên mép màn hình</option>
                  <option value="flame">🔥 Ngọn lửa Cyber Spikes</option>
                  <option value="blob">💧 Giọt nước âm thanh Liquid</option>
                  <option value="mountain">⛰️ Rặng núi 3D Synthwave</option>
                  <option value="none">❌ Tắt sóng nhạc</option>
                </select>
              </div>

              <div className="field" id="vizLogoBox" hidden>
                <label>Logo / Avatar đĩa than</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <img id="vizLogoImgTag" alt="Logo preview" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', display: 'none' }} />
                  <span id="vizLogoIcon" style={{ fontSize: '20px' }}>🎵</span>
                  <label className="btn sm" htmlFor="vizLogoFile" style={{ cursor: 'pointer' }}>Tải ảnh logo</label>
                  <input id="vizLogoFile" type="file" accept="image/*" hidden />
                  <button className="btn sm" id="vizLogoClear" type="button">Mặc định</button>
                </div>
              </div>

              <div className="row2">
                <div className="field">
                  <label htmlFor="vizColor">Màu chính</label>
                  <input id="vizColor" type="color" defaultValue="#14b8a6" />
                </div>
                <div className="field" id="vizColor2Box">
                  <label htmlFor="vizColor2">Màu phụ / Gradient</label>
                  <input id="vizColor2" type="color" defaultValue="#00f0ff" />
                </div>
              </div>

              <div className="row2">
                <div className="field">
                  <label htmlFor="vizY">Vị trí Y: <span id="vizYLbl">82%</span></label>
                  <input id="vizY" type="range" min="10" max="90" step="1" defaultValue="82" />
                </div>
                <div className="field">
                  <label htmlFor="vizX">Vị trí X: <span id="vizXLbl">50%</span></label>
                  <input id="vizX" type="range" min="10" max="90" step="1" defaultValue="50" />
                </div>
              </div>

              <div className="row2">
                <div className="field">
                  <label htmlFor="vizSize">Độ lớn: <span id="vizSizeLbl">1.0x</span></label>
                  <input id="vizSize" type="range" min="0.3" max="2.5" step="0.05" defaultValue="1" />
                </div>
                <div className="field">
                  <label htmlFor="vizSens">Độ nhạy Bass: <span id="vizSensLbl">1.2x</span></label>
                  <input id="vizSens" type="range" min="0.4" max="3.0" step="0.1" defaultValue="1.2" />
                </div>
              </div>

              <label className="chk">
                <input id="vizGlow" type="checkbox" defaultChecked /> Phát sáng Neon (Glow)
              </label>
            </div>

            {/* TAB LYRIC */}
            <div className="tabpane" data-pane="lyric" hidden>
              <div className="lyr-stepper" role="tablist">
                <button type="button" className="lyr-step-btn active" id="btnLyrStep1" data-step="1">1. Nhập lời</button>
                <button type="button" className="lyr-step-btn" id="btnLyrStep2" data-step="2">2. Căn giờ</button>
                <button type="button" className="lyr-step-btn" id="btnLyrStep3" data-step="3">3. Chỉnh sửa</button>
              </div>

              <div id="lyrStep1Pane" style={{ display: 'grid', gap: '8px' }}>
                <div className="field">
                  <label htmlFor="lyrRawInput">Dán lời bài hát (mỗi dòng một câu)</label>
                  <textarea id="lyrRawInput" rows={7} placeholder="Hoa nở bên tường ai ngóng trông..."></textarea>
                </div>
                <div className="btns">
                  <button className="btn pri" id="btnParseLyrics" type="button" style={{ flex: 1 }}>⚡ Tạo danh sách câu</button>
                  <label className="btn" htmlFor="fileLrc" style={{ cursor: 'pointer' }}>📁 File .lrc / .srt</label>
                  <input id="fileLrc" type="file" accept=".lrc,.srt,.txt,text/plain" hidden />
                </div>
              </div>

              <div id="lyrStep2Pane" style={{ display: 'none', gap: '10px' }}>
                <div className="lyr-tap-stage">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span id="lyrTapCounter" className="badge success">Câu 1 / 1</span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Phím <strong>Space</strong></span>
                  </div>
                  <div id="lyrTapPrev" style={{ fontSize: '11px', color: 'var(--muted)' }}>(Bắt đầu từ câu đầu tiên)</div>
                  <div id="lyrTapCurrent" className="lyr-tap-current">(Chưa có lời. Nhập lời ở Bước 1)</div>
                  <div id="lyrTapNext" style={{ fontSize: '11px', color: 'var(--muted)' }}></div>
                  <button className="btn pri" id="btnTapMarkNow" type="button" style={{ padding: '12px', fontSize: '14px', fontWeight: 700 }}>
                    ⚡ Bắt đầu câu này (Phím Space)
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                  <button className="btn sm" id="btnTapUndoLine" type="button">↩ Hoàn tác</button>
                  <button className="btn sm" id="btnTapSkipLine" type="button">⏩ Bỏ qua</button>
                  <button className="btn sm pri" id="btnTapGoStep3" type="button">Bước 3 ➔</button>
                </div>
              </div>

              <div id="lyrStep3Pane" style={{ display: 'none', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button className="btn sm pri" id="btnCardAddAtHead" type="button">➕ Thêm câu tại đầu phát</button>
                  <span id="lyrCardsTotalBadge" className="badge neutral">0 câu</span>
                  <button className="btn sm" id="btnBackToStep2" type="button">🎙️ Căn lại giờ</button>
                </div>
                <div className="lyr-cards-list" id="lyrCardsList"></div>
                <button className="btn sm danger" id="lyrClearAllTimes" type="button" style={{ marginTop: '6px' }}>🗑️ Xóa toàn bộ giờ</button>
              </div>

              <textarea id="lyr" style={{ display: 'none' }}></textarea>
            </div>

            {/* TAB CHỮ */}
            <div className="tabpane" data-pane="text" hidden>
              <div className="field">
                <label htmlFor="sFont">Font chữ</label>
                <select id="sFont"></select>
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

              <div className="field" style={{ marginTop: '8px', borderTop: '1px solid var(--line)', paddingTop: '10px' }}>
                <label style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '12px' }}>Kiểu chữ Hàng 2 trở đi (Song ngữ / Dịch nghĩa)</label>
                <div className="row2" style={{ marginTop: '6px' }}>
                  <div className="field">
                    <label htmlFor="sLane2Scale">Cỡ chữ (% hàng 1)</label>
                    <input id="sLane2Scale" type="number" min="40" max="150" step="5" defaultValue="80" />
                  </div>
                  <div className="field">
                    <label htmlFor="sLane2Color">Màu chữ hàng 2+</label>
                    <input id="sLane2Color" type="color" defaultValue="#cbd5e1" />
                  </div>
                </div>
              </div>

              <div className="field">
                <label htmlFor="tText">Tiêu đề đầu video</label>
                <input id="tText" type="text" placeholder="Ví dụ: Hoa nở bên tường - Ca sĩ" />
              </div>
            </div>
          </div>
        </aside>

        {/* 4. PREVIEW TRUNG TÂM & THANH ĐIỀU KHIỂN PHÁT */}
        <div className="studio-center">
          <div className="stage-viewport" id="stageViewport">
            <div className="stage" id="stage">
              <canvas id="cv" width="720" height="1280"></canvas>
            </div>

            {/* THANH ĐIỀU KHIỂN CHẾ ĐỘ TOÀN MÀN HÌNH (FULLSCREEN OVERLAY) */}
            <div className="fs-overlay" id="fsOverlay">
              {/* Nút ✕ ở góc trên phải */}
              <button type="button" className="fs-top-close-btn" id="btnFsCloseTop" title="Thoát toàn màn hình (Phím Esc)">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>

              {/* Thanh điều khiển đè lên phần đáy của video */}
              <div className="fs-bottom-bar" id="fsBottomBar">
                {/* 1. Thanh tiến trình (seek bar) kéo được */}
                <div className="fs-progress-wrap" id="fsProgressWrap" title="Kéo hoặc bấm để tua video">
                  <div className="fs-progress-container" id="fsProgressContainer">
                    <div className="fs-progress-bg"></div>
                    <div className="fs-progress-fill" id="fsProgressFill" style={{ width: '0%' }}></div>
                    <div className="fs-progress-thumb" id="fsProgressThumb" style={{ left: '0%' }}></div>
                  </div>
                  <div className="fs-progress-tooltip" id="fsProgressTooltip">00:00</div>
                </div>

                {/* 2. Hàng nút điều khiển & thời gian & âm lượng & thoát toàn màn hình */}
                <div className="fs-controls-row">
                  {/* Nhóm trái: các nút phát */}
                  <div className="fs-ctrl-group fs-ctrl-left">
                    <button type="button" className="fs-btn" id="btnFsStart" title="Về đầu (00:00)">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                      </svg>
                    </button>

                    <button type="button" className="fs-btn" id="btnFsBack5" title="Lùi 5 giây (Mũi tên trái)">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 4v6h6M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                      </svg>
                    </button>

                    <button type="button" className="fs-btn fs-btn-play" id="btnFsPlay" title="Phát / Tạm dừng (Phím Space hoặc K)" aria-label="Phát">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </button>

                    <button type="button" className="fs-btn" id="btnFsFwd5" title="Tiến 5 giây (Mũi tên phải)">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 4v6h-6M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                      </svg>
                    </button>

                    <button type="button" className="fs-btn" id="btnFsStop" title="Dừng hẳn và về 00:00">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <rect x="5" y="5" width="14" height="14" rx="2" />
                      </svg>
                    </button>

                    {/* Thời gian "00:05 / 00:13" */}
                    <div className="fs-time-box">
                      <span className="fs-timecode" id="fsTimeLbl">00:00 / 00:04</span>
                    </div>
                  </div>

                  {/* Nhóm phải: Âm lượng + Nút Thoát toàn màn hình */}
                  <div className="fs-ctrl-group fs-ctrl-right">
                    <div className="fs-vol-box" title="Âm lượng (Mũi tên lên/xuống, phím M tắt/bật)">
                      <button type="button" className="fs-btn fs-btn-mute" id="btnFsMute" title="Tắt / Bật tiếng (Phím M)">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                        </svg>
                      </button>
                      <input type="range" id="fsVolSlider" min="0" max="1" step="0.01" defaultValue="1" className="fs-vol-slider" aria-label="Âm lượng toàn màn hình" />
                      <span className="fs-vol-val" id="fsVolVal">100%</span>
                    </div>

                    <button type="button" className="fs-exit-btn" id="btnFsExit" title="Thoát toàn màn hình (Phím Esc)">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-14v3h3v2h-5V5h2z"/>
                      </svg>
                      <span>Thoát toàn màn hình</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* THANH ĐIỀU KHIỂN PHÁT XẾP NGANG */}
          <div className="studio-transport">
            <div className="transport-btns-row">
              <button type="button" className="transport-round-btn" id="bStart" title="Về đầu (00:00)">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                </svg>
              </button>

              <button type="button" className="transport-round-btn" id="bStepBack5" title="Lùi 5 giây">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M1 4v6h6M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
              </button>

              <button type="button" className="transport-round-btn play-btn" id="bPlay" title="Phát / Tạm dừng (Phím Space)" aria-label="Phát">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>

              <button type="button" className="transport-round-btn" id="bStepFwd5" title="Tiến 5 giây">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M23 4v6h-6M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              </button>

              <button type="button" className="transport-round-btn" id="bStop" title="Dừng hẳn và về 00:00">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <rect x="5" y="5" width="14" height="14" rx="2" />
                </svg>
              </button>
            </div>

            <span className="transport-timecode" id="timeLbl">00:00.00 / 00:04.00</span>
            <input id="scrub" type="range" min="0" max="0" step="0.01" defaultValue="0" style={{ display: 'none' }} />

            <div className="transport-vol-box" title="Âm lượng (Phím M tắt/bật)">
              <button type="button" id="bMute" className="transport-round-btn" style={{ width: '26px', height: '26px', border: 'none', background: 'transparent' }} title="Tắt / Bật tiếng (Phím M)">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              </button>
              <input id="stageVol" type="range" min="0" max="1" step="0.01" defaultValue="1" className="transport-vol-slider" aria-label="Âm lượng" />
              <span id="stageVolLbl" className="transport-vol-percent">100%</span>
            </div>

            <button type="button" className="transport-round-btn" id="btnFullscreen" title="Toàn màn hình preview">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
              </svg>
            </button>

            <button type="button" className="transport-round-btn" id="btnToggleRightPanelTransport" title="Bật / Thu gọn bảng thuộc tính">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5-2h4V7h-4v10z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* 5. PANEL BÊN PHẢI THEO NGỮ CẢNH (CONTEXTUAL INSPECTOR 290px) */}
        <aside className="studio-right-panel" id="studioRightPanel">
          <div className="right-panel-header">
            <div className="right-header-title-box">
              <span className="right-header-icon" id="rightPanelIcon">⚙️</span>
              <span className="right-header-title" id="rightPanelTitle">Cài đặt Dự án</span>
            </div>
            <button type="button" className="btn sm" id="btnToggleRightPanel" title="Thu gọn bảng thuộc tính" style={{ padding: '2px 8px' }}>
              ✕
            </button>
          </div>

          <div className="right-panel-content">
            {/* NGỮ CẢNH 1: CLIP ĐANG CHỌN (ẢNH HOẶC VIDEO) */}
            <div id="ctxClip" className="ctx-pane" hidden>
              <div className="ctx-header-row">
                <span className="badge" id="ctxClipBadge" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>🖼️ Ảnh</span>
                <span className="ctx-item-title" id="ctxClipName" style={{ fontWeight: 700, fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Tên clip</span>
              </div>

              <div className="field" id="gDur">
                <label htmlFor="iDur">Thời lượng (giây)</label>
                <input id="iDur" type="number" min="0.3" max="600" step="0.1" />
              </div>

              <div className="row2">
                <div className="field" id="gIn" hidden>
                  <label htmlFor="iIn">Cắt từ giây</label>
                  <input id="iIn" type="number" min="0" step="0.1" />
                </div>
                <div className="field" id="gOut" hidden>
                  <label htmlFor="iOut">Đến giây</label>
                  <input id="iOut" type="number" min="0" step="0.1" />
                </div>
              </div>

              <div className="field">
                <label htmlFor="iFit">Khung ảnh</label>
                <select id="iFit" defaultValue="cover">
                  <option value="cover">Phủ kín khung (Cover)</option>
                  <option value="contain">Vừa ảnh, nền mờ (Contain)</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="iFx">Chuyển động (Ken Burns)</label>
                <select id="iFx"></select>
              </div>

              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="iTr">Chuyển cảnh vào</label>
                  <button type="button" className="btn sm" id="btnPreviewClipTr" style={{ padding: '1px 6px', fontSize: '11px' }}>▶ Xem</button>
                </div>
                <select id="iTr"></select>
              </div>

              <div className="field">
                <label htmlFor="iTrD">Thời gian chuyển (giây)</label>
                <input id="iTrD" type="number" min="0.1" max="3" step="0.1" />
              </div>

              <div className="field">
                <label htmlFor="iCol">Bộ lọc màu</label>
                <select id="iCol"></select>
              </div>

              <div className="field" style={{ marginTop: '4px' }}>
                <button type="button" className="btn sm" id="btnApplyClipTrAll" style={{ width: '100%' }}>Áp dụng chuyển cảnh cho mọi clip</button>
              </div>

              <div className="btns" style={{ marginTop: '8px' }}>
                <button className="btn sm" id="iL" type="button" title="Dời clip sang trái">◀ Dời trái</button>
                <button className="btn sm" id="iR" type="button" title="Dời clip sang phải">Dời phải ▶</button>
                <button className="btn sm" id="iDup" type="button" title="Nhân bản clip này">📋 Nhân bản</button>
                <button className="btn sm danger" id="iDel" type="button" title="Xóa clip này">🗑️ Xóa</button>
              </div>
            </div>

            {/* NGỮ CẢNH 2: KHỐI NHẠC ĐANG CHỌN */}
            <div id="ctxAudio" className="ctx-pane" hidden>
              <div className="ctx-header-row">
                <span className="badge" style={{ background: 'rgba(14, 165, 233, 0.2)', color: '#38bdf8', border: '1px solid #38bdf8' }}>♫ Nhạc</span>
                <span className="ctx-item-title" id="ctxAudioName" style={{ fontWeight: 700, fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Tên đoạn nhạc</span>
              </div>

              <div className="field">
                <label htmlFor="aVol">Âm lượng đoạn nhạc</label>
                <input id="aVol" type="range" min="0" max="1" step="0.01" defaultValue="1" />
              </div>

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

              <div className="field">
                <label>Tốc độ phát</label>
                <div className="speed-grid">
                  <button type="button" className="speed-btn" data-speed="0.5">0.5x</button>
                  <button type="button" className="speed-btn" data-speed="0.75">0.75x</button>
                  <button type="button" className="speed-btn active" data-speed="1.0">1.0x</button>
                  <button type="button" className="speed-btn" data-speed="1.25">1.25x</button>
                  <button type="button" className="speed-btn" data-speed="1.5">1.5x</button>
                  <button type="button" className="speed-btn" data-speed="2.0">2.0x</button>
                </div>
              </div>

              <div className="btns" style={{ marginTop: '12px' }}>
                <button className="btn sm" id="btnCtxCloseGaps" type="button">⚡ Nối khoảng trống</button>
                <button className="btn sm danger" id="btnCtxDelAudio" type="button">🗑️ Xóa đoạn nhạc</button>
              </div>
            </div>

            {/* NGỮ CẢNH 3: CÂU LYRIC ĐANG CHỌN */}
            <div id="ctxLyric" className="ctx-pane" hidden>
              <div className="ctx-header-row">
                <span className="badge" id="inspLyrBadge" style={{ background: 'rgba(255, 210, 63, 0.2)', color: '#ffd23f', border: '1px solid #ffd23f' }}>📝 Câu #1</span>
                <span className="ctx-item-title" id="inspLyrDurBadge" style={{ fontWeight: 700, fontSize: '12px', fontFamily: 'var(--font-mono)' }}>03.50s</span>
              </div>

              <div className="field">
                <label htmlFor="inspLyrText">Nội dung câu</label>
                <textarea id="inspLyrText" rows={3} style={{ width: '100%', resize: 'vertical' }}></textarea>
              </div>

              <div className="row2">
                <div className="field">
                  <label htmlFor="inspLyrStart">Giây bắt đầu</label>
                  <input id="inspLyrStart" type="number" step="0.05" min="0" />
                </div>
                <div className="field">
                  <label htmlFor="inspLyrEnd">Giây kết thúc</label>
                  <input id="inspLyrEnd" type="number" step="0.05" min="0" />
                </div>
              </div>

              <div className="field">
                <label htmlFor="inspLyrLane">Hàng hiển thị trên timeline</label>
                <select id="inspLyrLane" defaultValue="0">
                  <option value="0">Hàng 1 (Chính)</option>
                  <option value="1">Hàng 2 (Dịch / Phụ)</option>
                  <option value="2">Hàng 3</option>
                  <option value="3">Hàng 4</option>
                </select>
              </div>

              <div className="row2">
                <div className="field">
                  <label htmlFor="inspLyrColor">Màu chữ câu</label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input id="inspLyrColorDef" type="checkbox" title="Dùng màu mặc định" />
                    <input id="inspLyrColor" type="color" defaultValue="#ffffff" />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="inspLyrHi">Màu chạy</label>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input id="inspLyrHiDef" type="checkbox" title="Dùng màu mặc định" />
                    <input id="inspLyrHi" type="color" defaultValue="#ffd23f" />
                  </div>
                </div>
              </div>

              <div className="field">
                <label htmlFor="inspLyrSize">Cỡ chữ riêng (0 = theo cài đặt chung)</label>
                <input id="inspLyrSize" type="number" min="0" max="25" step="0.5" defaultValue="0" />
              </div>

              <div className="btns" style={{ marginTop: '8px' }}>
                <button className="btn sm" id="btnInspSplitLyr" type="button">✂️ Tách tại đầu phát</button>
                <button className="btn sm" id="btnInspMergeNext" type="button">🔗 Gộp câu sau</button>
                <button className="btn sm" id="btnInspAddLyr" type="button">➕ Thêm câu mới</button>
                <button className="btn sm danger" id="btnInspDelLyr" type="button">🗑️ Xóa câu này</button>
              </div>
            </div>

            {/* NGỮ CẢNH 4: KHÔNG CHỌN GÌ -> CÀI ĐẶT DỰ ÁN */}
            <div id="ctxProject" className="ctx-pane">
              <h3 className="right-pane-title">Cài đặt Dự án</h3>
              <p className="right-pane-desc">Thông số tỷ lệ, độ phân giải và mờ dần tổng thể video.</p>

              <div className="field">
                <label>Tỷ lệ khung hình</label>
                <div className="segmented-control" style={{ width: '100%', justifyContent: 'stretch' }}>
                  <button id="oV2" type="button" style={{ flex: 1 }} aria-pressed="true">9:16 (Dọc TikTok)</button>
                  <button id="oH2" type="button" style={{ flex: 1 }} aria-pressed="false">16:9 (Ngang YouTube)</button>
                </div>
              </div>

              <div className="field">
                <label htmlFor="res2">Độ phân giải</label>
                <select id="res2" className="quality-select" style={{ width: '100%' }}>
                  <option value="720">720p (Xuất nhanh, mượt mà)</option>
                  <option value="1080">1080p (Full HD sắc nét)</option>
                </select>
              </div>

              <div className="field" style={{ marginTop: '12px' }}>
                <label>Mờ dần đầu/cuối video</label>
                <div style={{ display: 'grid', gap: '8px', marginTop: '4px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--muted)' }}>Mờ dần đầu video:</span>
                      <span id="rFadeInVal" style={{ color: 'var(--accent)', fontWeight: 700 }}>0.0s</span>
                    </div>
                    <input id="rFadeIn" type="range" min="0" max="5" step="0.1" defaultValue="0" />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--muted)' }}>Mờ dần cuối video:</span>
                      <span id="rFadeOutVal" style={{ color: 'var(--accent)', fontWeight: 700 }}>1.5s</span>
                    </div>
                    <input id="rFadeOut" type="range" min="0" max="5" step="0.1" defaultValue="1.5" />
                  </div>
                </div>
              </div>

              <div className="field" style={{ marginTop: '8px' }}>
                <label htmlFor="rFit">Khung ảnh mặc định</label>
                <select id="rFit" defaultValue="cover">
                  <option value="cover">Phủ kín khung (Cover)</option>
                  <option value="contain">Vừa ảnh, nền mờ (Contain)</option>
                </select>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* THANH KÉO CHIA PREVIEW & TIMELINE */}
      <div className="tl-resize-handle" id="tlResizeHandle" title="Kéo lên / xuống để chỉnh chiều cao timeline">
        <div className="tl-resize-bar"></div>
      </div>

      {/* 6. TIMELINE Ở ĐÁY (MẶC ĐỊNH ~200px) */}
      <section className="studio-timeline" aria-label="Dòng thời gian chỉnh sửa">
        {/* THANH CÔNG CỤ TIMELINE GỌN 1 HÀNG (ĐÃ BỎ FADE TRÙNG) */}
        <div className="timeline-toolbar">
          <div className="tl-tools-left">
            <button className="tl-tool-btn" id="btnTlSplit" type="button" title="Tách đoạn tại đầu phát (Phím S)">
              <span>✂️ Tách (S)</span>
            </button>
            <button className="tl-tool-btn danger" id="btnTlDelete" type="button" title="Xóa phần đang chọn (Phím Delete)">
              <span>🗑️ Xóa</span>
            </button>

            <span className="tl-divider"></span>

            <label className="tl-tool-btn" htmlFor="fileMedia2" style={{ cursor: 'pointer' }} title="Thêm ảnh hoặc video">
              <span>+ Thêm clip</span>
            </label>
            <input id="fileMedia2" type="file" accept="image/*,video/*" multiple hidden />

            <label className="tl-tool-btn" htmlFor="fileAudio" style={{ cursor: 'pointer' }} title="Thêm nhạc vào bài">
              <span>+ Thêm nhạc</span>
            </label>

            <button className="tl-tool-btn" id="btnTlAddLyrQuick" type="button" title="Thêm câu lyric mới dài 2s tại đầu phát">
              <span>➕ Thêm câu</span>
            </button>

            <span className="tl-divider"></span>

            <button className="tl-tool-btn" id="btnTlCloseGaps" type="button" title="Xóa khoảng trống giữa các đoạn nhạc">
              <span>⚡ Nối khoảng trống</span>
            </button>

            {/* Hidden fallback elements */}
            <select id="tlFadeIn" defaultValue="0" style={{ display: 'none' }}><option value="0">0</option></select>
            <select id="tlFadeOut" defaultValue="1.5" style={{ display: 'none' }}><option value="1.5">1.5</option></select>
            <button id="tSplit" style={{ display: 'none' }} type="button">Split</button>
            <button id="btnTlPre30" style={{ display: 'none' }} type="button">30s</button>
            <button id="btnTlPre60" style={{ display: 'none' }} type="button">60s</button>
            <button id="btnTlPreAll" style={{ display: 'none' }} type="button">All</button>
            <button id="btnTlUndo" style={{ display: 'none' }} type="button">Undo</button>
            <button id="btnTlRedo" style={{ display: 'none' }} type="button">Redo</button>
          </div>

          <div className="tl-tools-right">
            <button type="button" className="tl-tool-btn" id="btnTlZoomOut" title="Thu nhỏ timeline">－</button>
            <input id="zoom" type="range" min="15" max="200" step="5" defaultValue="60" style={{ width: '80px', accentColor: 'var(--accent)' }} title="Thu phóng timeline" />
            <button type="button" className="tl-tool-btn" id="btnTlZoomIn" title="Phóng to timeline">＋</button>
            <button type="button" className="tl-tool-btn" id="btnTlFitZoom" title="Thu phóng vừa toàn bộ timeline">📐 Vừa khung</button>
            <button type="button" className="tl-tool-btn" id="btnKbShortcuts" title="Xem danh sách phím tắt">⌨️ Phím tắt</button>
          </div>
        </div>

        {/* THÂN TIMELINE GỒM CỘT TIÊU ĐỀ 90px VÀ TRACK CUỘN NGANG */}
        <div className="timeline-body">
          <div className="tl-fixed-column" id="tlFixedCol">
            <div className="tl-col-ruler-space"></div>
            <div className="tl-col-lane lane-clip">🖼️ CLIP</div>
            <div className="tl-col-lane lane-audio">♫ NHẠC</div>
            <div className="tl-col-lane lane-lyric" id="tlColLyr">
              <span className="tl-lyr-title">📝 LYRIC</span>
              <div className="tl-col-lane-subrows" id="tlColLyrSubrows"></div>
            </div>
          </div>

          <div className="tl-scroll-area" id="tlScroll">
            <div className="tl" id="tl">
              <div className="ruler" id="ruler"></div>
              <div id="clips"></div>
              <div className="alane" id="alane"></div>
              <div className="llane" id="llane"></div>
              <div id="ph"></div>
              <div id="lyrDragGhost" className="lyr-drag-ghost" style={{ display: 'none' }}></div>
              <div id="lyrDragTip" className="lyr-drag-tip" style={{ display: 'none' }}></div>
              <div id="audioDragTip" style={{ display: 'none' }}></div>
            </div>
          </div>
        </div>

        {/* Bảng chỉnh Lyric trên timeline */}
        <div id="lyrToolbar" className="lyr-toolbar" style={{ display: 'none' }}>
          <span className="badge success" id="lyrTbBadge">Câu #1</span>
          <button className="btn sm" id="btnTbAddLyr" type="button">➕ Thêm câu</button>
          <button className="btn sm" id="btnTbSplitLyr" type="button">✂️ Tách câu</button>
          <button className="btn sm" id="btnTbMergeNext" type="button">🔗 Gộp sau</button>
          <button className="btn sm danger" id="btnTbDelLyr" type="button">🗑️ Xóa</button>
          <input type="number" id="lyrTbStart" step="0.05" min="0" style={{ width: '50px' }} />
          <input type="number" id="lyrTbEnd" step="0.05" min="0" style={{ width: '50px' }} />
          <button className="btn sm" id="btnTbDeselect" type="button">✕</button>
        </div>

        {/* Bảng chỉnh Clip ẩn / popup */}
        <div className="insp" id="inspClip" style={{ display: 'none' }}></div>

        {/* Bảng chỉnh Lyric ẩn / popup */}
        <div className="insp" id="inspLyric" style={{ display: 'none' }}>
          <span id="inspLyrBadge"></span>
          <span id="inspLyrDurBadge"></span>
          <textarea id="inspLyrText"></textarea>
          <input id="inspLyrStart" type="number" />
          <input id="inspLyrEnd" type="number" />
          <input id="inspLyrColorDef" type="checkbox" />
          <input id="inspLyrColor" type="color" />
          <input id="inspLyrHiDef" type="checkbox" />
          <input id="inspLyrHi" type="color" />
          <input id="inspLyrSize" type="number" />
          <button id="btnInspSplitLyr"></button>
          <button id="btnInspMergeNext"></button>
          <button id="btnInspAddLyr"></button>
          <button id="btnInspDelLyr"></button>
          <button id="btnInspCloseLyr"></button>
        </div>
      </section>

      {/* MODAL XUẤT VIDEO */}
      <div id="exp" hidden>
        <div className="card" role="dialog" aria-labelledby="expT" style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px', padding: '18px', width: 'min(100%, 460px)', display: 'grid', gap: '12px' }}>
          <h2 id="expT" style={{ margin: 0, fontSize: '16px' }}>Đang xuất video</h2>
          <p className="note" id="expMsg">
            Giữ tab này mở cho tới khi xong. Video được kết xuất theo thời gian thực chuẩn khung hình và âm thanh.
          </p>
          <div style={{ height: '8px', borderRadius: '4px', background: 'var(--panel2)', overflow: 'hidden' }}>
            <i id="expBar" style={{ display: 'block', height: '100%', width: '0%', background: 'var(--accent)', transition: 'width 0.2s' }}></i>
          </div>
          <video id="expVideo" controls playsInline hidden style={{ width: '100%', maxHeight: '45vh', borderRadius: '6px', background: '#000' }}></video>
          <div className="btns">
            <button className="btn pri" id="expSave" hidden>Lưu video về máy</button>
            <button className="btn" id="expClose">Hủy</button>
          </div>
        </div>
      </div>

      {/* MODAL PHÍM TẮT */}
      <div id="shortcutsModal" hidden style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 65, display: 'grid', placeItems: 'center', padding: '16px' }}>
        <div className="card" role="dialog" aria-labelledby="scTitle" style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px', padding: '20px', width: 'min(100%, 460px)', display: 'grid', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 id="scTitle" style={{ margin: 0, fontSize: '15px', color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⌨️</span> Danh sách phím tắt
            </h2>
            <button className="btn sm" id="btnCloseShortcuts" type="button">✕</button>
          </div>
          <div style={{ display: 'grid', gap: '8px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)' }}>Phát / Tạm dừng</span>
              <kbd style={{ background: 'var(--panel2)', padding: '2px 6px', borderRadius: '4px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>Space</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)' }}>Tách đoạn tại đầu phát</span>
              <kbd style={{ background: 'var(--panel2)', padding: '2px 6px', borderRadius: '4px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>S</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)' }}>Xóa phần đang chọn</span>
              <kbd style={{ background: 'var(--panel2)', padding: '2px 6px', borderRadius: '4px', color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>Delete / Backspace</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ color: 'var(--muted)' }}>Hoàn tác / Làm lại</span>
              <kbd style={{ background: 'var(--panel2)', padding: '2px 6px', borderRadius: '4px', color: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>Ctrl + Z / Ctrl + Y</kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ color: 'var(--muted)' }}>Tắt / Bật tiếng</span>
              <kbd style={{ background: 'var(--panel2)', padding: '2px 6px', borderRadius: '4px', color: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>M</kbd>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button className="btn pri sm" id="btnOkShortcuts" type="button">Đã hiểu (Esc)</button>
          </div>
        </div>
      </div>

      {/* MODAL CHUYỂN CẢNH */}
      <div id="transitionModal" hidden style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 66, display: 'grid', placeItems: 'center', padding: '16px' }}>
        <div className="card" role="dialog" aria-labelledby="trModalTitle" style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '14px', padding: '18px 20px', width: 'min(100%, 700px)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            <button className="btn sm" id="btnTrModalClose" type="button">✕</button>
          </div>

          <div id="trCatTabs" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}></div>
          <div id="trGrid" style={{ flex: 1, minHeight: '200px', maxHeight: '320px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px', padding: '4px' }}></div>

          <div style={{ background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <label htmlFor="trModalDur" style={{ fontSize: '11.5px', fontWeight: 600, whiteSpace: 'nowrap' }}>Thời gian chuyển:</label>
              <input id="trModalDur" type="range" min="0.1" max="3.0" step="0.1" defaultValue="1.0" style={{ flex: 1, accentColor: 'var(--accent)' }} />
              <span id="trModalDurVal" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '11.5px', color: 'var(--accent)' }}>1.0s</span>
            </div>
            <span id="trModalDurHint" style={{ fontSize: '10.5px', color: 'var(--muted)' }}></span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn sm" id="btnTrModalPreview" type="button">▶ Xem thử chỗ nối</button>
              <button className="btn sm" id="btnTrModalApplyAll" type="button">Áp dụng tất cả</button>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn sm danger" id="btnTrModalRemove" type="button">Cắt thẳng</button>
              <button className="btn pri sm" id="btnTrModalDone" type="button">Xong</button>
            </div>
          </div>
        </div>
      </div>

      <div id="toast" role="status" hidden></div>
    </div>
  );
}
