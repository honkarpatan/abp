/**
 * SVG → Android VectorDrawable XML (beta).
 * Supports: svg viewport, path, group, rect, circle, ellipse, line,
 * polyline, polygon, basic fill/stroke, fill-rule, stroke-width/linecap/linejoin,
 * opacity, simple translate/scale/rotate on group.
 */

const ANDROID_NS = 'xmlns:android="http://schemas.android.com/apk/res/android"';

export function svgToVectorDrawable(svgText, options = {}) {
  const warnings = [];
  const text = String(svgText || '').trim();
  if (!text) {
    return { xml: '', warnings: ['Empty SVG'] };
  }

  const svgOpen = text.match(/<svg\b([^>]*)>/i);
  if (!svgOpen) {
    return { xml: '', warnings: ['No <svg> root'] };
  }

  const rootAttrs = parseAttrs(svgOpen[1]);
  let vw = parseFloat(rootAttrs.viewBox?.split(/[\s,]+/)[2]);
  let vh = parseFloat(rootAttrs.viewBox?.split(/[\s,]+/)[3]);
  if (!vw || !vh) {
    vw = parseLength(rootAttrs.width) || 24;
    vh = parseLength(rootAttrs.height) || 24;
    warnings.push('viewBox missing — used width/height');
  }

  const widthDp = options.widthDp || 24;
  const heightDp = options.heightDp || 24;

  const body = extractInner(text);
  const nodes = parseNodes(body, warnings);
  const pathsXml = nodes.map((n) => nodeToXml(n, warnings)).join('\n');

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<vector ${ANDROID_NS}
    android:width="${widthDp}dp"
    android:height="${heightDp}dp"
    android:viewportWidth="${trimNum(vw)}"
    android:viewportHeight="${trimNum(vh)}">
${pathsXml}
</vector>
`;

  return { xml: xml.replace(/\n{3,}/g, '\n\n'), warnings };
}

function extractInner(text) {
  const start = text.search(/<svg\b[^>]*>/i);
  if (start < 0) return text;
  const after = text.indexOf('>', start) + 1;
  const end = text.toLowerCase().lastIndexOf('</svg>');
  if (end < 0) return text.slice(after);
  return text.slice(after, end);
}

function parseNodes(body, warnings) {
  const nodes = [];
  const re = /<([A-Za-z_][\w:.-]*)\b([^>]*?)(\/?)\s*>/g;
  let m;
  const stack = [{ tag: 'root', children: nodes, attrs: {} }];

  // Also capture text between tags is ignored
  const tokens = [];
  let last = 0;
  while ((m = re.exec(body))) {
    tokens.push({ type: 'tag', ...m, index: m.index });
    last = m.index + m[0].length;
  }

  // Simple stack parse
  const tagRe = /<\/?([A-Za-z_][\w:.-]*)\b([^>]*?)(\/?)\s*>/g;
  let t;
  while ((t = tagRe.exec(body))) {
    const raw = t[1];
    const name = raw.toLowerCase().replace(/^svg:/, '');
    const closing = t[0].startsWith('</');
    const self = t[3] === '/' || /\/\s*$/.test(t[2] || '');
    if (closing) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const attrs = parseAttrs(t[2] || '');
    const node = { tag: name, attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!self && !isVoid(name)) {
      stack.push(node);
    }
  }
  return nodes;
}

function isVoid(name) {
  return [
    'path',
    'circle',
    'ellipse',
    'rect',
    'line',
    'polyline',
    'polygon',
    'stop',
  ].includes(name);
}

function nodeToXml(node, warnings, depth = 1) {
  const pad = '    '.repeat(depth);
  const a = node.attrs || {};
  const style = parseStyle(a.style || '');
  const get = (k) => (style[k] != null ? style[k] : a[k]);

  switch (node.tag) {
    case 'g':
    case 'group': {
      const tf = parseTransform(get('transform'));
      const lines = [];
      lines.push(`${pad}<group${groupAttrs(tf)}>`);
      (node.children || []).forEach((ch) => {
        lines.push(nodeToXml(ch, warnings, depth + 1));
      });
      lines.push(`${pad}</group>`);
      return lines.join('\n');
    }
    case 'path': {
      const d = get('d');
      if (!d) {
        warnings.push('path without d skipped');
        return '';
      }
      return `${pad}<path${pathAttrs(get, d)}/>`;
    }
    case 'rect': {
      const x = num(get('x'), 0);
      const y = num(get('y'), 0);
      const w = num(get('width'), 0);
      const h = num(get('height'), 0);
      const rx = num(get('rx'), 0);
      const ry = num(get('ry'), rx);
      const d = rectToPath(x, y, w, h, rx, ry);
      return `${pad}<path${pathAttrs(get, d)}/>`;
    }
    case 'circle': {
      const cx = num(get('cx'), 0);
      const cy = num(get('cy'), 0);
      const r = num(get('r'), 0);
      const d = circleToPath(cx, cy, r);
      return `${pad}<path${pathAttrs(get, d)}/>`;
    }
    case 'ellipse': {
      const cx = num(get('cx'), 0);
      const cy = num(get('cy'), 0);
      const rx = num(get('rx'), 0);
      const ry = num(get('ry'), 0);
      const d = ellipseToPath(cx, cy, rx, ry);
      return `${pad}<path${pathAttrs(get, d)}/>`;
    }
    case 'line': {
      const x1 = num(get('x1'), 0);
      const y1 = num(get('y1'), 0);
      const x2 = num(get('x2'), 0);
      const y2 = num(get('y2'), 0);
      const d = `M${x1},${y1}L${x2},${y2}`;
      // force stroke if only stroke intended
      const get2 = (k) => {
        if (k === 'fill' && get('fill') == null) return 'none';
        return get(k);
      };
      return `${pad}<path${pathAttrs(get2, d)}/>`;
    }
    case 'polyline':
    case 'polygon': {
      const pts = parsePoints(get('points'));
      if (pts.length < 2) {
        warnings.push(`${node.tag} without points skipped`);
        return '';
      }
      let d = 'M' + pts.map((p) => p.join(',')).join('L');
      if (node.tag === 'polygon') d += 'Z';
      return `${pad}<path${pathAttrs(get, d)}/>`;
    }
    default:
      if (node.children && node.children.length) {
        return (node.children || [])
          .map((ch) => nodeToXml(ch, warnings, depth))
          .join('\n');
      }
      if (!['defs', 'title', 'desc', 'metadata', 'clippath', 'mask', 'lineargradient', 'radialgradient', 'style', 'script'].includes(node.tag)) {
        warnings.push(`unsupported <${node.tag}> skipped`);
      }
      return '';
  }
}

function pathAttrs(get, d) {
  let s = ` android:pathData="${esc(d)}"`;
  const fill = mapColor(get('fill'));
  const stroke = mapColor(get('stroke'));
  const fillOpacity = get('fill-opacity') || get('opacity');
  const strokeOpacity = get('stroke-opacity');
  const sw = get('stroke-width');
  const lc = get('stroke-linecap');
  const lj = get('stroke-linejoin');
  const fr = get('fill-rule');

  if (fill && fill !== 'none') {
    s += ` android:fillColor="${esc(fill)}"`;
  } else if (fill === 'none' || get('fill') === 'none') {
    s += ` android:fillColor="#00000000"`;
  } else if (!stroke) {
    s += ` android:fillColor="#FF000000"`;
  }

  if (fillOpacity != null && fillOpacity !== '' && fillOpacity !== '1') {
    s += ` android:fillAlpha="${num(fillOpacity, 1)}"`;
  }
  if (stroke && stroke !== 'none') {
    s += ` android:strokeColor="${esc(stroke)}"`;
    if (sw != null) s += ` android:strokeWidth="${num(sw, 1)}"`;
    else s += ` android:strokeWidth="1"`;
  }
  if (strokeOpacity != null && strokeOpacity !== '' && strokeOpacity !== '1') {
    s += ` android:strokeAlpha="${num(strokeOpacity, 1)}"`;
  }
  if (lc) {
    const m = { butt: 'butt', round: 'round', square: 'square' };
    if (m[lc]) s += ` android:strokeLineCap="${m[lc]}"`;
  }
  if (lj) {
    const m = { miter: 'miter', round: 'round', bevel: 'bevel' };
    if (m[lj]) s += ` android:strokeLineJoin="${m[lj]}"`;
  }
  if (fr === 'evenodd') s += ` android:fillType="evenOdd"`;
  return s;
}

function groupAttrs(tf) {
  if (!tf) return '';
  let s = '';
  if (tf.translateX) s += ` android:translateX="${tf.translateX}"`;
  if (tf.translateY) s += ` android:translateY="${tf.translateY}"`;
  if (tf.scaleX != null) s += ` android:scaleX="${tf.scaleX}"`;
  if (tf.scaleY != null) s += ` android:scaleY="${tf.scaleY}"`;
  if (tf.rotation) s += ` android:rotation="${tf.rotation}"`;
  if (tf.pivotX != null) s += ` android:pivotX="${tf.pivotX}"`;
  if (tf.pivotY != null) s += ` android:pivotY="${tf.pivotY}"`;
  return s;
}

function mapColor(c) {
  if (c == null || c === '') return null;
  const v = String(c).trim();
  if (/^none$/i.test(v)) return 'none';
  if (/^currentColor$/i.test(v)) return '#FF000000';
  if (/^url\(/i.test(v)) return null; // gradients not supported in path fill
  if (/^#([0-9a-f]{3,8})$/i.test(v)) return hexToAndroid(v);
  if (/^rgb/i.test(v)) return rgbToAndroid(v);
  const named = {
    black: '#FF000000',
    white: '#FFFFFFFF',
    red: '#FFFF0000',
    green: '#FF00FF00',
    blue: '#FF0000FF',
    gray: '#FF888888',
    grey: '#FF888888',
    transparent: '#00000000',
  };
  if (named[v.toLowerCase()]) return named[v.toLowerCase()];
  return null;
}

function hexToAndroid(hex) {
  let h = hex.slice(1);
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length === 4) {
    // #RGBA
    const r = h[0] + h[0],
      g = h[1] + h[1],
      b = h[2] + h[2],
      a = h[3] + h[3];
    return ('#' + a + r + g + b).toUpperCase();
  }
  if (h.length === 6) return ('#FF' + h).toUpperCase();
  if (h.length === 8) {
    // #RRGGBBAA → AARRGGBB
    return ('#' + h.slice(6, 8) + h.slice(0, 6)).toUpperCase();
  }
  return ('#FF' + h).toUpperCase();
}

function rgbToAndroid(v) {
  const m = v.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (!m) return null;
  const r = clamp255(+m[1]);
  const g = clamp255(+m[2]);
  const b = clamp255(+m[3]);
  const a = m[4] != null ? Math.round(parseFloat(m[4]) * 255) : 255;
  return (
    '#' +
    [a, r, g, b]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function clamp255(n) {
  if (n <= 1 && String(n).includes('.')) n = n * 255;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseTransform(tr) {
  if (!tr) return null;
  const out = {};
  const re = /(translate|scale|rotate)\s*\(([^)]*)\)/gi;
  let m;
  while ((m = re.exec(tr))) {
    const kind = m[1].toLowerCase();
    const parts = m[2].split(/[\s,]+/).map(parseFloat);
    if (kind === 'translate') {
      out.translateX = parts[0] || 0;
      out.translateY = parts[1] || 0;
    } else if (kind === 'scale') {
      out.scaleX = parts[0];
      out.scaleY = parts[1] != null ? parts[1] : parts[0];
    } else if (kind === 'rotate') {
      out.rotation = parts[0] || 0;
      if (parts.length >= 3) {
        out.pivotX = parts[1];
        out.pivotY = parts[2];
      }
    }
  }
  return Object.keys(out).length ? out : null;
}

function parsePoints(pts) {
  if (!pts) return [];
  const nums = String(pts)
    .trim()
    .split(/[\s,]+/)
    .map(parseFloat)
    .filter((n) => !isNaN(n));
  const out = [];
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
  return out;
}

function rectToPath(x, y, w, h, rx, ry) {
  rx = Math.min(rx, w / 2);
  ry = Math.min(ry, h / 2);
  if (rx <= 0 && ry <= 0) {
    return `M${x},${y}h${w}v${h}h${-w}z`;
  }
  return `M${x + rx},${y}h${w - 2 * rx}a${rx},${ry} 0 0 1 ${rx},${ry}v${h - 2 * ry}a${rx},${ry} 0 0 1 ${-rx},${ry}h${-(w - 2 * rx)}a${rx},${ry} 0 0 1 ${-rx},${-ry}v${-(h - 2 * ry)}a${rx},${ry} 0 0 1 ${rx},${-ry}z`;
}

function circleToPath(cx, cy, r) {
  return `M${cx - r},${cy}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0`;
}

function ellipseToPath(cx, cy, rx, ry) {
  return `M${cx - rx},${cy}a${rx},${ry} 0 1,0 ${rx * 2},0a${rx},${ry} 0 1,0 ${-rx * 2},0`;
}

function parseAttrs(s) {
  const out = Object.create(null);
  const re = /([:@A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let m;
  while ((m = re.exec(s || ''))) {
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
      out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
    });
  return out;
}

function parseLength(v) {
  if (v == null) return null;
  const m = String(v).match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
}

function num(v, d) {
  const n = parseFloat(v);
  return isNaN(n) ? d : n;
}

function trimNum(n) {
  return String(Math.round(n * 1000) / 1000);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}
