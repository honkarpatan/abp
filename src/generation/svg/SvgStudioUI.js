/**
 * SVG Studio: live preview, color matrix, popup editor, SVG→VectorDrawable (beta).
 */

import { svgs } from '../../assets/icons/svg/svg.js';
import { pageStyles } from '../../styles/styles.js';
import { CodeEditorPopup } from '../../reusable/CodeEditorPopup.js';
import {
  parseSvgColors,
  applySvgColor,
  collectPalette,
} from './SvgColorModel.js';
import { svgToVectorDrawable } from './SvgToVector.js';
import { createFolder, createFile } from '../../operations/fileOperations.js';

const SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 12.6111L8.92308 17.5L20 6.5" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

export class SvgStudioUI {
  constructor() {
    this.tabId = 'android.svg.studio';
    this.editorFile = null;
    this.projectRoot = '';
    this.svgText = SAMPLE;
    this._$ = null;
    /** @type {null|((svgText: string) => void)} */
    this._onContinue = null;
  }

  resolveProjectRoot(filePath) {
    try {
      const p = String(filePath || '');
      if (!p) return '';
      // climb to folder containing app/ or src/
      const parts = p.replace(/\\/g, '/').split('/');
      for (let i = parts.length; i > 0; i--) {
        const sub = parts.slice(0, i).join('/');
        if (/\/app$/i.test(sub) || /\/src$/i.test(sub)) {
          return sub.replace(/\/(app|src)$/i, '') || sub;
        }
      }
      return parts.slice(0, -1).join('/');
    } catch (_) {
      return '';
    }
  }

  /**
   * @param {string} currentFilePath
   * @param {string} [initialSvg]
   * @param {{ onContinue?: (svgText: string) => void }} [opts]
   */
  async show(currentFilePath, initialSvg, opts) {
    this.projectRoot = this.resolveProjectRoot(currentFilePath);
    this._onContinue = (opts && typeof opts.onContinue === 'function') ? opts.onContinue : null;
    if (initialSvg) this.svgText = String(initialSvg);

    const EditorFile = acode.require('editorFile');
    const $c = document.createElement('div');
    $c.className = 'andro-build-page svg-studio-page';
    this._$ = $c;

    $c.innerHTML = `
      ${typeof pageStyles === 'string' ? '' : ''}
      <style>${studioCss()}</style>
      <div class="svg-studio">
        <div class="svg-studio-head">
          <div class="svg-studio-title">
            ${(svgs && svgs.image) || ''} SVG Studio
            <span class="svg-beta">beta tools</span>
          </div>
          <div class="svg-studio-actions">
            <button type="button" class="andro-btn secondary" id="svg-btn-editor">Open editor</button>
            <button type="button" class="andro-btn secondary" id="svg-btn-sample">Sample</button>
            <button type="button" class="andro-btn primary" id="svg-btn-vector">SVG → Vector</button>
          </div>
        </div>

        <div class="svg-preview-card">
          <div class="svg-preview-stage" id="svg-preview-stage"></div>
          <div class="svg-preview-meta" id="svg-preview-meta"></div>
        </div>

        <div class="svg-palette-row" id="svg-palette"></div>

        <div class="svg-matrix-card">
          <div class="svg-matrix-title">Colors by tag</div>
          <div class="svg-matrix-scroll" id="svg-matrix"></div>
          <p class="svg-legend">
            <span class="cell-swatch none" title="not set"></span> not set
            <span class="cell-swatch special" title="special"></span> currentColor / none / url
            <span class="cell-swatch color" style="background:#000"></span> color
          </p>
        </div>

        <div class="svg-dim-row" id="svg-dims"></div>

        <div class="svg-footer">
          <button type="button" class="andro-btn secondary" id="svg-btn-close">Close</button>
          <button type="button" class="andro-btn secondary" id="svg-btn-save-vd">Save vector drawable</button>
          <button type="button" class="andro-btn primary" id="svg-btn-continue" style="display:none;">Continue</button>
        </div>
        <div class="svg-status" id="svg-status"></div>
      </div>
    `;

    this.editorFile = new EditorFile('SVG Studio', {
      type: 'page',
      tabIcon: 'icon image',
      content: $c,
      id: this.tabId,
    });

    this._bind($c);
    this._renderAll();
  }

  _bind($c) {
    $c.querySelector('#svg-btn-close').onclick = () => this.editorFile?.remove();
    $c.querySelector('#svg-btn-sample').onclick = () => {
      this.svgText = SAMPLE;
      this._renderAll();
    };
    $c.querySelector('#svg-btn-editor').onclick = () => this._openEditor();
    $c.querySelector('#svg-btn-vector').onclick = () => this._showVectorPreview();
    $c.querySelector('#svg-btn-save-vd').onclick = () => this._saveVector();

    const cont = $c.querySelector('#svg-btn-continue');
    if (cont) {
      if (this._onContinue) {
        cont.style.display = '';
        cont.onclick = () => {
          try {
            this._onContinue(this.svgText);
          } catch (e) {
            console.error('svg continue', e);
          }
          this.editorFile?.remove();
        };
      } else {
        cont.style.display = 'none';
      }
    }
  }

  _setStatus(msg, isErr) {
    const el = this._$?.querySelector('#svg-status');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = isErr ? '#ef9a9a' : 'inherit';
  }

  _renderAll() {
    this._renderPreview();
    this._renderMatrix();
    this._renderPalette();
    this._renderDims();
  }

  _renderPreview() {
    const stage = this._$?.querySelector('#svg-preview-stage');
    const meta = this._$?.querySelector('#svg-preview-meta');
    if (!stage) return;
    try {
      // sandbox: strip scripts
      const safe = this.svgText.replace(/<script[\s\S]*?<\/script>/gi, '');
      stage.innerHTML = safe;
      const svg = stage.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.maxWidth = '160px';
        svg.style.maxHeight = '160px';
      }
      if (meta) {
        const m = parseSvgColors(this.svgText);
        meta.textContent = `${m.elements.length} element(s) · ${collectPalette(m).length} color(s)`;
      }
    } catch (e) {
      stage.innerHTML = `<div class="svg-preview-err">${e.message || e}</div>`;
    }
  }

  _renderPalette() {
    const row = this._$?.querySelector('#svg-palette');
    if (!row) return;
    const colors = collectPalette(parseSvgColors(this.svgText));
    if (!colors.length) {
      row.innerHTML = `<span class="svg-palette-empty">No solid colors yet</span>`;
      return;
    }
    row.innerHTML = colors
      .map(
        (c) =>
          `<button type="button" class="svg-pal-dot" data-c="${escapeAttr(c)}" title="${escapeAttr(c)}" style="background:${escapeAttr(c)}"></button>`
      )
      .join('');
    row.querySelectorAll('.svg-pal-dot').forEach((btn) => {
      btn.onclick = () => {
        window.toast?.(btn.getAttribute('data-c'), 1500);
      };
    });
  }

  _renderDims() {
    const box = this._$?.querySelector('#svg-dims');
    if (!box) return;
    const root = parseSvgColors(this.svgText).elements.find((e) => e.tag === 'svg');
    const w = root?.attrs?.width || '';
    const h = root?.attrs?.height || '';
    box.innerHTML = `
      <label>width <input class="andro-input svg-dim-in" id="svg-w" value="${escapeAttr(w)}"/></label>
      <label>height <input class="andro-input svg-dim-in" id="svg-h" value="${escapeAttr(h)}"/></label>
    `;
    const applyDim = (key, val) => {
      const model = parseSvgColors(this.svgText);
      const el = model.elements.find((e) => e.tag === 'svg');
      if (!el) return;
      this.svgText = applySvgColor(this.svgText, model.elements.indexOf(el), key, null);
      // applySvgColor only handles color props — do attr set manually
      this.svgText = setRootAttr(this.svgText, key, val);
      this._renderAll();
    };
    box.querySelector('#svg-w').onchange = (e) => applyDim('width', e.target.value);
    box.querySelector('#svg-h').onchange = (e) => applyDim('height', e.target.value);
  }

  _renderMatrix() {
    const host = this._$?.querySelector('#svg-matrix');
    if (!host) return;
    const model = parseSvgColors(this.svgText);
    if (!model.elements.length) {
      host.innerHTML = `<div class="svg-matrix-empty">No tags found</div>`;
      return;
    }

    const props = model.props;
    let html = `<table class="svg-matrix-table"><thead><tr><th class="sticky-col">prop</th>`;
    model.elements.forEach((el) => {
      html += `<th title="${escapeAttr(el.tag)}"><span class="tag-pill">${escapeAttr(el.label)}</span></th>`;
    });
    html += `</tr></thead><tbody>`;

    props.forEach((prop) => {
      html += `<tr><th class="sticky-col">${escapeAttr(prop)}</th>`;
      model.elements.forEach((el, ei) => {
        const cell = el.props[prop];
        html += `<td>${renderCell(cell, ei, prop)}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table>`;
    host.innerHTML = html;

    host.querySelectorAll('.svg-cell').forEach((btn) => {
      btn.onclick = () => {
        const ei = +btn.getAttribute('data-ei');
        const prop = btn.getAttribute('data-prop');
        this._editCell(ei, prop);
      };
    });
  }

  _editCell(elementIndex, prop) {
    const model = parseSvgColors(this.svgText);
    const el = model.elements[elementIndex];
    if (!el) return;
    const cur = el.props[prop];
    const current =
      cur.kind === 'none' ? '' : cur.value || '';

    // lightweight prompt UI inside modal-like overlay
    const overlay = document.createElement('div');
    overlay.className = 'andro-modal-overlay visible';
    overlay.innerHTML = `
      <div class="andro-modal-box" style="width:min(92vw,360px)">
        <div class="andro-modal-header">
          <span class="andro-modal-title">${escapeAttr(el.label)} · ${escapeAttr(prop)}</span>
          <span class="andro-modal-close">&times;</span>
        </div>
        <div class="andro-modal-body">
          <p style="font-size:0.75rem;opacity:0.7;margin:0 0 8px">Empty = remove (not set). Use currentColor, none, or #RRGGBB.</p>
          <input type="color" id="svg-cell-picker" value="${toColorInput(current)}" style="width:100%;height:40px;margin-bottom:8px;"/>
          <input type="text" id="svg-cell-text" class="andro-input" value="${escapeAttr(current)}" placeholder="#000000 / none / currentColor" style="width:100%;font-family:monospace;"/>
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
            <button type="button" class="andro-btn secondary" data-v="none">none</button>
            <button type="button" class="andro-btn secondary" data-v="currentColor">currentColor</button>
            <button type="button" class="andro-btn secondary" data-v="">clear</button>
          </div>
        </div>
        <div class="andro-modal-footer">
          <button type="button" class="andro-modal-btn secondary" id="svg-cell-cancel">Cancel</button>
          <button type="button" class="andro-modal-btn primary" id="svg-cell-ok">Apply</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.andro-modal-close').onclick = close;
    overlay.querySelector('#svg-cell-cancel').onclick = close;
    overlay.onclick = (e) => {
      if (e.target === overlay) close();
    };
    const text = overlay.querySelector('#svg-cell-text');
    const picker = overlay.querySelector('#svg-cell-picker');
    picker.oninput = () => {
      text.value = picker.value;
    };
    overlay.querySelectorAll('[data-v]').forEach((b) => {
      b.onclick = () => {
        text.value = b.getAttribute('data-v') || '';
      };
    });
    overlay.querySelector('#svg-cell-ok').onclick = () => {
      const v = text.value.trim();
      this.svgText = applySvgColor(
        this.svgText,
        elementIndex,
        prop,
        v === '' ? null : v
      );
      close();
      this._renderAll();
      this._setStatus(`Updated ${el.label}.${prop}`);
    };
  }

  _openEditor() {
    const popup = new CodeEditorPopup({
      title: 'SVG source',
      mode: 'svg',
      wrap: true,
      gutter: true,
      value: this.svgText,
      onChange: (v) => {
        this.svgText = v;
        this._renderAll();
      },
      onApply: (v) => {
        this.svgText = v;
        this._renderAll();
        this._setStatus('SVG applied from editor');
      },
    });
    popup.show();
  }

  _showVectorPreview() {
    const { xml, warnings } = svgToVectorDrawable(this.svgText);
    const popup = new CodeEditorPopup({
      title: 'VectorDrawable (beta)',
      mode: 'xml',
      wrap: true,
      gutter: true,
      value: xml || '<!-- conversion failed -->',
      onApply: (v) => {
        this._lastVector = v;
        this._setStatus('Vector XML kept — use Save vector drawable');
      },
    });
    this._lastVector = xml;
    popup.show();
    if (warnings.length) {
      window.toast?.(warnings.slice(0, 3).join(' · '), 4000);
    }
  }

  async _saveVector() {
    try {
      const { xml, warnings } = svgToVectorDrawable(this.svgText);
      const vectorXml = this._lastVector || xml;
      if (!vectorXml || !vectorXml.includes('<vector')) {
        this._setStatus('Nothing to save', true);
        return;
      }
      if (!this.projectRoot) {
        this._setStatus('No project root — open from an Android project file', true);
        return;
      }
      const name =
        (await promptName('ic_svg_vector')) || 'ic_svg_vector';
      const fileName = name.endsWith('.xml') ? name : `${name}.xml`;

      // res/drawable under app or src
      const root = this.projectRoot.replace(/\/+$/, '');
      let resUrl = `${root}/app/src/main/res`;
      const fs = acode.require('fs') || acode.require('fsOperation');
      if (!(await fs(resUrl).exists().catch(() => false))) {
        resUrl = `${root}/src/main/res`;
      }
      const drawable = await createFolder(resUrl, 'drawable', { overwrite: true });
      await createFile(drawable.url, fileName, vectorXml, { overwrite: true });
      this._setStatus(
        `Saved drawable/${fileName}` +
          (warnings.length ? ` · ${warnings.length} warning(s)` : '')
      );
      window.toast?.(`Saved ${fileName}`, 2500);
    } catch (e) {
      console.error(e);
      this._setStatus(e.message || String(e), true);
    }
  }
}

function renderCell(cell, ei, prop) {
  const kind = cell?.kind || 'none';
  if (kind === 'color') {
    const bg = cell.display || cell.value || '#000';
    return `<button type="button" class="svg-cell color" data-ei="${ei}" data-prop="${escapeAttr(prop)}" title="${escapeAttr(cell.value)}" style="--c:${escapeAttr(bg)}"><span class="cell-fill"></span></button>`;
  }
  if (kind === 'special') {
    return `<button type="button" class="svg-cell special" data-ei="${ei}" data-prop="${escapeAttr(prop)}" title="${escapeAttr(cell.value)}"><span class="cell-special">×</span></button>`;
  }
  return `<button type="button" class="svg-cell none" data-ei="${ei}" data-prop="${escapeAttr(prop)}" title="not set"><span class="cell-empty"></span></button>`;
}

function toColorInput(v) {
  if (!v) return '#000000';
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return (
      '#' +
      v
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('')
    );
  }
  return '#000000';
}

function setRootAttr(svgText, name, value) {
  return svgText.replace(/<svg\b([^>]*)>/i, (full, attrs) => {
    const re = new RegExp(
      `\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s"'=<>]+)`,
      'i'
    );
    let a = attrs.replace(re, '');
    if (value != null && value !== '') {
      a += ` ${name}="${String(value).replace(/"/g, '&quot;')}"`;
    }
    return `<svg${a}>`;
  });
}

async function promptName(def) {
  // minimal
  try {
    const v = window.prompt?.('Drawable name (without path)', def);
    return v;
  } catch (_) {
    return def;
  }
}

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function studioCss() {
  return `
.svg-studio{padding:12px 14px 24px;max-width:960px;margin:0 auto;}
.svg-studio-head{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:12px;}
.svg-studio-title{font-size:1.05rem;font-weight:600;display:flex;align-items:center;gap:8px;}
.svg-studio-title svg{width:22px;height:22px;}
.svg-beta{font-size:0.65rem;opacity:0.55;font-weight:500;border:1px solid rgba(255,255,255,0.2);padding:1px 6px;border-radius:999px;}
.svg-studio-actions{display:flex;flex-wrap:wrap;gap:8px;}
.svg-preview-card{display:flex;gap:14px;align-items:center;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:14px;margin-bottom:12px;}
.svg-preview-stage{width:168px;height:168px;display:flex;align-items:center;justify-content:center;background:repeating-conic-gradient(#2a2a2a 0% 25%,#1c1c1c 0% 50%) 50%/16px 16px;border-radius:12px;overflow:hidden;}
.svg-preview-meta{font-size:0.78rem;opacity:0.7;}
.svg-preview-err{color:#ef9a9a;font-size:0.75rem;padding:8px;}
.svg-palette-row{display:flex;gap:8px;overflow-x:auto;padding:6px 2px 12px;margin-bottom:4px;}
.svg-pal-dot{width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,0.25);flex:0 0 auto;cursor:pointer;padding:0;}
.svg-palette-empty{font-size:0.75rem;opacity:0.5;}
.svg-matrix-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:10px 10px 12px;margin-bottom:12px;}
.svg-matrix-title{font-size:0.85rem;font-weight:600;margin-bottom:8px;}
.svg-matrix-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;}
.svg-matrix-table{border-collapse:separate;border-spacing:6px;min-width:100%;font-size:0.72rem;}
.svg-matrix-table th,.svg-matrix-table td{text-align:center;vertical-align:middle;}
.svg-matrix-table .sticky-col{position:sticky;left:0;background:#1a1d24;z-index:1;text-align:left;padding:0 6px;font-weight:600;}
.tag-pill{display:inline-block;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,0.08);font-family:monospace;font-size:0.68rem;}
.svg-cell{width:34px;height:34px;border-radius:9px;border:0;padding:0;cursor:pointer;background:transparent;display:inline-flex;align-items:center;justify-content:center;}
.svg-cell .cell-fill{width:22px;height:22px;border-radius:6px;background:var(--c,#888);box-shadow:0 0 0 1px rgba(255,255,255,0.2);}
.svg-cell.none .cell-empty{width:22px;height:22px;border-radius:6px;border:1.5px dashed rgba(255,255,255,0.35);background:transparent;}
.svg-cell.special .cell-special{width:22px;height:22px;border-radius:6px;border:1.5px solid rgba(255,193,7,0.7);color:#ffc107;display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1;background:rgba(255,193,7,0.08);}
.svg-legend{display:flex;flex-wrap:wrap;gap:12px;align-items:center;font-size:0.68rem;opacity:0.75;margin:10px 2px 0;}
.svg-legend .cell-swatch{width:14px;height:14px;border-radius:4px;display:inline-block;margin-right:4px;vertical-align:middle;}
.svg-legend .cell-swatch.none{border:1.5px dashed rgba(255,255,255,0.4);}
.svg-legend .cell-swatch.special{border:1.5px solid #ffc107;}
.svg-dim-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;font-size:0.8rem;}
.svg-dim-row label{display:flex;align-items:center;gap:6px;}
.svg-dim-in{width:96px;}
.svg-footer{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;}
.svg-status{margin-top:10px;font-size:0.75rem;opacity:0.8;min-height:1.2em;}
`;
}
