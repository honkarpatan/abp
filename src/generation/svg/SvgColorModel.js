/**
 * Parse SVG and build a color matrix:
 * columns = element instances (tag + index)
 * rows = fill | stroke | color | stop-color
 *
 * Cell kinds:
 *  - none: property not set (dotted empty bullet)
 *  - special: currentColor / inherit / none / url(...) (marked cell)
 *  - color: concrete color (#hex, rgb, named)
 */

const COLOR_PROPS = ['fill', 'stroke', 'color', 'stop-color'];

const SPECIAL_RE =
  /^(none|currentColor|inherit|transparent|url\(|context-fill|context-stroke)/i;
const HEX_RE = /^#([0-9a-f]{3,8})$/i;
const RGB_RE = /^rgba?\(/i;
const NAMED = new Set(
  'black white red green blue yellow orange gray grey purple pink brown cyan magenta lime navy teal silver'.split(
    ' '
  )
);

export function parseSvgColors(svgText) {
  const text = String(svgText || '');
  const elements = [];
  // Match start tags only
  const re = /<([A-Za-z_][\w:.-]*)\b([^>]*?)(\/?)\>/g;
  let m;
  const counts = Object.create(null);
  while ((m = re.exec(text))) {
    const rawName = m[1];
    const name = rawName.toLowerCase().replace(/^svg:/, '');
    if (name.startsWith('?') || name.startsWith('!')) continue;
    if (m[0].startsWith('</')) continue;
    counts[name] = (counts[name] || 0) + 1;
    const attrs = parseAttrs(m[2] || '');
    const styleMap = parseStyle(attrs.style || '');
    const props = {};
    for (const p of COLOR_PROPS) {
      const fromAttr = attrs[p];
      const fromStyle = styleMap[p];
      const raw = fromStyle != null && fromStyle !== '' ? fromStyle : fromAttr;
      props[p] = classifyColor(raw);
      props[p].source = fromStyle != null && fromStyle !== '' ? 'style' : fromAttr != null ? 'attr' : null;
    }
    elements.push({
      tag: name,
      index: counts[name],
      label: counts[name] > 1 ? `${name}#${counts[name]}` : name,
      start: m.index,
      end: m.index + m[0].length,
      rawTag: m[0],
      attrs,
      styleMap,
      props,
      selfClosing: m[3] === '/' || /\/\s*$/.test(m[2] || ''),
    });
  }
  return { elements, props: COLOR_PROPS, text };
}

export function classifyColor(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { kind: 'none', value: null, display: null };
  }
  const v = String(raw).trim();
  if (SPECIAL_RE.test(v) || v.toLowerCase() === 'none') {
    return { kind: 'special', value: v, display: v };
  }
  if (HEX_RE.test(v) || RGB_RE.test(v) || NAMED.has(v.toLowerCase())) {
    return { kind: 'color', value: v, display: normalizeHex(v) || v };
  }
  // unknown token — treat as special so user can edit
  return { kind: 'special', value: v, display: v };
}

function normalizeHex(v) {
  if (!HEX_RE.test(v)) return null;
  let h = v.slice(1);
  if (h.length === 3 || h.length === 4) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return '#' + h.toLowerCase();
}

function parseAttrs(s) {
  const out = Object.create(null);
  const re = /([:@A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let m;
  while ((m = re.exec(s))) {
    out[m[1]] = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4];
  }
  return out;
}

function parseStyle(style) {
  const out = Object.create(null);
  if (!style) return out;
  String(style)
    .split(';')
    .forEach((part) => {
      const i = part.indexOf(':');
      if (i < 0) return;
      const k = part.slice(0, i).trim().toLowerCase();
      const v = part.slice(i + 1).trim();
      if (k) out[k] = v;
    });
  return out;
}

/**
 * Apply a color change onto SVG source for element at index.
 * prop: fill|stroke|color|stop-color
 * value: null → remove; string → set attr (clears same key from style)
 */
export function applySvgColor(svgText, elementIndex, prop, value) {
  const model = parseSvgColors(svgText);
  const el = model.elements[elementIndex];
  if (!el) return svgText;

  let tag = el.rawTag;
  // Remove prop from style=
  if (el.attrs.style != null) {
    const style = rewriteStyle(el.attrs.style, prop, null);
    tag = setOrRemoveAttr(tag, 'style', style === '' ? null : style);
  }
  // Set/remove attribute
  if (value == null || value === '') {
    tag = setOrRemoveAttr(tag, prop, null);
  } else {
    tag = setOrRemoveAttr(tag, prop, value);
  }

  return (
    svgText.slice(0, el.start) + tag + svgText.slice(el.end)
  );
}

function rewriteStyle(style, prop, value) {
  const map = parseStyle(style);
  if (value == null || value === '') delete map[prop];
  else map[prop] = value;
  return Object.keys(map)
    .map((k) => `${k}:${map[k]}`)
    .join(';');
}

function setOrRemoveAttr(tagSrc, name, value) {
  // tagSrc like <path d="..." stroke="#000"/>
  const re = new RegExp(
    `(\\s)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s"'=<>\`]+)`,
    'i'
  );
  if (value == null || value === '') {
    return tagSrc.replace(re, '');
  }
  const quoted = `"${String(value).replace(/"/g, '&quot;')}"`;
  if (re.test(tagSrc)) {
    return tagSrc.replace(re, `$1${name}=${quoted}`);
  }
  // insert before /> or >
  if (/\/>$/.test(tagSrc)) {
    return tagSrc.replace(/\s*\/>$/, ` ${name}=${quoted}/>`);
  }
  return tagSrc.replace(/\s*>$/, ` ${name}=${quoted}>`);
}

/**
 * Collect unique concrete colors for palette strip.
 */
export function collectPalette(model) {
  const seen = new Set();
  const list = [];
  (model.elements || []).forEach((el) => {
    COLOR_PROPS.forEach((p) => {
      const c = el.props[p];
      if (c && c.kind === 'color' && c.value) {
        const key = (c.display || c.value).toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          list.push(c.display || c.value);
        }
      }
    });
  });
  return list;
}
