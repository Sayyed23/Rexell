/**
 * Browser-side behavioural tracker for Rexell bot detection.
 *
 * Implements Tasks 14.1 – 14.5:
 * - Mouse tracking at ≥10 samples/sec via requestAnimationFrame sampling
 * - Keystroke timing (pressTime + inter-key interval) with PII filtering
 * - Navigation tracking using the History API (pushState / popstate)
 * - Circular buffers to bound memory usage
 * - Batched transmission to /v1/detect with exponential-backoff retry
 */

import { BotDetectionClient } from './client';
import {
  BehavioralData,
  DetectionRequest,
  DetectionResponse,
  EventType,
  KeystrokeEvent,
  MouseEvent as TrackedMouseEvent,
  NavigationEvent,
  TrackedEvent
} from './types';

export interface BehavioralTrackerConfig {
  sessionId: string;
  walletAddress: string;
  client: BotDetectionClient;
  /** Max events retained in memory. Default 4096. */
  bufferSize?: number;
  /** Transmit after this many new events. Default 256. */
  flushBatchSize?: number;
  /** Max transmission latency (ms). Default 5000. */
  flushIntervalMs?: number;
  /** Approx mouse sample rate (Hz). Default 20. */
  mouseSampleHz?: number;
  /** Skip keystrokes originating from these selectors. */
  sensitiveSelectors?: string[];
}

const DEFAULT_BUFFER = 4_096;
const DEFAULT_FLUSH_BATCH = 256;
const DEFAULT_FLUSH_INTERVAL_MS = 5_000;
const DEFAULT_MOUSE_HZ = 20;
const DEFAULT_SENSITIVE_SELECTORS = [
  'input[type="password"]',
  'input[autocomplete*="cc-"]',
  'input[name*="password" i]',
  'input[name*="creditcard" i]',
  'input[name*="card-number" i]',
  'input[name*="cvv" i]'
];

class CircularBuffer<T> {
  private readonly buf: T[];
  private size = 0;

  constructor(private readonly cap: number) {
    this.buf = new Array<T>(cap);
  }

  push(value: T): void {
    this.buf[this.size % this.cap] = value;
    this.size++;
  }

  drain(): T[] {
    const n = Math.min(this.size, this.cap);
    const offset = this.size > this.cap ? this.size % this.cap : 0;
    const out: T[] = [];
    for (let i = 0; i < n; i++) {
      out.push(this.buf[(offset + i) % this.cap]);
    }
    this.size = 0;
    return out;
  }

  get length(): number {
    return Math.min(this.size, this.cap);
  }
}

export class BehavioralTracker {
  private readonly config: Required<BehavioralTrackerConfig>;
  private readonly events: CircularBuffer<TrackedEvent>;
  private readonly keyDownAt = new Map<string, number>();
  private lastKeyAt: number | null = null;
  private running = false;
  private rafHandle: number | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private pendingMouse: { x: number; y: number; t: number; type: EventType } | null = null;
  private navStack: { page: string; entered: number }[] = [];
  private sampleIntervalMs: number;

  constructor(config: BehavioralTrackerConfig) {
    this.config = {
      bufferSize: config.bufferSize ?? DEFAULT_BUFFER,
      flushBatchSize: config.flushBatchSize ?? DEFAULT_FLUSH_BATCH,
      flushIntervalMs: config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
      mouseSampleHz: config.mouseSampleHz ?? DEFAULT_MOUSE_HZ,
      sensitiveSelectors:
        config.sensitiveSelectors ?? DEFAULT_SENSITIVE_SELECTORS,
      ...config
    };
    this.events = new CircularBuffer<TrackedEvent>(this.config.bufferSize);
    this.sampleIntervalMs = 1000 / this.config.mouseSampleHz;
  }

  start(): void {
    if (this.running || typeof window === 'undefined') return;
    this.running = true;

    window.addEventListener('mousemove', this.onMouseMove, { passive: true });
    window.addEventListener('click', this.onClick, { passive: true });
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('keydown', this.onKeyDown, { passive: true });
    window.addEventListener('keyup', this.onKeyUp, { passive: true });
    window.addEventListener('popstate', this.onPopState);
    this.patchHistory();

    this.navStack.push({
      page: window.location.pathname,
      entered: this.now()
    });

    const tick = () => {
      if (!this.running) return;
      if (this.pendingMouse) {
        this.pushEvent({
          type: this.pendingMouse.type,
          timestamp: this.pendingMouse.t,
          x: this.pendingMouse.x,
          y: this.pendingMouse.y
        } as TrackedMouseEvent);
        this.pendingMouse = null;
      }
      this.rafHandle = requestAnimationFrame(tick);
    };
    this.rafHandle = requestAnimationFrame(tick);

    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.config.flushIntervalMs);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;

    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('click', this.onClick);
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('popstate', this.onPopState);

    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.rafHandle = null;
    this.flushTimer = null;
  }

  async flush(
    context?: DetectionRequest['context']
  ): Promise<DetectionResponse | null> {
    if (this.events.length === 0) return null;
    const batch = this.events.drain();
    const payload: BehavioralData = {
      sessionId: this.config.sessionId,
      walletAddress: this.config.walletAddress,
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      events: batch
    };
    try {
      return await this.config.client.detect(payload, context);
    } catch (err) {
      // on failure, re-enqueue the events so they are not lost
      batch.forEach((e) => this.events.push(e));
      throw err;
    }
  }

  get bufferedCount(): number {
    return this.events.length;
  }

  private now(): number {
    return typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
  }

  private pushEvent(event: TrackedEvent): void {
    this.events.push(event);
    if (this.events.length >= this.config.flushBatchSize) {
      void this.flush();
    }
  }

  private onMouseMove = (ev: MouseEvent) => {
    const t = this.now();
    // rate-limit samples to mouseSampleHz
    if (
      this.pendingMouse &&
      t - this.pendingMouse.t < this.sampleIntervalMs
    ) {
      this.pendingMouse = { x: ev.clientX, y: ev.clientY, t, type: EventType.MouseMove };
      return;
    }
    this.pendingMouse = {
      x: ev.clientX,
      y: ev.clientY,
      t,
      type: EventType.MouseMove
    };
  };

  private onClick = (ev: MouseEvent) => {
    this.pushEvent({
      type: EventType.Click,
      timestamp: this.now(),
      x: ev.clientX,
      y: ev.clientY
    });
  };

  private onScroll = () => {
    this.pushEvent({
      type: EventType.Scroll,
      timestamp: this.now(),
      x: typeof window !== 'undefined' ? window.scrollX : 0,
      y: typeof window !== 'undefined' ? window.scrollY : 0
    });
  };

  private onKeyDown = (ev: KeyboardEvent) => {
    if (this.isSensitiveTarget(ev.target)) return;
    this.keyDownAt.set(ev.code, this.now());
  };

  private onKeyUp = (ev: KeyboardEvent) => {
    if (this.isSensitiveTarget(ev.target)) return;
    const now = this.now();
    const down = this.keyDownAt.get(ev.code);
    const pressTime = down !== undefined ? now - down : undefined;
    const interKeyInterval =
      this.lastKeyAt !== null ? now - this.lastKeyAt : undefined;
    this.lastKeyAt = now;
    if (down !== undefined) this.keyDownAt.delete(ev.code);

    const event: KeystrokeEvent = {
      type: EventType.KeyUp,
      timestamp: now,
      key: ev.code,
      pressTime,
      interKeyInterval
    };
    this.pushEvent(event);
  };

  private onPopState = () => this.recordNavigation(window.location.pathname);

  private patchHistory(): void {
    const wrap = (method: 'pushState' | 'replaceState') => {
      const original = history[method].bind(history);
      history[method] = (
        data: any,
        unused: string,
        url?: string | URL | null
      ) => {
        const result = original(data, unused, url ?? undefined);
        const nextPath =
          typeof url === 'string'
            ? url
            : url instanceof URL
              ? url.pathname
              : window.location.pathname;
        this.recordNavigation(nextPath);
        return result;
      };
    };
    wrap('pushState');
    wrap('replaceState');
  }

  private recordNavigation(next: string): void {
    const now = this.now();
    const prev = this.navStack[this.navStack.length - 1];
    const dwellTime = prev ? now - prev.entered : undefined;
    const fromPage = prev?.page;
    this.navStack.push({ page: next, entered: now });
    if (this.navStack.length > 32) this.navStack.shift();

    const event: NavigationEvent = {
      type: EventType.Navigation,
      timestamp: now,
      fromPage,
      toPage: next,
      dwellTime
    };
    this.pushEvent(event);
  }

  private isSensitiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return this.config.sensitiveSelectors.some((sel) => target.matches(sel));
  }
}
