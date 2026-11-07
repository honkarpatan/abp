/**
 * XHLP ↔ Layout Preview Host protocol helpers (v1).
 * Spec: docs/PREVIEW_PROTOCOL.md
 */

export const PROTOCOL_VERSION = 1;
export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 38471;
export const WS_PATH = ''; // ws://host:port/

export const MsgType = {
  HELLO: 'HELLO',
  WELCOME: 'WELCOME',
  AUTH_FAIL: 'AUTH_FAIL',
  PING: 'PING',
  PONG: 'PONG',
  PUSH_RESOURCES: 'PUSH_RESOURCES',
  INFLATE: 'INFLATE',
  STATUS: 'STATUS',
  ERROR: 'ERROR',
  CLEAR: 'CLEAR',
  DISCONNECT: 'DISCONNECT',
};

let _seq = 0;
export function nextMsgId() {
  _seq += 1;
  return String(_seq);
}

/**
 * @param {string} type
 * @param {object} payload
 * @param {string} [id]
 */
export function makeMessage(type, payload = {}, id = nextMsgId()) {
  return {
    v: PROTOCOL_VERSION,
    type,
    id,
    ts: Date.now(),
    payload: payload || {},
  };
}

export function encodeText(msg) {
  return JSON.stringify(msg);
}

/**
 * @param {string} raw
 * @returns {object|null}
 */
export function parseText(raw) {
  try {
    const msg = JSON.parse(raw);
    if (!msg || typeof msg !== 'object' || !msg.type) return null;
    if (msg.v != null && Number(msg.v) !== PROTOCOL_VERSION) {
      // still return; caller may ERROR UNSUPPORTED
    }
    return msg;
  } catch {
    return null;
  }
}

export function wsUrl(host = DEFAULT_HOST, port = DEFAULT_PORT) {
  const h = host || DEFAULT_HOST;
  const p = Number(port) || DEFAULT_PORT;
  return `ws://${h}:${p}${WS_PATH}`;
}

/** SHA-256 hex of ArrayBuffer (Web Crypto). */
export async function sha256Hex(arrayBuffer) {
  if (!globalThis.crypto?.subtle) return null;
  const hash = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
