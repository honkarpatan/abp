/**
 * Theme-aware custom select (no native <select>).
 * Styles come from styles/customSelectStyles.js via EditorFile stylesheets
 * (Shadow DOM — do not inject into document.head).
 */

export class CustomSelect {
  /**
   * @param {object} opts
   * @param {{ value: string, label: string, disabled?: boolean }[]} opts.options
   * @param {string} [opts.value]
   * @param {string} [opts.placeholder]
   * @param {(value: string, option: object|null) => void} [opts.onChange]
   * @param {string} [opts.className]
   * @param {boolean} [opts.disabled]
   */
  constructor(opts = {}) {
    this.options = Array.isArray(opts.options) ? opts.options.slice() : [];
    this.value = opts.value != null ? String(opts.value) : '';
    this.placeholder = opts.placeholder != null ? opts.placeholder : '—';
    this.onChange = opts.onChange || null;
    this.disabled = !!opts.disabled;
    this._open = false;
    this._onDoc = null;

    this.el = document.createElement('div');
    this.el.className = 'xcs' + (opts.className ? ' ' + opts.className : '');
    this.el.setAttribute('role', 'combobox');
    this.el.setAttribute('aria-expanded', 'false');
    this.el.innerHTML = `
      <button type="button" class="xcs-trigger" aria-haspopup="listbox">
        <span class="xcs-label"></span>
        <span class="xcs-caret" aria-hidden="true">▾</span>
      </button>
      <div class="xcs-menu" role="listbox" hidden></div>
    `;
    this._trigger = this.el.querySelector('.xcs-trigger');
    this._label = this.el.querySelector('.xcs-label');
    this._menu = this.el.querySelector('.xcs-menu');

    this._trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.disabled) return;
      this._open ? this.close() : this.open();
    });
    this._menu.addEventListener('click', (e) => {
      const item = e.target.closest('.xcs-item');
      if (!item || item.classList.contains('is-disabled')) return;
      const v = item.getAttribute('data-value');
      this.setValue(v, true);
      this.close();
    });

    this._renderLabel();
    this._renderMenu();
    this._syncDisabled();
  }

  open() {
    if (this.disabled) return;
    this._open = true;
    this.el.classList.add('is-open');
    this.el.setAttribute('aria-expanded', 'true');
    this._menu.hidden = false;
    this._onDoc = (e) => {
      if (!this.el.contains(e.target)) this.close();
    };
    setTimeout(() => document.addEventListener('click', this._onDoc, true), 0);
  }

  close() {
    this._open = false;
    this.el.classList.remove('is-open');
    this.el.setAttribute('aria-expanded', 'false');
    this._menu.hidden = true;
    if (this._onDoc) {
      document.removeEventListener('click', this._onDoc, true);
      this._onDoc = null;
    }
  }

  setOptions(options) {
    this.options = Array.isArray(options) ? options.slice() : [];
    this._renderMenu();
    this._renderLabel();
  }

  setValue(value, fire) {
    this.value = value != null ? String(value) : '';
    this._renderLabel();
    this._renderMenu();
    if (fire && this.onChange) {
      const opt = this.options.find((o) => String(o.value) === this.value) || null;
      this.onChange(this.value, opt);
    }
  }

  getValue() {
    return this.value;
  }

  setDisabled(disabled) {
    this.disabled = !!disabled;
    this._syncDisabled();
    if (this.disabled) this.close();
  }

  destroy() {
    this.close();
    this.el.remove();
  }

  _syncDisabled() {
    this.el.classList.toggle('is-disabled', this.disabled);
    this._trigger.disabled = this.disabled;
  }

  _renderLabel() {
    const opt = this.options.find((o) => String(o.value) === this.value);
    if (opt) {
      this._label.textContent = opt.label != null ? opt.label : opt.value;
      this._label.classList.remove('is-placeholder');
    } else if (this.value) {
      this._label.textContent = this.value;
      this._label.classList.remove('is-placeholder');
    } else {
      this._label.textContent = this.placeholder;
      this._label.classList.add('is-placeholder');
    }
  }

  _renderMenu() {
    this._menu.innerHTML = this.options
      .map((o) => {
        const v = String(o.value);
        const active = v === this.value ? ' is-active' : '';
        const dis = o.disabled ? ' is-disabled' : '';
        const label = o.label != null ? o.label : v;
        return `<button type="button" class="xcs-item${active}${dis}" role="option" data-value="${escapeAttr(v)}" ${v === this.value ? 'aria-selected="true"' : ''}>${escapeHtml(label === '' ? '—' : label)}</button>`;
      })
      .join('');
  }
}

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default CustomSelect;
