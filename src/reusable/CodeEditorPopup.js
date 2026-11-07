/**
 * Reusable popup code editor for plugins.
 * Features: line gutter, wrap toggle, basic syntax color, error markers (SVG/XML).
 * Does not depend on Ace/Monaco — works inside Acode WebView.
 */

import { Modal } from './Modal.js';

const SVG_VOIDISH = new Set([
  'path',
  'circle',
  'ellipse',
  'rect',
  'line',
  'polyline',
  'polygon',
  'stop',
  'use',
  'image',
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
    this._errors = [];
    this._modal = null;
    this._ta = null;
    this._gutterEl = null;
    this._hl = null;
    this._errBar = null;
  }

  get value() {
    return this._ta ? this._ta.value : this._value;
  }

  set value(v) {
    this._value = v == null ? '' : String(v);
    if (this._ta) {
      this._ta.value = this._value;
      this._syncChrome();
    }
  }

  show() {
    const body = `
      <div class="cep-toolbar">
        <label class="cep-toggle"><input type="checkbox" id="cep-wrap" ${this.wrap ? 'checked' : ''}/> Wrap</label>
        <label class="cep-toggle"><input type="checkbox" id="cep-gutter" ${this.gutter ? 'checked' : ''}/> Gutter</label>
        <span class="cep-mode">${this.mode.toUpperCase()}</span>
        <button type="button" class="cep-btn" id="cep-format">Format</button>
      </div>
      <div class="cep-err" id="cep-err" hidden></div>
      <div class="cep-shell" id="cep-shell">
        <div class="cep-gutter" id="cep-gutter" aria-hidden="true"></div>
        <div class="cep-code-wrap">
          <pre class="cep-hl" id="cep-hl" aria-hidden="true"></pre>
          <textarea class="cep-ta" id="cep-ta" spellcheck="false"></textarea>
        </div>
      </div>
    `;

    this._modal = new Modal(this.title, body, [
      {
        label: 'Cancel',
        onClick: () => this.hide(),
      },
      {
        label: 'Apply',
        isPrimary: true,
        onClick: () => {
          const v = this.value;
          if (this.onApply) this.onApply(v);
          this.hide();
        },
      },
    ]);

    // enlarge modal for editor
    const box = this._modal.overlay.querySelector('.andro-modal-box');
    if (box) {
      box.style.width = 'min(96vw, 720px)';
      box.style.maxHeight = '90vh';
    }
    const mbody = this._modal.overlay.querySelector('.andro-modal-body');
    if (mbody) {
      mbody.style.padding = '8px 10px 12px';
      mbody.style.maxHeight = '70vh';
      mbody.style.overflow = 'hidden';
      mbody.style.display = 'flex';
      mbody.style.flexDirection = 'column';
    }

    this._injectStyles();
    this._modal.show();

    this._ta = this._modal.overlay.querySelector('#cep-ta');
    this._gutterEl = this._modal.overlay.querySelector('#cep-gutter');
    this._hl = this._modal.overlay.querySelector('#cep-hl');
    this._errBar = this._modal.overlay.querySelector('#cep-err');
    this._shell = this._modal.overlay.querySelector('#cep-shell');

    this._ta.value = this._value;
    this._ta.style.whiteSpace = this.wrap ? 'pre-wrap' : 'pre';
    this._ta.style.overflowX = this.wrap ? 'hidden' : 'auto';
    this._gutterEl.style.display = this.gutter ? 'block' : 'none';

    this._modal.overlay.querySelector('#cep-wrap').onchange = (e) => {
      this.wrap = e.target.checked;
      this._ta.style.whiteSpace = this.wrap ? 'pre-wrap' : 'pre';
      this._ta.style.overflowX = this.wrap ? 'hidden' : 'auto';
      this._hl.style.whiteSpace = this._ta.style.whiteSpace;
    };
    this._modal.overlay.querySelector('#cep-gutter').onchange = (e) => {
      this.gutter = e.target.checked;
      this._gutterEl.style.display = this.gutter ? 'block' : 'none';
    };
    this._modal.overlay.querySelector('#cep-format').onclick = () => {
      try {
        this._ta.value = formatXmlLike(this._ta.value);
        this._syncChrome();
        if (this.onChange) this.onChange(this._ta.value);
      } catch (err) {
        this._showErrors([{ line: 1, message: err.message || 'Format failed' }]);
      }
    };

    this._ta.addEventListener('input', () => {
      this._value = this._ta.value;
      this._syncChrome();
      if (this.onChange) this.onChange(this._value);
    });
    this._ta.addEventListener('scroll', () => {
      this._gutterEl.scrollTop = this._ta.scrollTop;
      this._hl.scrollTop = this._ta.scrollTop;
      this._hl.scrollLeft = this._ta.scrollLeft;
    });

    this._syncChrome();
    setTimeout(() => this._ta.focus(), 50);
  }

  hide() {
    if (this._modal) this._modal.hide();
    this._modal = null;
  }

  _syncChrome() {
    if (!this._ta) return;
    const text = this._ta.value;
    const lines = text.split('\n');
    this._gutterEl.innerHTML = lines
      .map((_, i) => `<span class="cep-ln">${i + 1}</span>`)
      .join('');
    this._hl.innerHTML = highlight(text, this.mode) + '\n';
    this._hl.style.whiteSpace = this._ta.style.whiteSpace || 'pre-wrap';

    if (this.mode === 'svg' || this.mode === 'xml') {
      this._errors = validateXmlLike(text, this.mode === 'svg');
      this._showErrors(this._errors);
    } else {
      this._showErrors([]);
    }
  }

  _showErrors(errors) {
    this._errors = errors || [];
    if (!this._errBar) return;
    if (!this._errors.length) {
      this._errBar.hidden = true;
      this._errBar.innerHTML = '';
      return;
    }
    this._errBar.hidden = false;
    this._errBar.innerHTML = this._errors
      .slice(0, 6)
      .map(
        (e) =>
          `<div class="cep-err-item"><b>L${e.line}</b> ${escapeHtml(e.message)}</div>`
      )
      .join('');
  }

  _injectStyles() {
    if (document.getElementById('cep-styles')) return;
    const s = document.createElement('style');
    s.id = 'cep-styles';
    s.textContent = `
.cep-toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:6px;font-size:0.78rem;}
.cep-toggle{display:flex;align-items:center;gap:4px;opacity:0.9;cursor:pointer;}
.cep-mode{margin-left:auto;font-family:monospace;opacity:0.55;font-size:0.7rem;}
.cep-btn{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:inherit;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:0.75rem;}
.cep-btn:hover{background:rgba(255,255,255,0.14);}
.cep-err{background:rgba(244,67,54,0.12);border:1px solid rgba(244,67,54,0.35);border-radius:8px;padding:6px 8px;margin-bottom:6px;font-size:0.72rem;max-height:72px;overflow:auto;}
.cep-err-item{margin:2px 0;}
.cep-err-item b{color:#ef9a9a;margin-right:6px;}
.cep-shell{display:flex;flex:1;min-height:280px;max-height:55vh;border:1px solid rgba(255,255,255,0.12);border-radius:10px;overflow:hidden;background:#0d1117;}
.cep-gutter{flex:0 0 42px;background:#010409;color:#6e7681;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;text-align:right;padding:10px 6px;overflow:hidden;user-select:none;border-right:1px solid rgba(255,255,255,0.06);}
.cep-ln{display:block;min-height:1.45em;}
.cep-code-wrap{position:relative;flex:1;overflow:hidden;}
.cep-hl,.cep-ta{margin:0;padding:10px 12px;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;tab-size:2;box-sizing:border-box;width:100%;height:100%;}
.cep-hl{position:absolute;inset:0;overflow:hidden;pointer-events:none;color:transparent;white-space:pre-wrap;word-wrap:break-word;}
.cep-ta{position:relative;background:transparent;color:#e6edf3;caret-color:#e6edf3;border:0;outline:none;resize:none;white-space:pre-wrap;word-wrap:break-word;z-index:1;}
.cep-tok-tag{color:#7ee787;}
.cep-tok-attr{color:#79c0ff;}
.cep-tok-str{color:#a5d6ff;}
.cep-tok-comment{color:#8b949e;font-style:italic;}
.cep-tok-punct{color:#c9d1d9;}
.cep-tok-err{background:rgba(248,81,73,0.25);border-radius:2px;}
`;
    document.head.appendChild(s);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlight(text, mode) {
  if (mode !== 'svg' && mode !== 'xml') {
    return escapeHtml(text);
  }
  // crude tokenizer: comments, tags, attrs, strings
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4);
      const j = end < 0 ? n : end + 3;
      out += `<span class="cep-tok-comment">${escapeHtml(text.slice(i, j))}</span>`;
      i = j;
      continue;
    }
    if (text[i] === '<') {
      const end = text.indexOf('>', i + 1);
      const j = end < 0 ? n : end + 1;
      const chunk = text.slice(i, j);
      out += colorTag(chunk);
      i = j;
      continue;
    }
    // text node
    let j = text.indexOf('<', i);
    if (j < 0) j = n;
    out += escapeHtml(text.slice(i, j));
    i = j;
  }
  return out;
}

function colorTag(chunk) {
  // <tag attr="v" />
  return escapeHtml(chunk)
    .replace(
      /^(&lt;\/?)([\w:.-]+)/,
      '<span class="cep-tok-punct">$1</span><span class="cep-tok-tag">$2</span>'
    )
    .replace(
      /\s([\w:.-]+)(=)(&quot;[^&]*&quot;|'[^']*'|"[^"]*")/g,
      ' <span class="cep-tok-attr">$1</span><span class="cep-tok-punct">$2</span><span class="cep-tok-str">$3</span>'
    )
    .replace(/(\/?&gt;)$/, '<span class="cep-tok-punct">$1</span>');
}

function validateXmlLike(text, isSvg) {
  const errors = [];
  const lines = text.split('\n');
  const stack = [];
  const tagRe = /<\/?([A-Za-z_][\w:.-]*)\b([^>]*?)(\/?)\>/g;
  let full = text;
  // strip comments for structure check
  full = full.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));

  let line = 1;
  let col = 0;
  for (let i = 0; i < full.length; i++) {
    if (full[i] === '\n') {
      line++;
      col = 0;
      continue;
    }
    col++;
    if (full[i] !== '<') continue;
    tagRe.lastIndex = i;
    const m = tagRe.exec(full);
    if (!m || m.index !== i) {
      errors.push({ line, message: 'Malformed tag' });
      continue;
    }
    const name = m[1];
    const selfClose = m[3] === '/' || /\/\s*$/.test(m[2]);
    const closing = m[0].startsWith('</');
    if (closing) {
      if (!stack.length) {
        errors.push({ line, message: `Unexpected closing </${name}>` });
      } else {
        const top = stack.pop();
        if (top.name !== name) {
          errors.push({
            line,
            message: `Expected </${top.name}> but found </${name}>`,
          });
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
  const compact = text
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

export { validateXmlLike, formatXmlLike, highlight };
