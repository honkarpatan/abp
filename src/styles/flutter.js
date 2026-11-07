/** 
 * 2.0.1v
 * Flutter-themed styles for EditorFile Shadow DOM (CSS string).
 * Brand blues: #02569B / #0175C2 / #13B9FD — Acode vars as fallbacks.
 */
export const flutterStyles = /* css */ `
:host, .flutter-page, .flutter-settings, .flutter-preview, .flutter-setup, .flutter-build {
  --fl-primary: #0175C2;
  --fl-primary-dark: #02569B;
  --fl-accent: #13B9FD;
  --fl-on-primary: #FFFFFF;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: linear-gradient(165deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  color: var(--primary-text-color);
  font-family: "Roboto", "Segoe UI", sans-serif;
  overflow: hidden;
  box-sizing: border-box;
}

.flutter-page *, .flutter-settings *, .flutter-preview *, .flutter-setup *, .flutter-build * {
  box-sizing: border-box;
}

.flutter-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: linear-gradient(135deg, var(--fl-primary-dark) 0%, var(--fl-primary) 55%, var(--fl-accent) 100%);
  color: var(--fl-on-primary);
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(1, 117, 194, 0.35);
}

.flutter-header img.flutter-logo {
  width: 80px;
  height: 90px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
}

.flutter-header img.flutter-title-img {
  height: 22px;
  width: auto;
  max-width: 140px;
  object-fit: contain;
}

.flutter-header h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.3px;
}

.flutter-header .flutter-sub {
  font-size: 0.78rem;
  opacity: 0.9;
  margin-top: 2px;
  color: rgba(255,255,255,0.9);
}

.flutter-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  -webkit-overflow-scrolling: touch;
}

.flutter-hero {
  text-align: center;
  padding: 12px 8px 8px;
}

.flutter-hero img {
  width: 72px;
  height: 72px;
  object-fit: contain;
  margin-bottom: 8px;
}

.flutter-hero p {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.85;
  line-height: 1.45;
}

.flutter-card {
  background: transparent;
  border: none;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 14px;
}

.flutter-card-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0 0 10px;
  color: var(--fl-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.flutter-label {
  display: block;
  font-size: 0.8rem;
  opacity: 0.8;
  margin-bottom: 6px;
}

.flutter-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1.5px solid var(--border-color);
  background: var(--primary-color);
  color: var(--primary-text-color);
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.2s;
}

.flutter-input:focus {
  border-color: var(--fl-accent);
  box-shadow: 0 0 0 3px rgba(19, 185, 253, 0.2);
}

.flutter-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 18px;
  border: none;
  border-radius: 24px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  background: linear-gradient(135deg, var(--fl-primary) 0%, var(--fl-accent) 100%);
  color: #fff;
  box-shadow: 0 3px 10px rgba(1, 117, 194, 0.35);
  transition: opacity 0.15s, transform 0.1s;
}

.flutter-btn:active {
  opacity: 0.9;
  transform: scale(0.98);
}

.flutter-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.flutter-btn-secondary {
  background: transparent;
  color: var(--fl-primary);
  border: 1.5px solid var(--fl-primary);
  box-shadow: none;
}

.flutter-btn-danger {
  background: transparent;
  color: #E53935;
  border: 1.5px solid #E53935;
  box-shadow: none;
}

.flutter-btn-block {
  width: 100%;
  margin-top: 8px;
}

.flutter-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.flutter-actions .flutter-btn {
  flex: 1;
  min-width: 120px;
}

.flutter-badge {
  display: inline-block;
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(19, 185, 253, 0.2);
  color: var(--fl-primary);
  vertical-align: middle;
  margin-left: 6px;
}

.flutter-hint {
  font-size: 0.8rem;
  opacity: 0.75;
  margin: 8px 0 0;
  line-height: 1.45;
}

.flutter-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.flutter-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.9rem;
}

.flutter-list li:last-child { border-bottom: none; }

.flutter-check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  flex-shrink: 0;
  border: 2px solid var(--border-color);
  color: transparent;
}

.flutter-check.ok {
  background: #43A047;
  border-color: #43A047;
  color: #fff;
}

.flutter-check.miss {
  background: transparent;
  border-color: #FFA726;
  color: #FFA726;
}

.flutter-status-ok { color: #43A047; font-size: 0.8rem; font-weight: 600; }
.flutter-status-miss { color: #FB8C00; font-size: 0.8rem; font-weight: 600; }

.flutter-progress-area { margin: 8px 0 16px; }

.flutter-progress-label {
  font-weight: 600;
  color: var(--fl-primary);
  margin-bottom: 4px;
  font-size: 0.95rem;
}

.flutter-progress-sub {
  font-size: 0.8rem;
  opacity: 0.75;
  margin-bottom: 12px;
}

.flutter-progress-track {
  position: relative;
  height: 28px;
  border-radius: 14px;
  background: rgba(1, 117, 194, 0.12);
  border: 1px solid rgba(1, 117, 194, 0.25);
  overflow: hidden;
}

.flutter-progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 0%;
  border-radius: 14px;
  background: linear-gradient(90deg, var(--fl-primary-dark), var(--fl-primary), var(--fl-accent));
  transition: width 0.35s ease;
}

.flutter-progress-fill.indeterminate {
  width: 35% !important;
  animation: flutter-shimmer 1.2s ease-in-out infinite;
}

@keyframes flutter-shimmer {
  0% { transform: translateX(-40%); }
  100% { transform: translateX(220%); }
}

.flutter-progress-icon {
  position: absolute;
  top: 50%;
  left: 0%;
  width: 22px;
  height: 22px;
  margin-top: -11px;
  margin-left: -11px;
  object-fit: contain;
  z-index: 2;
  filter: drop-shadow(0 1px 3px rgba(0,0,0,0.35));
  transition: left 0.35s ease;
  pointer-events: none;
}

.flutter-log-box {
  display: none;
  margin-top: 12px;
  max-height: 36vh;
  overflow-y: auto;
  padding: 10px;
  border-radius: 10px;
  background: var(--primary-color);
  border: 1px solid rgba(1, 117, 194, 0.25);
  font-family: monospace;
  font-size: 0.72rem;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--primary-text-color);
  text-align: left;
}

.flutter-log-box.visible { display: block; }

.flutter-agree-box {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border-radius: 10px;
  background: rgba(19, 185, 253, 0.08);
  border: 1px solid rgba(1, 117, 194, 0.2);
  margin-top: 10px;
  font-size: 0.85rem;
  line-height: 1.4;
}

.flutter-agree-box input {
  margin-top: 3px;
  accent-color: var(--fl-primary);
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.flutter-footer {
  padding: 10px 16px;
  border-top: 1px solid rgba(1, 117, 194, 0.2);
  background: var(--secondary-color);
  font-size: 0.8rem;
  opacity: 0.9;
  flex-shrink: 0;
  color: var(--fl-primary-dark);
}

.flutter-preview.flutter-page {
  /* no page header on preview — more space for iframe */
}

.flutter-preview .flutter-header {
  display: none !important;
}

.flutter-preview-frame-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--primary-color);
}

.flutter-preview-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--secondary-color);
  border-bottom: 1px solid rgba(1, 117, 194, 0.2);
  flex-shrink: 0;
}

.flutter-preview-mark {
  width: 28px;
  height: 28px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 3px rgba(1, 117, 194, 0.35));
  transform-origin: center center;
}

/* One elegant spin — applied via .is-spinning every ~60s (not continuous) */
.flutter-preview-mark.is-spinning {
  animation: flutter-icon-spin 0.85s cubic-bezier(0.4, 0, 0.2, 1) 1;
}

@keyframes flutter-icon-spin {
  0%   { transform: rotate(0deg) scale(1); }
  40%  { transform: rotate(200deg) scale(1.08); }
  70%  { transform: rotate(320deg) scale(1.02); }
  100% { transform: rotate(360deg) scale(1); }
}

.flutter-preview-toolbar input {
  flex: 1;
  min-width: 0;
  border-radius: 20px;
  border: 1px solid rgba(1, 117, 194, 0.25);
  padding: 2px 12px;
  background: var(--primary-color);
  color: var(--primary-text-color);
}

.flutter-preview-iframe {
  flex: 1;
  width: 100%;
  border: none;
  background: #fff;
  min-height: 200px;
}

.flutter-build-status { text-align: center; padding: 20px 12px; }
.flutter-build-status .main {
  font-size: 1.15rem;
  font-weight: 600;
  margin: 12px 0 6px;
  color: var(--fl-primary);
}

/* —— Preview ⋮ menu, modal, device frame —— */
.flutter-toolbar-more {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--fl-primary);
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}
.flutter-toolbar-more:active { background: rgba(1,117,194,0.12); }

.flutter-menu {
  position: absolute;
  top: 48px;
  right: 8px;
  z-index: 40;
  min-width: 240px;
  max-width: 92vw;
  max-height: 70vh;
  overflow-y: auto;
  background: var(--secondary-color);
  border: 1px solid rgba(1, 117, 194, 0.25);
  border-radius: 12px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.28);
  padding: 6px 0;
}

.flutter-preview-toolbar { position: relative; }

.flutter-menu-section {
  padding: 8px 14px 4px;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.55;
  font-weight: 600;
  color: var(--fl-primary);
}

.flutter-menu-sep {
  height: 1px;
  margin: 6px 0;
  background: var(--border-color);
}

.flutter-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--primary-text-color);
  text-align: left;
  padding: 10px 14px;
  font-size: 0.9rem;
  cursor: pointer;
}
.flutter-menu-item:active { background: rgba(1,117,194,0.1); }
.flutter-menu-label { flex: 1; }
.flutter-menu-hint {
  font-size: 0.75rem;
  opacity: 0.65;
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.flutter-menu-check {
  width: 18px;
  color: var(--fl-primary);
  font-weight: 700;
}

.flutter-preview-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  overflow: auto;
  background: var(--primary-color);
  -webkit-overflow-scrolling: touch;
}
.flutter-preview-stage.is-framed {
  align-items: center;
  justify-content: center;
  padding: 16px;
  background:
    radial-gradient(ellipse at 30% 20%, rgba(19,185,253,0.08), transparent 50%),
    var(--primary-color);
}

.flutter-device-shell {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  height: 100%;
  transform-origin: center center;
  transition: width 0.25s ease, height 0.25s ease, transform 0.25s ease;
}
.flutter-preview-stage.is-framed .flutter-device-shell {
  flex: 0 0 auto;
  border-radius: 28px;
  overflow: hidden;
  box-shadow:
    0 0 0 3px #1a1a1a,
    0 12px 40px rgba(0,0,0,0.35);
  background: #111;
}
.flutter-device-shell.has-chrome .flutter-device-notch {
  display: block;
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 28%;
  height: 18px;
  border-radius: 12px;
  background: #0a0a0a;
  z-index: 2;
  pointer-events: none;
}
.flutter-device-shell.has-chrome .flutter-device-home {
  display: block;
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 36%;
  height: 4px;
  border-radius: 4px;
  background: rgba(255,255,255,0.35);
  z-index: 2;
  pointer-events: none;
}
.flutter-device-notch,
.flutter-device-home { display: none; }

.flutter-preview-stage.is-framed .flutter-preview-iframe {
  border-radius: 0;
  flex: 1;
  min-height: 0;
}

.flutter-modal-root {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.flutter-modal-root[hidden] { display: none !important; }
.flutter-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.45);
}
.flutter-modal-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 360px;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--secondary-color);
  border-radius: 14px;
  border: 1px solid rgba(1,117,194,0.3);
  box-shadow: 0 12px 40px rgba(0,0,0,0.35);
  padding: 16px;
}
.flutter-modal-title {
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--fl-primary);
  margin-bottom: 12px;
}
.flutter-modal-body { margin-bottom: 14px; }
.flutter-modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
.flutter-radio-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.9rem;
  cursor: pointer;
}
.flutter-radio-row small { opacity: 0.6; margin-left: 4px; }
.flutter-radio-row input { accent-color: var(--fl-primary); }
.flutter-range {
  width: 100%;
  accent-color: var(--fl-primary);
  margin-top: 8px;
}


/* —— Preview footer chrome (no top bar) —— */
.flutter-preview.flutter-page {
  position: relative;
}

.flutter-preview-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  min-height: 44px;
  border-top: 1px solid rgba(1, 117, 194, 0.25);
  background: var(--secondary-color);
  flex-shrink: 0;
  position: relative;
  z-index: 20;
}

.flutter-preview-bar .flutter-preview-mark {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.flutter-footer-status {
  flex: 1;
  min-width: 0;
  font-size: 0.78rem;
  line-height: 1.3;
  opacity: 0.9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--primary-text-color);
}

.flutter-footer-icon-btn {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--fl-primary);
  font-size: 1.15rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.flutter-footer-icon-btn:active {
  background: rgba(1, 117, 194, 0.12);
}

/* Menu opens upward from footer */
.flutter-menu.flutter-menu-up {
  top: auto;
  bottom: calc(100% + 6px);
  right: 8px;
  left: auto;
}

/* Floating ⋮ when status bar hidden */
.flutter-fab-more {
  position: absolute;
  right: 14px;
  bottom: 18px;
  z-index: 30;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 22px;
  background: linear-gradient(135deg, var(--fl-primary) 0%, var(--fl-accent) 100%);
  color: #fff;
  font-size: 1.4rem;
  font-weight: 700;
  box-shadow: 0 4px 16px rgba(1, 117, 194, 0.45);
  cursor: pointer;
}
.flutter-fab-more[hidden] {
  display: none !important;
}
.flutter-fab-more:active {
  transform: scale(0.96);
}

/* Logs / info panel */
.flutter-log-panel {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 56px;
  z-index: 35;
  max-height: 42vh;
  display: flex;
  flex-direction: column;
  background: var(--secondary-color);
  border: 1px solid rgba(1, 117, 194, 0.3);
  border-radius: 12px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.3);
  overflow: hidden;
}
.flutter-log-panel[hidden] {
  display: none !important;
}
.flutter-log-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--fl-primary);
  border-bottom: 1px solid var(--border-color);
}
.flutter-log-panel-tabs {
  display: flex;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-color);
}
.flutter-log-tab {
  border: none;
  background: transparent;
  color: var(--primary-text-color);
  opacity: 0.65;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 0.8rem;
  cursor: pointer;
}
.flutter-log-tab.is-active {
  opacity: 1;
  background: rgba(1, 117, 194, 0.15);
  color: var(--fl-primary);
  font-weight: 600;
}
.flutter-log-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 10px;
  font-family: monospace;
  font-size: 0.72rem;
  max-height: 28vh;
}
.flutter-log-line {
  padding: 4px 0;
  border-bottom: 1px solid rgba(128,128,128,0.15);
  word-break: break-word;
}
.flutter-log-line .t {
  opacity: 0.5;
  margin-right: 6px;
}
.flutter-log-line.level-error {
  color: #E53935;
}
.flutter-log-line.level-warn {
  color: #FB8C00;
}


.flutter-progress-track {
  height: 8px;
  border-radius: 6px;
  background: rgba(1, 117, 194, 0.15);
  overflow: hidden;
  margin: 10px 0;
}
.flutter-progress-bar {
  height: 100%;
  width: 0%;
  min-width: 2%;
  border-radius: 6px;
  background: linear-gradient(90deg, #0175C2, #13B9FD);
  transition: width 0.35s ease;
}
.flutter-progress-bar.is-busy {
  width: 45% !important;
  background: linear-gradient(90deg, #0175C2, #13B9FD, #0175C2);
  background-size: 200% 100%;
  animation: flutter-bar-slide 1.2s linear infinite;
}
@keyframes flutter-bar-slide {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}


.flutter-build-layout {
  display: flex;
  height: 100%;
  min-height: 0;
  width: 100%;
}
.flutter-build-sidebar {
  width: 0;
  overflow: hidden;
  flex-shrink: 0;
  border-right: 1px solid color-mix(in srgb, var(--border-color, #444) 80%, transparent);
  background: color-mix(in srgb, var(--secondary-color, #1e1e2e) 90%, transparent);
  transition: width 0.2s ease;
  display: flex;
  flex-direction: column;
}
.flutter-build-sidebar.open {
  width: min(280px, 78vw);
}
.flutter-build-sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--border-color, #444) 70%, transparent);
  font-size: 0.85rem;
}
.flutter-build-hist-list {
  overflow: auto;
  flex: 1;
  padding: 8px;
}
.flutter-hist-empty {
  opacity: 0.6;
  font-size: 0.8rem;
  padding: 12px;
  text-align: center;
}
.flutter-hist-item {
  padding: 10px;
  margin-bottom: 8px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--primary-color, #12121a) 70%, transparent);
  border: 1px solid color-mix(in srgb, var(--border-color, #333) 60%, transparent);
}
.flutter-hist-title { font-size: 0.82rem; font-weight: 600; }
.flutter-hist-meta { font-size: 0.72rem; opacity: 0.7; margin-top: 4px; word-break: break-all; }
.flutter-hist-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.flutter-hist-actions .flutter-btn { padding: 4px 10px; font-size: 0.72rem; }
.flutter-build-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
}
.flutter-header #fb-toggle-hist {
  margin-right: 6px;
  flex-shrink: 0;
}
`;