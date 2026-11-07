/**
 * Persistent WebSocket client for Layout Preview Host.
 * Spec: docs/PREVIEW_PROTOCOL.md
 *
 * Usage:
 *   const client = getPreviewHostClient();
 *   await client.ensureConnected();
 *   await client.pushResources({ bytes, packageName, projectId });
 *   await client.inflate({ layout: 'activity_main', config });
 */
import { getSettings } from '../../services/settings.js';
import {
  DEFAULT_HOST,
  DEFAULT_PORT,
  MsgType,
  makeMessage,
  encodeText,
  parseText,
  wsUrl,
  sha256Hex,
  nextMsgId,
} from './protocol.js';

const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000, 15000];
const PING_INTERVAL_MS = 30000;
const HANDSHAKE_TIMEOUT_MS = 8000;
const OP_TIMEOUT_MS = 20000;

class PreviewHostClient {
  constructor() {
    this._ws = null;
    this._state = 'idle'; // idle | connecting | open | closing
    this._welcome = null;
    this._pending = new Map(); // id → { resolve, reject, timer }
    this._pendingTransfer = null; // { transferId, byteLength }
    this._pingTimer = null;
    this._reconnectAttempt = 0;
    this._reconnectTimer = null;
    this._intentionalClose = false;
    this._listeners = new Set();
  }

  get state() {
    return this._state;
  }

  get isConnected() {
    return this._state === 'open' && this._ws?.readyState === WebSocket.OPEN;
  }

  get lastWelcome() {
    return this._welcome;
  }

  onEvent(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit(event, data) {
    for (const fn of this._listeners) {
      try {
        fn(event, data);
      } catch (_) {}
    }
  }

  _connConfig() {
    const s = getSettings();
    return {
      host: s.externalPreviewHost || DEFAULT_HOST,
      port: Number(s.externalPreviewPort) || DEFAULT_PORT,
      token: s.externalPreviewToken || '',
    };
  }

  /**
   * Connect if needed; waits for WELCOME.
   * @returns {Promise<object>} WELCOME payload
   */
  ensureConnected() {
    if (this.isConnected && this._welcome) {
      return Promise.resolve(this._welcome);
    }
    return this.connect();
  }

  connect() {
    this._intentionalClose = false;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    const { host, port, token } = this._connConfig();
    const url = wsUrl(host, port);

    if (this._ws) {
      try {
        this._ws.onclose = null;
        this._ws.close();
      } catch (_) {}
      this._ws = null;
    }

    this._state = 'connecting';
    this._welcome = null;
    this._emit('connecting', { url });

    return new Promise((resolve, reject) => {
      let settled = false;
      let handshakeTimer;

      const fail = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(handshakeTimer);
        this._state = 'idle';
        reject(err instanceof Error ? err : new Error(String(err)));
        this._scheduleReconnect();
      };

      const ok = (welcomePayload) => {
        if (settled) return;
        settled = true;
        clearTimeout(handshakeTimer);
        this._reconnectAttempt = 0;
        this._state = 'open';
        this._welcome = welcomePayload;
        this._startPing();
        this._emit('connected', welcomePayload);
        resolve(welcomePayload);
      };

      let ws;
      try {
        ws = new WebSocket(url);
      } catch (e) {
        fail(e);
        return;
      }
      this._ws = ws;
      ws.binaryType = 'arraybuffer';

      handshakeTimer = setTimeout(() => {
        fail(new Error('Handshake timeout — is Layout Preview Host running?'));
        try {
          ws.close();
        } catch (_) {}
      }, HANDSHAKE_TIMEOUT_MS);

      ws.onopen = () => {
        const hello = makeMessage(MsgType.HELLO, {
          client: 'xhlp-acode',
          clientVersion: '1.0.0',
          token: token || '',
          protocol: 1,
        });
        this._sendRaw(encodeText(hello));
        // Wait for WELCOME via onmessage correlation on first messages
        this._waitType(MsgType.WELCOME, HANDSHAKE_TIMEOUT_MS)
          .then((msg) => ok(msg.payload || {}))
          .catch((e) => fail(e));
        this._waitType(MsgType.AUTH_FAIL, HANDSHAKE_TIMEOUT_MS)
          .then((msg) => {
            fail(new Error(msg.payload?.message || 'AUTH_FAIL'));
          })
          .catch(() => {});
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          const msg = parseText(ev.data);
          if (!msg) return;
          this._handleControl(msg);
        }
        // binary from host not expected in v1
      };

      ws.onerror = () => {
        this._emit('error', { message: 'WebSocket error' });
      };

      ws.onclose = () => {
        this._stopPing();
        this._rejectAllPending(new Error('Connection closed'));
        this._ws = null;
        this._state = 'idle';
        this._welcome = null;
        this._emit('disconnected', {});
        if (!this._intentionalClose) {
          this._scheduleReconnect();
        }
        if (!settled) {
          fail(new Error('Connection closed before WELCOME'));
        }
      };
    });
  }

  disconnect() {
    this._intentionalClose = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._stopPing();
    if (this.isConnected) {
      try {
        this._sendRaw(
          encodeText(
            makeMessage(MsgType.DISCONNECT, { reason: 'client_shutdown' })
          )
        );
      } catch (_) {}
    }
    if (this._ws) {
      try {
        this._ws.close();
      } catch (_) {}
      this._ws = null;
    }
    this._state = 'idle';
    this._welcome = null;
  }

  _scheduleReconnect() {
    if (this._intentionalClose) return;
    if (this._reconnectTimer) return;
    const delay =
      RECONNECT_DELAYS_MS[
        Math.min(this._reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)
      ];
    this._reconnectAttempt += 1;
    this._emit('reconnect_scheduled', { delay, attempt: this._reconnectAttempt });
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      // passive: only reconnect if something calls ensureConnected again
      // (avoid background battery drain). Uncomment for always-on:
      // this.connect().catch(() => {});
    }, delay);
  }

  _startPing() {
    this._stopPing();
    this._pingTimer = setInterval(() => {
      if (!this.isConnected) return;
      const msg = makeMessage(MsgType.PING, {});
      this._sendRaw(encodeText(msg));
    }, PING_INTERVAL_MS);
  }

  _stopPing() {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }

  _sendRaw(data) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected');
    }
    this._ws.send(data);
  }

  _handleControl(msg) {
    this._emit('message', msg);

    if (msg.type === MsgType.PONG) return;

    const pending = this._pending.get(msg.id);
    if (pending) {
      clearTimeout(pending.timer);
      this._pending.delete(msg.id);
      if (msg.type === MsgType.ERROR) {
        pending.reject(
          new Error(msg.payload?.message || msg.payload?.code || 'ERROR')
        );
      } else {
        pending.resolve(msg);
      }
      return;
    }

    // Unsolicited STATUS / ERROR
    if (msg.type === MsgType.STATUS || msg.type === MsgType.ERROR) {
      this._emit(msg.type === MsgType.ERROR ? 'error' : 'status', msg.payload);
    }
  }

  /** Wait for next control message of the given type (handshake). */
  _waitType(type, timeoutMs) {
    return new Promise((resolve, reject) => {
      let unsub = () => {};
      const timer = setTimeout(() => {
        unsub();
        reject(new Error(`Timeout waiting for ${type}`));
      }, timeoutMs);

      unsub = this.onEvent((event, data) => {
        if (event === 'message' && data?.type === type) {
          clearTimeout(timer);
          unsub();
          resolve(data);
        }
      });
    });
  }

  _request(type, payload, timeoutMs = OP_TIMEOUT_MS) {
    if (!this.isConnected) {
      return Promise.reject(new Error('Not connected'));
    }
    const id = nextMsgId();
    const msg = makeMessage(type, payload, id);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error(`Timeout waiting for reply to ${type}`));
      }, timeoutMs);
      this._pending.set(id, { resolve, reject, timer });
      try {
        this._sendRaw(encodeText(msg));
      } catch (e) {
        clearTimeout(timer);
        this._pending.delete(id);
        reject(e);
      }
    });
  }

  _rejectAllPending(err) {
    for (const [, p] of this._pending) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this._pending.clear();
  }

  /**
   * Push linked resource package then wait for STATUS resources_ready.
   * @param {object} opts
   * @param {ArrayBuffer|Uint8Array} opts.bytes
   * @param {string} [opts.packageName]
   * @param {string} [opts.projectId]
   * @param {string} [opts.format]
   */
  async pushResources(opts) {
    await this.ensureConnected();
    const raw =
      opts.bytes instanceof ArrayBuffer
        ? opts.bytes
        : opts.bytes.buffer.slice(
            opts.bytes.byteOffset,
            opts.bytes.byteOffset + opts.bytes.byteLength
          );
    const byteLength =
      opts.bytes instanceof ArrayBuffer
        ? opts.bytes.byteLength
        : opts.bytes.byteLength;
    const transferId = `t-${Date.now()}-${nextMsgId()}`;
    const hash = await sha256Hex(raw);

    const meta = makeMessage(MsgType.PUSH_RESOURCES, {
      transferId,
      byteLength,
      sha256: hash || undefined,
      format: opts.format || 'aapt2-apk',
      projectId: opts.projectId || undefined,
      packageName: opts.packageName || undefined,
    });

    // Register pending on meta.id for STATUS/ERROR
    const waitReply = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(meta.id);
        reject(new Error('Timeout waiting for resources STATUS'));
      }, OP_TIMEOUT_MS);
      this._pending.set(meta.id, { resolve, reject, timer });
    });

    this._sendRaw(encodeText(meta));
    this._sendRaw(raw);

    const reply = await waitReply;
    if (reply.type === MsgType.ERROR) {
      throw new Error(reply.payload?.message || 'PUSH_RESOURCES failed');
    }
    return reply.payload;
  }

  /**
   * @param {object} opts
   * @param {string} opts.layout - e.g. activity_main
   * @param {object} [opts.config]
   * @param {string} [opts.projectId]
   */
  async inflate(opts) {
    await this.ensureConnected();
    const payload = {
      layout: opts.layout,
      layoutResName: opts.layoutResName || `layout/${opts.layout}`,
      projectId: opts.projectId,
      config: opts.config || {},
    };
    // Optional raw XML — Host can inflate without aapt2 package
    if (opts.layoutXml) {
      payload.layoutXml = opts.layoutXml;
    }
    // Lightweight values maps (strings/colors/dimen) from res/values
    if (opts.values && typeof opts.values === 'object') {
      payload.values = opts.values;
    }
    if (opts.drawables && typeof opts.drawables === 'object') {
      payload.drawables = opts.drawables;
    }
    if (opts.layouts && typeof opts.layouts === 'object') {
      payload.layouts = opts.layouts;
    }
    if (opts.menus && typeof opts.menus === 'object') {
      payload.menus = opts.menus;
    }
    const reply = await this._request(MsgType.INFLATE, payload);
    if (reply.type === MsgType.ERROR) {
      throw new Error(reply.payload?.message || 'INFLATE failed');
    }
    return reply.payload;
  }

  async clear(projectId) {
    if (!this.isConnected) return;
    try {
      await this._request(MsgType.CLEAR, {
        projectId: projectId || undefined,
        all: !projectId,
      });
    } catch (_) {}
  }
}

/** Singleton */
let _instance = null;
export function getPreviewHostClient() {
  if (!_instance) _instance = new PreviewHostClient();
  return _instance;
}

export { PreviewHostClient };
