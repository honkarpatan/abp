/**
 * Code editor popup — prefers Acode's Ace (reliable), else plain textarea.
 * No dual-layer highlight (was causing garbled display while copy stayed correct).
 */

import { Modal } from './Modal.js';

const SVG_VOIDISH = new Set([
  'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'stop', 'use', 'image',
]);

export class CodeEditorPopup {
  /**
   * @param {object} opts
   * @param {string} opts.title
   * @param {string} opts.value
   * @param {'svg'|'xml'|'text'} [opts.mode]
   * @param {boolean} [opts.wrap]
   * @param {boolean} [opts.gutter]
   * @param {(value:string)=>void} [opts.onChange]
   * @param {(value:string)=>void} [opts.onApply]
   */
  constructor(opts = {}) {
    this.title = opts.title || 'Editor';
    this.mode = opts.mode || 'text';
    this.wrap = opts.wrap !== false;
    this.gutter = opts.gutter !== false;
    this._value = opts.value || '';
    this.onChange = opts.onChange || null;
    this.onApply = opts.onApply || null;
    this._modal = null;
    this._ace = null;
    this._ta = null;
    this._aceHost = null;
    this._errBar = null;
  }

  get value() {
    if (this._ace) {
      try {
        return this._ace.getValue();
      } catch (_) {}
    }
    if (this._ta) return this._ta.value;
    return this._value;
  }

  set value(v) {
    this._value = v || '';
    if (this._ace) {
      try {
        this._ace.setValue(this._value, -1);
      } catch (_) {}
    }
    if (this._ta) this._ta.value = this._value;
  }

  show() {
    const body = `
      <div class="cep-toolbar">
        <label class="cep-toggle"><input type="checkbox" id="cep-wrap" ${this.wrap ? 'checked' : ''}/> Wrap</label>
        <label class="cep-toggle"><input type="checkbox" id="cep-gutter" ${this.gutter ? 'checked' : ''}/> Gutter</label>
        <span class="cep-mode">${this.mode.toUpperCase()}${this._hasAce() ? ' · Ace' : ''}</span>
        <button type="button" class="cep-btn" id="cep-format">Format</button>
      </div>
      <div class="cep-err" id="cep-err" hidden></div>
      <div class="cep-shell" id="cep-shell">
        <div id="cep-ace" class="cep-ace"></div>
        <textarea class="cep-ta" id="cep-ta" spellcheck="false" hidden></textarea>
      </div>
    `;

    this._modal = new Modal(this.title, body, [
      { label: 'Cancel', onClick: () => this.hide() },
      {
        label: 'Apply',
        isPrimary: true,
        onClick: () => {
          const v = this.value;
          this._value = v;
          if (this.onApply) this.onApply(v);
          this.hide();
        },
      },
    ]);

    const box = this._modal.overlay.querySelector('.andro-modal-box');
    if (box) {
      box.style.width = 'min(96vw, 720px)';
      box.style.maxHeight = '92vh';
    }
    const mbody = this._modal.overlay.querySelector('.andro-modal-body');
    if (mbody) {
      mbody.style.padding = '8px 10px 12px';
      mbody.style.maxHeight = '78vh';
      mbody.style.height = 'min(78vh, 560px)';
      mbody.style.overflow = 'hidden';
      mbody.style.display = 'flex';
      mbody.style.flexDirection = 'column';
      mbody.style.minHeight = '360px';
    }

    this._injectStyles();
    this._modal.show();

    this._ta = this._modal.overlay.querySelector('#cep-ta');
    this._aceHost = this._modal.overlay.querySelector('#cep-ace');
    this._errBar = this._modal.overlay.querySelector('#cep-err');

    this._modal.overlay.querySelector('#cep-wrap').onchange = (e) => {
      this.wrap = e.target.checked;
      this._applyWrap();
    };
    this._modal.overlay.querySelector('#cep-gutter').onchange = (e) => {
      this.gutter = e.target.checked;
      this._applyGutter();
    };
    this._modal.overlay.querySelector('#cep-format').onclick = () => {
      try {
        const formatted = formatXmlLike(this.value);
        this.value = formatted;
        this._validate();
        if (this.onChange) this.onChange(formatted);
      } catch (err) {
        this._showErrors([{ line: 1, message: err.message || 'Format failed' }]);
      }
    };

    if (this._hasAce()) this._initAce();
    else this._initTextarea();

    this._validate();
    setTimeout(() => {
      try {
        if (this._ace) this._ace.focus();
        else if (this._ta) this._ta.focus();
      } catch (_) {}
    }, 60);
  }

  hide() {
    try {
      if (this._ace) {
        this._ace.destroy();
        this._ace = null;
      }
    } catch (_) {}
    if (this._modal) this._modal.hide();
    this._modal = null;
  }

  _hasAce() {
    return typeof window !== 'undefined' && window.ace && typeof window.ace.edit === 'function';
  }

  _initAce() {
    this._aceHost.hidden = false;
    this._ta.hidden = true;
    try {
      const ed = window.ace.edit(this._aceHost);
      try {
        ed.setTheme('ace/theme/tomorrow_night');
      } catch (_) {
        try {
          ed.setTheme('ace/theme/monokai');
        } catch (__) {}
      }
      const mode =
        this.mode === 'svg' || this.mode === 'xml'
          ? 'ace/mode/xml'
          : 'ace/mode/text';
      try {
        ed.session.setMode(mode);
      } catch (_) {}
      ed.setValue(this._value || '', -1);
      ed.setShowPrintMargin(false);
      ed.setFontSize(13);
      ed.renderer.setShowGutter(this.gutter);
      ed.session.setUseWrapMode(this.wrap);
      ed.setOptions({
        highlightActiveLine: true,
        tabSize: 2,
        useSoftTabs: true,
      });
      ed.on('change', () => {
        this._value = ed.getValue();
        this._validate();
        if (this.onChange) this.onChange(this._value);
      });
      this._ace = ed;
      this._aceHost.style.height = '100%';
      this._aceHost.style.width = '100%';
      setTimeout(() => {
        try {
          ed.resize();
        } catch (_) {}
      }, 40);
    } catch (e) {
      console.warn('Ace init failed, fallback textarea', e);
      this._initTextarea();
    }
  }

  _initTextarea() {
    if (this._aceHost) this._aceHost.hidden = true;
    this._ta.hidden = false;
    this._ta.value = this._value || '';
    this._ta.style.whiteSpace = this.wrap ? 'pre-wrap' : 'pre';
    this._ta.addEventListener('input', () => {
      this._value = this._ta.value;
      this._validate();
      if (this.onChange) this.onChange(this._value);
    });
  }

  _applyWrap() {
    if (this._ace) {
      try {
        this._ace.session.setUseWrapMode(this.wrap);
      } catch (_) {}
    }
    if (this._ta) this._ta.style.whiteSpace = this.wrap ? 'pre-wrap' : 'pre';
  }

  _applyGutter() {
    if (this._ace) {
      try {
        this._ace.renderer.setShowGutter(this.gutter);
      } catch (_) {}
    }
  }

  _validate() {
    const errors = validateXmlLike(this.value, this.mode === 'svg' || this.mode === 'xml');
    this._showErrors(errors);
  }

  _showErrors(errors) {
    if (!this._errBar) return;
    if (!errors || !errors.length) {
      this._errBar.hidden = true;
      this._errBar.innerHTML = '';
      return;
    }
    this._errBar.hidden = false;
    this._errBar.innerHTML = errors
      .slice(0, 6)
      .map((e) => `<div class="cep-err-item"><b>L${e.line}</b>${escapeHtml(e.message)}</div>`)
      .join('');
  }

  _injectStyles() {
    if (document.getElementById('cep-styles')) return;
    const s = document.createElement('style');
    s.id = 'cep-styles';
    s.textContent = `
.cep-toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:6px;font-size:0.78rem;flex:0 0 auto;}
.cep-toggle{display:flex;align-items:center;gap:4px;opacity:0.9;cursor:pointer;}
.cep-mode{margin-left:auto;font-family:monospace;opacity:0.55;font-size:0.7rem;}
.cep-btn{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:inherit;border-radius:2px;padding:3px 10px;cursor:pointer;font-size:0.75rem;}
.cep-btn:hover{background:rgba(255,255,255,0.14);}
.cep-err{background:rgba(244,67,54,0.12);border:1px solid rgba(244,67,54,0.35);border-radius:2px;padding:6px 8px;margin-bottom:6px;font-size:0.72rem;max-height:72px;overflow:auto;flex:0 0 auto;}
.cep-err-item{margin:2px 0;}
.cep-err-item b{color:#ef9a9a;margin-right:6px;}
.cep-shell{display:flex;flex:1 1 auto;min-height:300px;height:min(58vh,480px);max-height:min(68vh,600px);border:1px solid rgba(255,255,255,0.12);border-radius:2px;overflow:hidden;background:#1d1f25;position:relative;}
.cep-ace{position:absolute;inset:0;width:100%;height:100%;}
.cep-ta{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:10px 12px;box-sizing:border-box;
  font:13px/1.45 ui-monospace,Menlo,Consolas,monospace;tab-size:2;border:0;outline:none;resize:none;
  color:#e6edf3;background:#1d1f25;overflow:auto;}
`;
    document.head.appendChild(s);
  }
}

function validateXmlLike(text, isSvg) {
  const errors = [];
  if (!isSvg) return errors;
  let full = String(text || '');
  full = full.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  const stack = [];
  const tagRe = /<\/?([A-Za-z_][\w:.-]*)\b([^>]*?)(\/?)\>/g;
  let line = 1;
  for (let i = 0; i < full.length; i++) {
    if (full[i] === '\n') {
      line++;
      continue;
    }
    if (full[i] !== '<') continue;
    if (full[i + 1] === '?' || full[i + 1] === '!') {
      while (i < full.length && full[i] !== '>') i++;
      continue;
    }
    tagRe.lastIndex = i;
    const m = tagRe.exec(full);
    if (!m || m.index !== i) continue;
    const name = m[1];
    const selfClose = m[3] === '/' || /\/\s*$/.test(m[2]);
    const closing = m[0].startsWith('</');
    if (closing) {
      if (!stack.length) {
        errors.push({ line, message: `Unexpected closing </${name}>` });
      } else {
        const top = stack.pop();
        if (top.name !== name) {
          errors.push({ line, message: `Expected </${top.name}> but found </${name}>` });
        }
      }
    } else if (!selfClose) {
      const lower = name.toLowerCase();
      if (!(isSvg && SVG_VOIDISH.has(lower) && /\/\s*$/.test(m[0]))) {
        stack.push({ name, line });
      }
    }
    i = m.index + m[0].length - 1;
  }
  stack.forEach((t) => {
    errors.push({ line: t.line, message: `Unclosed <${t.name}>` });
  });
  if (isSvg && text.trim() && !/<svg[\s>]/i.test(text)) {
    errors.unshift({ line: 1, message: 'Root <svg> element not found' });
  }
  return errors;
}

function formatXmlLike(text) {
  const compact = String(text || '')
    .replace(/>\s+</g, '><')
    .replace(/^\s+|\s+$/g, '');
  let out = '';
  let indent = 0;
  const parts = compact.split(/(<[^>]+>)/g).filter(Boolean);
  for (const p of parts) {
    if (p.startsWith('</')) {
      indent = Math.max(0, indent - 1);
      out += '  '.repeat(indent) + p + '\n';
    } else if (p.startsWith('<') && p.endsWith('/>')) {
      out += '  '.repeat(indent) + p + '\n';
    } else if (p.startsWith('<?') || p.startsWith('<!')) {
      out += '  '.repeat(indent) + p + '\n';
    } else if (p.startsWith('<')) {
      out += '  '.repeat(indent) + p + '\n';
      if (!/\/>$/.test(p)) indent++;
    } else {
      const t = p.trim();
      if (t) out += '  '.repeat(indent) + t + '\n';
    }
  }
  return out.replace(/\n+$/, '\n');
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export { validateXmlLike, formatXmlLike };
