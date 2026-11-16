/**
 * SVG Studio — tag-centric editor:
 * vertical tag list, prop panel, highlight overlay, local SVG import,
 * Continue → Icon Studio, SVG → VectorDrawable.
 */

import { svgs } from '../../assets/icons/svg/svg.js';
import { pageStyles } from '../../styles/styles.js';
import { customSelectStyles } from '../../styles/customSelectStyles.js';
import { CodeEditorPopup } from '../../reusable/CodeEditorPopup.js';
import {
  parseSvgColors,
  applySvgColor,
  collectPalette,
} from './SvgColorModel.js';
import { svgToVectorDrawable } from './SvgToVector.js';
import { createFolder, createFile } from '../../operations/fileOperations.js';
import { CustomSelect } from '../../reusable/CustomSelect.js';

const SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 12.6111L8.92308 17.5L20 6.5" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

/** Props shown in the inspector (basic, practical set) */
const PROP_DEFS = [
  { key: 'fill', type: 'color', hint: 'Fill color' },
  { key: 'stroke', type: 'color', hint: 'Stroke color' },
  { key: 'stroke-width', type: 'number', hint: 'e.g. 1.5' },
  { key: 'stroke-linecap', type: 'enum', options: ['', 'butt', 'round', 'square'], hint: 'Line ends' },
  { key: 'stroke-linejoin', type: 'enum', options: ['', 'miter', 'round', 'bevel'], hint: 'Corners' },
  { key: 'stroke-dasharray', type: 'text', hint: 'e.g. 4 2' },
  { key: 'opacity', type: 'number', hint: '0–1' },
  { key: 'fill-opacity', type: 'number', hint: '0–1' },
  { key: 'stroke-opacity', type: 'number', hint: '0–1' },
  { key: 'fill-rule', type: 'enum', options: ['', 'nonzero', 'evenodd'], hint: '' },
  { key: 'color', type: 'color', hint: 'currentColor base' },
  { key: 'stop-color', type: 'color', hint: 'Gradient stop' },
];

const COLOR_PRESETS = [
  { label: 'none', value: 'none' },
  { label: 'currentColor', value: 'currentColor' },
  { label: 'transparent', value: 'transparent' },
  { label: 'inherit', value: 'inherit' },
  { label: 'Black', value: '#000000' },
  { label: 'White', value: '#FFFFFF' },
  { label: 'Red', value: '#EF5350' },
  { label: 'Blue', value: '#42A5F5' },
  { label: 'Green', value: '#66BB6A' },
  { label: 'Amber', value: '#FFB300' },
];

/** Suggested extra props user can add to selected tag */
const PROP_SUGGESTIONS = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-miterlimit',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'fill-rule',
  'clip-rule',
  'color',
  'stop-color',
  'stop-opacity',
  'transform',
  'filter',
  'mask',
  'clip-path',
  'display',
  'visibility',
  'pointer-events',
  'rx',
  'ry',
  'r',
  'cx',
  'cy',
  'x',
  'y',
  'width',
  'height',
  'd',
  'points',
  'x1',
  'y1',
  'x2',
  'y2',
];

export class SvgStudioUI {
  constructor() {
    this.tabId = 'android.svg.studio';
    this.editorFile = null;
    this.projectRoot = '';
    this.svgText = SAMPLE;
    this._$ = null;
    this._onContinue = null;
    this._selectedIdx = 0;
    this._lastVector = null;
    this._extraProps = Object.create(null); // idx → string[] of custom prop keys
    this._customSelects = [];
    this._scrollObs = null;
    this._swatchTarget = null;
  }

  resolveProjectRoot(filePath) {
    try {
      const p = String(filePath || '');
      if (!p) return '';
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
    this._onContinue =
      opts && typeof opts.onContinue === 'function' ? opts.onContinue : null;
    if (initialSvg) this.svgText = String(initialSvg);
    this._selectedIdx = 0;
    this._extraProps = Object.create(null);

    const EditorFile = acode.require('editorFile');
    const $c = document.createElement('div');
    $c.className = 'andro-build-page svg-studio-page';
    this._$ = $c;

    $c.innerHTML = `
      <style>${studioCss()}</style>
      <div class="ss" id="ss-root">
        <header class="ss-head">
          <div class="ss-title">
            <span class="ss-title-icon">${(svgs && svgs.image) || '◈'}</span>
            <div>
              <div class="ss-title-text">SVG Studio</div>
              <div class="ss-title-sub">Tags · props · highlight · vector</div>
            </div>
          </div>
          <div class="ss-head-actions">
            <label class="ss-btn ss-btn-ghost ss-file-label">
              <input type="file" id="ss-file" accept=".svg,image/svg+xml,text/plain" hidden />
              Replace SVG
            </label>
            <button type="button" class="ss-btn ss-btn-ghost" id="ss-sample">Sample</button>
            <button type="button" class="ss-btn ss-btn-ghost" id="ss-editor">Source</button>
            <button type="button" class="ss-btn ss-btn-ghost" id="ss-vector">→ Vector</button>
          </div>
        </header>
        <div class="ss-mini" id="ss-mini" aria-hidden="true">
          <div class="ss-mini-stage" id="ss-mini-stage"></div>
          <div class="ss-mini-meta" id="ss-mini-meta">Preview</div>
        </div>


        <div class="ss-preview-wrap">
          <div class="ss-preview-stage" id="ss-stage"></div>
          <div class="ss-preview-side">
            <div class="ss-meta" id="ss-meta">—</div>
            <div class="ss-dims">
              <label class="ss-field">
                <span>W</span>
                <input id="ss-w" class="ss-input ss-input-sm" type="text" placeholder="width" />
              </label>
              <label class="ss-field">
                <span>H</span>
                <input id="ss-h" class="ss-input ss-input-sm" type="text" placeholder="height" />
              </label>
            </div>
            <div class="ss-palette" id="ss-palette"></div>
          </div>
        </div>

        <div class="ss-workspace">
          <aside class="ss-tags-panel">
            <div class="ss-panel-label">Tags</div>
            <div class="ss-tag-list" id="ss-tags"></div>
          </aside>
          <section class="ss-props-panel">
            <div class="ss-panel-label" id="ss-props-title">Properties</div>
            <div class="ss-props-body" id="ss-props"></div>
            <div class="ss-add-prop">
              <div class="ss-panel-label">Add property</div>
              <div class="ss-suggest" id="ss-suggest"></div>
              <div class="ss-add-row">
                <input id="ss-add-key" class="ss-input" type="text" placeholder="prop name" list="ss-prop-list" />
                <datalist id="ss-prop-list"></datalist>
                <button type="button" class="ss-btn ss-btn-primary ss-btn-sm" id="ss-add-btn">Add</button>
              </div>
            </div>
          </section>
        </div>

        <footer class="ss-footer">
          <button type="button" class="ss-btn ss-btn-ghost" id="ss-close">Close</button>
          <button type="button" class="ss-btn ss-btn-ghost" id="ss-save-vd">Save vector</button>
          <button type="button" class="ss-btn ss-btn-primary" id="ss-continue" style="display:none;">Continue</button>
        </footer>
        <div class="ss-status" id="ss-status"></div>
      </div>
    `;

    const sheet = (typeof pageStyles === 'string' ? pageStyles : '') + (typeof customSelectStyles === 'string' ? customSelectStyles : '');
    this.editorFile = new EditorFile('SVG Studio', {
      type: 'page',
      tabIcon: 'icon image',
      content: $c,
      id: this.tabId,
      stylesheets: sheet ? [sheet] : undefined,
    });

    this._bind($c);
    this._renderAll();
  }

  _bind($c) {
    $c.querySelector('#ss-close').onclick = () => this.editorFile?.remove();
    $c.querySelector('#ss-sample').onclick = () => {
      this.svgText = SAMPLE;
      this._selectedIdx = 0;
      this._extraProps = Object.create(null);
      this._renderAll();
      this._setStatus('Sample loaded');
    };
    $c.querySelector('#ss-editor').onclick = () => this._openEditor();
    $c.querySelector('#ss-vector').onclick = () => this._showVectorPreview();
    $c.querySelector('#ss-save-vd').onclick = () => this._saveVector();

    const file = $c.querySelector('#ss-file');
    file.onchange = async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        if (!/<svg[\s>]/i.test(text)) {
          this._setStatus('Not a valid SVG file', true);
          return;
        }
        this.svgText = text;
        this._selectedIdx = 0;
        this._extraProps = Object.create(null);
        this._renderAll();
        this._setStatus('Replaced with ' + f.name);
      } catch (err) {
        this._setStatus(err.message || String(err), true);
      }
      e.target.value = '';
    };

    const cont = $c.querySelector('#ss-continue');
    if (this._onContinue) {
      cont.style.display = '';
      cont.onclick = () => {
        try {
          this._onContinue(this.svgText);
        } catch (e) {
          console.error(e);
        }
        this.editorFile?.remove();
      };
    }

    $c.querySelector('#ss-w').onchange = (e) => {
      this.svgText = setRootAttr(this.svgText, 'width', e.target.value.trim());
      this._renderAll();
    };
    $c.querySelector('#ss-h').onchange = (e) => {
      this.svgText = setRootAttr(this.svgText, 'height', e.target.value.trim());
      this._renderAll();
    };

    $c.querySelector('#ss-add-btn').onclick = () => this._addPropFromInput();
    $c.querySelector('#ss-add-key').addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        this._addPropFromInput();
      }
    });

    const dl = $c.querySelector('#ss-prop-list');
    dl.innerHTML = PROP_SUGGESTIONS.map((p) => `<option value="${escapeAttr(p)}"></option>`).join(
      ''
    );

    // Sticky mini-preview when main stage scrolls out of view
    this._setupStickyPreview($c);

    // Global swatch color picker (replace-all)
    const swPick = $c.querySelector('#ss-swatch-color');
    if (swPick) {
      swPick.oninput = () => {
        const from = this._swatchTarget;
        const to = swPick.value;
        if (!from || !to) return;
        this._replaceColorEverywhere(from, to);
        this._swatchTarget = to;
        this._setStatus(`Recolored ${from} → ${to}`);
      };
    }
  }

  _setupStickyPreview($c) {
    const root = $c.querySelector('#ss-root') || $c.querySelector('.ss');
    const stage = $c.querySelector('#ss-stage');
    const mini = $c.querySelector('#ss-mini');
    if (!root || !stage || !mini) return;
    const update = () => {
      try {
        const rootRect = root.getBoundingClientRect();
        const stageRect = stage.getBoundingClientRect();
        // hide when stage top is above root visible top (scrolled away)
        const hidden = stageRect.bottom < rootRect.top + 8 || stageRect.top > rootRect.bottom - 8;
        // more precisely: stage no longer fully visible at top of scrollport
        const stageH = Math.max(stageRect.height, 1);
        const visibleTop = Math.max(stageRect.top, rootRect.top);
        const visibleBottom = Math.min(stageRect.bottom, rootRect.bottom);
        const visible = Math.max(0, visibleBottom - visibleTop);
        const coveredRatio = 1 - visible / stageH;
        // show bubble when more than half the preview is covered
        if (coveredRatio > 0.5) {
          mini.classList.add('is-on');
          mini.setAttribute('aria-hidden', 'false');
          this._paintMini();
        } else {
          mini.classList.remove('is-on');
          mini.setAttribute('aria-hidden', 'true');
        }
      } catch (_) {}
    };
    root.addEventListener('scroll', update, { passive: true });
    // also when window scrolls
    window.addEventListener('scroll', update, { passive: true });
    this._scrollObs = update;
    setTimeout(update, 50);
  }

  _paintMini() {
    const stage = this._$?.querySelector('#ss-stage');
    const miniStage = this._$?.querySelector('#ss-mini-stage');
    const miniMeta = this._$?.querySelector('#ss-mini-meta');
    if (!miniStage) return;
    try {
      const safe = this.svgText.replace(/<script[\s\S]*?<\/script>/gi, '');
      miniStage.innerHTML = safe;
      const svg = miniStage.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
      }
      if (miniMeta) {
        const m = this._model();
        const el = m.elements[this._selectedIdx];
        miniMeta.textContent = el ? el.label : `${m.elements.length} tags`;
      }
    } catch (_) {
      miniStage.innerHTML = '';
    }
  }

  _setStatus(msg, isErr) {
    const el = this._$?.querySelector('#ss-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('is-err', !!isErr);
  }

  _model() {
    return parseSvgColors(this.svgText);
  }

  _renderAll() {
    this._renderPreview();
    this._renderTags();
    this._renderProps();
    this._renderDims();
    this._renderPalette();
    this._renderSuggestions();
    try {
      this._paintMini();
    } catch (_) {}
  }

  _renderDims() {
    const model = this._model();
    const root = model.elements.find((e) => e.tag === 'svg');
    const w = this._$?.querySelector('#ss-w');
    const h = this._$?.querySelector('#ss-h');
    if (w) w.value = root?.attrs?.width || '';
    if (h) h.value = root?.attrs?.height || '';
  }

  _renderPalette() {
    const row = this._$?.querySelector('#ss-palette');
    if (!row) return;
    const colors = collectPalette(this._model());
    if (!colors.length) {
      row.innerHTML = '<span class="ss-swatch-hint">No colors</span>';
      return;
    }
    row.innerHTML =
      colors
        .map(
          (c) =>
            `<button type="button" class="ss-swatch" title="Tap: recolor all · Long-press: copy ${escapeAttr(c)}" style="--c:${escapeAttr(c)}" data-c="${escapeAttr(c)}"></button>`
        )
        .join('') + '<span class="ss-swatch-hint">tap = recolor · hold = copy</span>';

    row.querySelectorAll('.ss-swatch').forEach((btn) => {
      const color = btn.getAttribute('data-c');
      let pressTimer = null;
      let longPressed = false;
      const cancel = () => {
        if (pressTimer) clearTimeout(pressTimer);
        pressTimer = null;
      };
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        longPressed = false;
        pressTimer = setTimeout(async () => {
          longPressed = true;
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(color);
            } else {
              const ta = document.createElement('textarea');
              ta.value = color;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              ta.remove();
            }
            window.toast?.(color + ' copied', 1500);
            this._setStatus('Copied ' + color);
          } catch (_) {
            window.toast?.('Copy failed', 1500);
          }
        }, 480);
      });
      btn.addEventListener('pointerup', (e) => {
        e.preventDefault();
        e.stopPropagation();
        cancel();
        if (longPressed) return;
        this._openSwatchPicker(color, btn);
      });
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      btn.addEventListener('pointerleave', cancel);
      btn.addEventListener('pointercancel', cancel);
    });
  }

  _renderPreview() {
    const stage = this._$?.querySelector('#ss-stage');
    const meta = this._$?.querySelector('#ss-meta');
    if (!stage) return;
    try {
      const safe = this.svgText.replace(/<script[\s\S]*?<\/script>/gi, '');
      stage.innerHTML = safe;
      const svg = stage.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.maxWidth = '100%';
        svg.style.maxHeight = '100%';
        // Map DOM nodes → model indices (document order of elements)
        const model = this._model();
        const domEls = [];
        const walk = (node) => {
          if (!node || node.nodeType !== 1) return;
          const tag = (node.tagName || '').toLowerCase().replace(/^svg:/, '');
          if (tag && tag !== 'svg') domEls.push(node);
          Array.from(node.children || []).forEach(walk);
        };
        walk(svg);
        // Prefer matching by sequential non-svg elements
        let di = 0;
        model.elements.forEach((el, idx) => {
          if (el.tag === 'svg') return;
          const node = domEls[di++];
          if (!node) return;
          node.setAttribute('data-ss-idx', String(idx));
          node.classList.toggle('ss-hl', idx === this._selectedIdx);
        });
      }
      const m = this._model();
      if (meta) {
        meta.textContent = `${m.elements.length} tag(s) · ${collectPalette(m).length} color(s)`;
      }
    } catch (e) {
      stage.innerHTML = `<div class="ss-preview-err">${escapeAttr(e.message || e)}</div>`;
    }
  }

  _renderTags() {
    const host = this._$?.querySelector('#ss-tags');
    if (!host) return;
    const model = this._model();
    if (!model.elements.length) {
      host.innerHTML = `<div class="ss-empty">No tags</div>`;
      return;
    }
    host.innerHTML = model.elements
      .map((el, idx) => {
        const active = idx === this._selectedIdx ? ' is-active' : '';
        return `<button type="button" class="ss-tag${active}" data-idx="${idx}">
          <span class="ss-tag-name">${escapeAttr(el.label)}</span>
          <span class="ss-tag-n">#${idx}</span>
        </button>`;
      })
      .join('');
    host.querySelectorAll('.ss-tag').forEach((btn) => {
      btn.onclick = () => {
        this._selectedIdx = +btn.getAttribute('data-idx');
        this._renderAll();
      };
    });
  }

  _attrValue(el, key) {
    if (!el) return '';
    if (el.styleMap && el.styleMap[key] != null && el.styleMap[key] !== '') {
      return el.styleMap[key];
    }
    if (el.attrs && el.attrs[key] != null) return el.attrs[key];
    // color props from model
    if (el.props && el.props[key] && el.props[key].value != null) {
      return el.props[key].value;
    }
    return '';
  }

  _renderProps() {
    const host = this._$?.querySelector('#ss-props');
    const title = this._$?.querySelector('#ss-props-title');
    if (!host) return;

    // destroy previous custom selects
    (this._customSelects || []).forEach((s) => {
      try {
        s.destroy();
      } catch (_) {}
    });
    this._customSelects = [];

    const model = this._model();
    const el = model.elements[this._selectedIdx];
    if (!el) {
      host.innerHTML = `<div class="ss-empty">Select a tag</div>`;
      if (title) title.textContent = 'Properties';
      return;
    }
    if (title) title.textContent = `Properties · ${el.label}`;

    const extras = this._extraProps[this._selectedIdx] || [];
    const keys = [];
    const seen = new Set();
    PROP_DEFS.forEach((p) => {
      keys.push(p);
      seen.add(p.key);
    });
    extras.forEach((k) => {
      if (!seen.has(k)) {
        keys.push({ key: k, type: 'text', hint: '' });
        seen.add(k);
      }
    });

    host.innerHTML = keys
      .map((def) => {
        const isEnum = def.type === 'enum';
        const isColor = def.type === 'color';
        let control = '';
        if (isEnum) {
          control = `<div class="ss-cselect" data-prop="${escapeAttr(def.key)}"></div>`;
        } else if (isColor) {
          const val = this._attrValue(el, def.key);
          control = `
            <div class="ss-color-row">
              <input type="color" class="ss-color-picker" data-prop="${escapeAttr(def.key)}" value="${toColorInput(val)}" title="Picker" />
              <input type="text" class="ss-input ss-prop-text" data-prop="${escapeAttr(def.key)}" value="${escapeAttr(val)}" placeholder="${escapeAttr(def.hint || def.key)}" />
            </div>
            <div class="ss-presets" data-prop="${escapeAttr(def.key)}">
              ${COLOR_PRESETS.map((p) => `<button type="button" class="ss-preset" data-v="${escapeAttr(p.value)}">${escapeAttr(p.label)}</button>`).join('')}
              <button type="button" class="ss-preset ss-preset-clear" data-v="">Clear</button>
            </div>`;
        } else {
          const val = this._attrValue(el, def.key);
          control = `<input type="text" class="ss-input ss-prop-text" data-prop="${escapeAttr(def.key)}" value="${escapeAttr(val)}" placeholder="${escapeAttr(def.hint || def.key)}" />`;
        }
        return `<div class="ss-prop" data-prop-row="${escapeAttr(def.key)}">
          <div class="ss-prop-key">${escapeAttr(def.key)}</div>
          <div class="ss-prop-ctrl">${control}</div>
          <button type="button" class="ss-prop-del" data-del="${escapeAttr(def.key)}" title="Remove property">✕</button>
        </div>`;
      })
      .join('');

    // Custom selects for enums
    host.querySelectorAll('.ss-cselect').forEach((box) => {
      const prop = box.getAttribute('data-prop');
      const def = PROP_DEFS.find((p) => p.key === prop) || { options: [''] };
      const val = this._attrValue(el, prop);
      const sel = new CustomSelect({
        options: (def.options || ['']).map((o) => ({
          value: o,
          label: o === '' ? '—' : o,
        })),
        value: val || '',
        placeholder: '—',
        onChange: (v) => this._setProp(prop, v),
      });
      box.appendChild(sel.el);
      this._customSelects.push(sel);
    });

    host.querySelectorAll('.ss-prop-text').forEach((inp) => {
      const apply = () => {
        const prop = inp.getAttribute('data-prop');
        this._setProp(prop, inp.value);
      };
      inp.onchange = apply;
      inp.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          apply();
        }
      });
    });
    host.querySelectorAll('.ss-color-picker').forEach((pk) => {
      pk.oninput = () => {
        const prop = pk.getAttribute('data-prop');
        let match = null;
        host.querySelectorAll('.ss-prop-text').forEach((el) => {
          if (el.getAttribute('data-prop') === prop) match = el;
        });
        if (match) match.value = pk.value;
        this._setProp(prop, pk.value);
      };
    });
    host.querySelectorAll('.ss-presets').forEach((row) => {
      const prop = row.getAttribute('data-prop');
      row.querySelectorAll('.ss-preset').forEach((btn) => {
        btn.onclick = () => {
          const v = btn.getAttribute('data-v');
          this._setProp(prop, v === '' ? null : v);
        };
      });
    });
    host.querySelectorAll('.ss-prop-del').forEach((btn) => {
      btn.onclick = () => {
        const prop = btn.getAttribute('data-del');
        this._removeProp(prop);
      };
    });
  }

  _renderSuggestions() {
    const host = this._$?.querySelector('#ss-suggest');
    if (!host) return;
    const model = this._model();
    const el = model.elements[this._selectedIdx];
    if (!el) {
      host.innerHTML = '';
      return;
    }
    const present = new Set([
      ...Object.keys(el.attrs || {}),
      ...Object.keys(el.styleMap || {}),
      ...(this._extraProps[this._selectedIdx] || []),
    ]);
    const list = PROP_SUGGESTIONS.filter((p) => !present.has(p)).slice(0, 12);
    host.innerHTML = list
      .map((p) => `<button type="button" class="ss-chip" data-p="${escapeAttr(p)}">+ ${escapeAttr(p)}</button>`)
      .join('');
    host.querySelectorAll('.ss-chip').forEach((btn) => {
      btn.onclick = () => {
        const key = btn.getAttribute('data-p');
        this._ensureExtraProp(key);
        this._renderProps();
        this._renderSuggestions();
      };
    });
  }

  _ensureExtraProp(key) {
    const k = String(key || '').trim();
    if (!k) return;
    const idx = this._selectedIdx;
    if (!this._extraProps[idx]) this._extraProps[idx] = [];
    if (!this._extraProps[idx].includes(k)) this._extraProps[idx].push(k);
  }

  _addPropFromInput() {
    const inp = this._$?.querySelector('#ss-add-key');
    const key = (inp?.value || '').trim();
    if (!key) return;
    this._ensureExtraProp(key);
    if (inp) inp.value = '';
    this._renderProps();
    this._renderSuggestions();
    this._setStatus(`Added “${key}” on selected tag`);
  }



  _openSwatchPicker(color, anchorEl) {
    const pick = this._$?.querySelector('#ss-swatch-color');
    if (!pick) {
      this._setStatus('Color picker missing', true);
      return;
    }
    this._swatchTarget = color;
    pick.value = toColorInput(color);
    try {
      const r = (anchorEl || pick).getBoundingClientRect();
      pick.style.cssText =
        'position:fixed;opacity:0.02;pointer-events:auto;z-index:99999;' +
        'left:' + Math.max(8, r.left) + 'px;top:' + Math.max(8, r.top) + 'px;' +
        'width:' + Math.max(44, r.width) + 'px;height:' + Math.max(44, r.height) + 'px;border:0;padding:0;';
    } catch (_) {}
    const open = () => {
      try {
        if (typeof pick.showPicker === 'function') {
          pick.showPicker();
          return true;
        }
      } catch (_) {}
      try {
        pick.focus();
        pick.click();
        return true;
      } catch (_) {
        return false;
      }
    };
    if (!open()) setTimeout(open, 40);
    this._setStatus('Pick a new color for ' + color);
  }

  _replaceColorEverywhere(fromColor, toColor) {
    if (!fromColor || !toColor) return;
    const from = String(fromColor).trim();
    const to = String(toColor).trim();
    if (!from || from.toLowerCase() === to.toLowerCase()) return;
    const colorKeys = ['fill', 'stroke', 'color', 'stop-color'];
    let guard = 0;
    while (guard++ < 48) {
      const m = this._model();
      let hit = false;
      for (let i = 0; i < m.elements.length; i++) {
        for (const key of colorKeys) {
          const cur = this._attrValue(m.elements[i], key);
          if (cur && String(cur).trim().toLowerCase() === from.toLowerCase()) {
            this.svgText = applySvgColor(this.svgText, i, key, to);
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      if (!hit) break;
    }
    this._renderAll();
  }

  _removeProp(prop) {
    const idx = this._selectedIdx;
    const key = String(prop || '');
    if (!key) return;
    const colorKeys = ['fill', 'stroke', 'color', 'stop-color'];
    if (colorKeys.includes(key)) {
      this.svgText = applySvgColor(this.svgText, idx, key, null);
    } else {
      this.svgText = applySvgAttr(this.svgText, idx, key, null);
    }
    if (this._extraProps[idx]) {
      this._extraProps[idx] = this._extraProps[idx].filter((k) => k !== key);
    }
    this._renderAll();
    this._setStatus('Removed ' + key);
  }

  _setProp(prop, value) {
    const idx = this._selectedIdx;
    // Color-like props go through applySvgColor when known
    const colorKeys = ['fill', 'stroke', 'color', 'stop-color'];
    if (colorKeys.includes(prop)) {
      this.svgText = applySvgColor(
        this.svgText,
        idx,
        prop,
        value == null || value === '' ? null : value
      );
    } else {
      this.svgText = applySvgAttr(this.svgText, idx, prop, value);
    }
    this._renderAll();
    this._setStatus(`Updated ${prop}`);
  }

  _openEditor() {
    const popup = new CodeEditorPopup({
      title: 'SVG source',
      mode: 'svg',
      wrap: true,
      gutter: true,
      value: this.svgText,
      onChange: (v) => {
        // live but avoid thrashing — soft update
        this.svgText = v;
      },
      onApply: (v) => {
        this.svgText = v;
        this._selectedIdx = 0;
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
        this._setStatus('Vector XML kept — use Save vector');
      },
    });
    this._lastVector = xml;
    popup.show();
    if (warnings?.length) window.toast?.(warnings.slice(0, 3).join(' · '), 4000);
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
      const name = (await promptName('ic_svg_vector')) || 'ic_svg_vector';
      const fileName = name.endsWith('.xml') ? name : `${name}.xml`;
      const root = this.projectRoot.replace(/\/+$/, '');
      let resUrl = `${root}/app/src/main/res`;
      const fs = acode.require('fs') || acode.require('fsOperation');
      if (!(await fs(resUrl).exists().catch(() => false))) {
        resUrl = `${root}/src/main/res`;
      }
      const drawable = await createFolder(resUrl, 'drawable', { overwrite: true });
      await createFile(drawable.url, fileName, vectorXml, { overwrite: true });
      this._setStatus(
        `Saved drawable/${fileName}` + (warnings?.length ? ` · ${warnings.length} warning(s)` : '')
      );
      window.toast?.(`Saved ${fileName}`, 2500);
    } catch (e) {
      console.error(e);
      this._setStatus(e.message || String(e), true);
    }
  }
}

/** Generic attr set/remove on element by model index (mirrors applySvgColor) */
function applySvgAttr(svgText, elementIndex, prop, value) {
  const model = parseSvgColors(svgText);
  const el = model.elements[elementIndex];
  if (!el) return svgText;
  let tag = el.rawTag;
  if (el.attrs.style != null) {
    const style = rewriteStyle(el.attrs.style, prop, null);
    tag = setOrRemoveAttr(tag, 'style', style === '' ? null : style);
  }
  if (value == null || value === '') {
    tag = setOrRemoveAttr(tag, prop, null);
  } else {
    tag = setOrRemoveAttr(tag, prop, value);
  }
  return svgText.slice(0, el.start) + tag + svgText.slice(el.end);
}

function rewriteStyle(style, prop, value) {
  const map = Object.create(null);
  String(style || '')
    .split(';')
    .forEach((part) => {
      const i = part.indexOf(':');
      if (i < 0) return;
      const k = part.slice(0, i).trim().toLowerCase();
      const v = part.slice(i + 1).trim();
      if (k) map[k] = v;
    });
  if (value == null || value === '') delete map[prop];
  else map[prop] = value;
  return Object.keys(map)
    .map((k) => `${k}:${map[k]}`)
    .join(';');
}

function setOrRemoveAttr(tagSrc, name, value) {
  const re = new RegExp(
    `(\\s)${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s"'=<>\`]+)`,
    'i'
  );
  if (value == null || value === '') {
    return tagSrc.replace(re, '');
  }
  const quoted = `"${String(value).replace(/"/g, '&quot;')}"`;
  if (re.test(tagSrc)) {
    return tagSrc.replace(re, `$1${name}=${quoted}`);
  }
  if (/\/>$/.test(tagSrc)) {
    return tagSrc.replace(/\s*\/>$/, ` ${name}=${quoted}/>`);
  }
  return tagSrc.replace(/\s*>$/, ` ${name}=${quoted}>`);
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

async function promptName(def) {
  try {
    return window.prompt?.('Drawable name (without path)', def);
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
.ss{--ss-bg:#12141a;--ss-card:#1a1d26;--ss-line:rgba(255,255,255,.12);--ss-text:#e8eaed;--ss-muted:rgba(255,255,255,.55);--ss-accent:#7c9cff;--ss-accent2:#5c7cfa;--ss-danger:#ef9a9a;
  padding:10px 12px 24px;max-width:980px;margin:0 auto;color:var(--ss-text);
  font-family:system-ui,-apple-system,sans-serif;box-sizing:border-box;
  max-height:calc(100vh - 24px);overflow:auto;-webkit-overflow-scrolling:touch;position:relative;}
.ss *,.ss *::before,.ss *::after{box-sizing:border-box;}
.ss-head{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:12px;}
.ss-title{display:flex;gap:8px;align-items:center;}
.ss-title-icon{width:24px;height:24px;display:flex;align-items:center;justify-content:center;opacity:.9;}
.ss-title-icon svg{width:20px;height:20px;}
.ss-title-text{font-size:1rem;font-weight:650;}
.ss-title-sub{font-size:.7rem;color:var(--ss-muted);margin-top:1px;}
.ss-head-actions{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}

.ss-btn{appearance:none;border:1px solid var(--ss-line);background:rgba(255,255,255,.06);color:var(--ss-text);
  font-size:.78rem;font-weight:560;padding:7px 10px;border-radius:2px;cursor:pointer;line-height:1.2;}
.ss-btn:hover{background:rgba(255,255,255,.1);}
.ss-btn-ghost{background:transparent;}
.ss-btn-primary{background:linear-gradient(180deg,var(--ss-accent),var(--ss-accent2));border-color:transparent;color:#0b1020;font-weight:650;}
.ss-btn-sm{padding:5px 8px;font-size:.72rem;}
.ss-btn-icon{padding:4px 6px;min-width:28px;}
.ss-file-label{display:inline-flex;align-items:center;margin:0;}

/* sticky mini preview */
.ss-mini{position:sticky;top:0;z-index:40;display:none;align-items:center;gap:12px;
  background:rgba(18,20,26,.94);backdrop-filter:blur(10px);border:1px solid var(--ss-line);
  border-radius:999px;padding:8px 14px 8px 8px;margin:0 0 10px;width:fit-content;max-width:100%;
  box-shadow:0 8px 28px rgba(0,0,0,.35);
  transform:translateY(-12px) scale(0.72);opacity:0;pointer-events:none;
  transition:opacity .28s cubic-bezier(.2,.9,.2,1), transform .32s cubic-bezier(.34,1.4,.64,1);
  transform-origin:top left;}
.ss-mini.is-on{display:flex;opacity:1;pointer-events:auto;transform:translateY(0) scale(1);}
.ss-mini-stage{width:72px;height:72px;flex:0 0 72px;border-radius:50%;overflow:hidden;
  background:repeating-conic-gradient(#2a2d36 0% 25%,#1e2129 0% 50%) 50%/8px 8px;
  display:flex;align-items:center;justify-content:center;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.08), 0 0 0 3px rgba(124,156,255,.2);}
.ss-mini-stage svg{max-width:78%;max-height:78%;}
.ss-mini-meta{font-size:.78rem;color:var(--ss-muted);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:6px;}

.ss-preview-wrap{display:flex;gap:10px;align-items:stretch;background:var(--ss-card);border:1px solid var(--ss-line);border-radius:2px;padding:10px;margin-bottom:10px;}
.ss-preview-stage{flex:0 0 min(42vw,200px);width:min(42vw,200px);height:200px;display:flex;align-items:center;justify-content:center;
  background:repeating-conic-gradient(#2a2d36 0% 25%,#1e2129 0% 50%) 50%/14px 14px;border-radius:2px;overflow:hidden;position:relative;}
.ss-preview-stage svg .ss-hl,.ss-preview-stage .ss-hl{outline:2px solid var(--ss-accent);outline-offset:1px;filter:drop-shadow(0 0 6px rgba(124,156,255,.55));}
.ss-preview-side{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;justify-content:center;}
.ss-meta{font-size:.76rem;color:var(--ss-muted);}
.ss-preview-err{color:var(--ss-danger);font-size:.75rem;padding:8px;}
.ss-dims{display:flex;gap:8px;flex-wrap:wrap;}
.ss-field{display:flex;align-items:center;gap:6px;font-size:.72rem;color:var(--ss-muted);}
.ss-field>span{width:14px;text-align:center;font-weight:600;}

/* underline-only inputs */
.ss-input{width:100%;background:rgba(0,0,0,.22);border:none;border-bottom:1px solid rgba(255,255,255,.14);
  border-radius:2px;padding:5px 8px;font-size:.78rem;color:var(--ss-text);outline:none;min-height:28px;line-height:1.25;}
.ss-input:focus{border-bottom-color:rgba(124,156,255,.55);box-shadow:0 1px 0 0 rgba(124,156,255,.35);}
.ss-input-sm{width:84px;padding:4px 6px;font-size:.72rem;min-height:26px;}
.ss-input::placeholder{color:rgba(255,255,255,.32);}

.ss-palette{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
.ss-swatch{width:22px;height:22px;border-radius:2px;border:1px solid rgba(255,255,255,.28);background:var(--c,#888);padding:0;cursor:pointer;position:relative;}
.ss-swatch:hover{transform:scale(1.06);}
.ss-swatch-hint{font-size:.65rem;color:var(--ss-muted);margin-left:4px;}

.ss-workspace{display:grid;grid-template-columns:minmax(110px,150px) 1fr;gap:10px;margin-bottom:12px;}
@media (max-width:560px){.ss-workspace{grid-template-columns:1fr;}.ss-preview-wrap{flex-direction:column;}.ss-preview-stage{width:100%;flex-basis:180px;}}
.ss-tags-panel,.ss-props-panel{background:var(--ss-card);border:1px solid var(--ss-line);border-radius:2px;padding:8px;min-height:180px;}
.ss-panel-label{font-size:.68rem;font-weight:650;letter-spacing:.04em;text-transform:uppercase;color:var(--ss-muted);margin-bottom:6px;}
.ss-tag-list{display:flex;flex-direction:column;gap:4px;max-height:300px;overflow:auto;-webkit-overflow-scrolling:touch;}
.ss-tag{display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;text-align:left;padding:6px 8px;border-radius:2px;border:1px solid transparent;background:rgba(255,255,255,.03);color:var(--ss-text);cursor:pointer;font-size:.78rem;}
.ss-tag:hover{background:rgba(255,255,255,.07);}
.ss-tag.is-active{background:rgba(124,156,255,.16);border-color:rgba(124,156,255,.4);}
.ss-tag-name{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.76rem;}
.ss-tag-n{font-size:.62rem;color:var(--ss-muted);}
.ss-empty{font-size:.76rem;color:var(--ss-muted);padding:6px 2px;}

.ss-props-body{display:flex;flex-direction:column;gap:10px;max-height:280px;overflow:auto;padding-right:2px;}
.ss-prop{display:grid;grid-template-columns:minmax(84px,110px) 1fr auto;gap:6px;align-items:start;}
.ss-prop-key{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.7rem;padding-top:6px;color:rgba(255,255,255,.75);}
.ss-prop-ctrl{min-width:0;}
.ss-prop-del{appearance:none;border:1px solid transparent;background:transparent;color:var(--ss-muted);cursor:pointer;border-radius:2px;padding:4px 6px;font-size:.75rem;line-height:1;margin-top:2px;}
.ss-prop-del:hover{color:var(--ss-danger);background:rgba(239,154,154,.1);}
.ss-color-row{display:flex;gap:6px;align-items:center;}
.ss-color-picker{width:32px;height:28px;border:none;padding:0;background:transparent;cursor:pointer;border-radius:2px;}
.ss-presets{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;}
.ss-preset{appearance:none;border:1px solid var(--ss-line);background:rgba(255,255,255,.05);color:var(--ss-text);font-size:.62rem;padding:3px 6px;border-radius:2px;cursor:pointer;}
.ss-preset:hover{border-color:rgba(124,156,255,.45);}

.ss-add-prop{margin-top:10px;padding-top:8px;border-top:1px solid var(--ss-line);}
.ss-suggest{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px;}
.ss-chip{appearance:none;border:1px dashed rgba(255,255,255,.2);background:transparent;color:var(--ss-muted);font-size:.66rem;padding:3px 7px;border-radius:2px;cursor:pointer;}
.ss-chip:hover{color:var(--ss-text);border-color:rgba(124,156,255,.4);}
.ss-add-row{display:flex;gap:6px;align-items:center;}
.ss-add-row .ss-input{flex:1;}

.ss-footer{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;}
.ss-status{margin-top:8px;font-size:.72rem;color:var(--ss-muted);min-height:1.15em;}
.ss-status.is-err{color:var(--ss-danger);}

/* hidden color input for swatch recolor */
.ss-hidden-color{position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0;}
`;
}
