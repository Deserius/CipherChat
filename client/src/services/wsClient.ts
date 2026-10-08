import type { ClientMessage, ServerMessage } from '@shared/protocol';

export type WsStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

export class WsClient {
  private ws: WebSocket | null = null;
  private status: WsStatus = 'idle';
  private shouldReconnect = false;
  private attempt = 0;
  private pingTimer: number | null = null;
  private outbound: ClientMessage[] = [];
  onMessage: (msg: ServerMessage) => void = () => {};
  onStatus: (s: WsStatus) => void = () => {};

  get ready() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect() {
    this.shouldReconnect = true;
    this.open();
  }

  private open() {
    this.cleanupSocket();
    this.setStatus('connecting');
    const ws = new WebSocket(wsUrl());
    this.ws = ws;
    ws.onopen = () => {
      this.attempt = 0;
      this.setStatus('open');
      this.startPing();
      this.flush();
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as ServerMessage;
        this.onMessage(msg);
      } catch {
        /* ignore */
      }
    };
    ws.onerror = () => {
      this.setStatus('error');
    };
    ws.onclose = () => {
      this.stopPing();
      this.setStatus('closed');
      if (this.shouldReconnect) this.scheduleReconnect();
    };
  }

  send(msg: ClientMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (msg.type !== 'ping' && msg.type !== 'heartbeat') {
        this.outbound.push(msg);
        if (this.outbound.length > 80) this.outbound.shift();
      }
      return false;
    }
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  private flush() {
    const pending = this.outbound.splice(0);
    for (const msg of pending) this.send(msg);
  }

  disconnect() {
    this.shouldReconnect = false;
    this.outbound = [];
    this.stopPing();
    try {
      this.ws?.close(1000, 'client-leave');
    } catch {
      /* ignore */
    }
    this.ws = null;
  }

  private scheduleReconnect() {
    this.attempt += 1;
    const delay = Math.min(8_000, 250 * 2 ** Math.min(this.attempt, 5));
    window.setTimeout(() => {
      if (this.shouldReconnect) this.open();
    }, delay);
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = window.setInterval(() => {
      this.send({ type: 'ping', ts: Date.now() });
    }, 15_000);
  }

  private stopPing() {
    if (this.pingTimer) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private cleanupSocket() {
    if (!this.ws) return;
    this.ws.onopen = null;
    this.ws.onmessage = null;
    this.ws.onerror = null;
    this.ws.onclose = null;
  }

  private setStatus(s: WsStatus) {
    this.status = s;
    this.onStatus(s);
  }
}
