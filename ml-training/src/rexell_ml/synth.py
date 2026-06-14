"""Synthetic mouse / keystroke trajectory generators.

Used by ``05_deep_learning_sequence.ipynb`` to fabricate plausible behavioural
biometric streams from the row-level labels of the master CSV. **All sequences
produced by this module are synthetic** — clearly marked in the notebook —
because the production behavioural-biometrics corpus does not exist yet
(it requires live traffic on the deployed Detection Service).

Schemas match the SDK / detection service:

* mouse trajectory  : (T, 3) — (timestamp_ms, x_norm, y_norm)
* keystroke stream  : (T, 3) — (timestamp_ms, dwell_ms, flight_ms)
"""

from __future__ import annotations

import numpy as np


SEQ_LEN = 200


def _human_mouse(rng: np.random.Generator, length: int = SEQ_LEN) -> np.ndarray:
    """Random-walk style human trajectory with smooth curvature + jitter."""
    t = np.linspace(0.0, 1.0, length)
    # smooth curve via low-frequency Fourier sum
    phase_x = rng.uniform(0, 2 * np.pi, size=4)
    phase_y = rng.uniform(0, 2 * np.pi, size=4)
    freq_x = rng.uniform(0.5, 3.0, size=4)
    freq_y = rng.uniform(0.5, 3.0, size=4)
    x = sum(np.sin(2 * np.pi * f * t + p) for f, p in zip(freq_x, phase_x)) / 4.0
    y = sum(np.sin(2 * np.pi * f * t + p) for f, p in zip(freq_y, phase_y)) / 4.0
    # high-frequency jitter
    x += rng.normal(0, 0.02, size=length)
    y += rng.normal(0, 0.02, size=length)
    # normalise to [0, 1]
    x = (x - x.min()) / (x.max() - x.min() + 1e-9)
    y = (y - y.min()) / (y.max() - y.min() + 1e-9)
    timestamps = np.cumsum(rng.uniform(8, 30, size=length))
    return np.stack([timestamps, x, y], axis=1).astype(np.float32)


def _bot_mouse(rng: np.random.Generator, length: int = SEQ_LEN) -> np.ndarray:
    """Bot trajectory — straight lines, identical step size, regular dt."""
    n_segments = rng.integers(2, 5)
    waypoints = rng.uniform(0, 1, size=(n_segments + 1, 2))
    t_per = length // n_segments
    pts = []
    for i in range(n_segments):
        a, b = waypoints[i], waypoints[i + 1]
        seg = np.linspace(a, b, t_per)
        pts.append(seg)
    seg = np.concatenate(pts, axis=0)
    if len(seg) < length:
        seg = np.concatenate([seg, np.tile(seg[-1:], (length - len(seg), 1))], axis=0)
    seg = seg[:length]
    timestamps = np.arange(length) * 16.0  # exact ~60 Hz, no jitter
    out = np.column_stack([timestamps, seg]).astype(np.float32)
    # pixel-perfect — no jitter at all
    return out


def _human_keystrokes(rng: np.random.Generator, length: int = SEQ_LEN) -> np.ndarray:
    """Human keystrokes have variable dwell + flight, lognormal-ish."""
    timestamps = np.cumsum(rng.lognormal(mean=4.5, sigma=0.6, size=length))
    dwell = rng.lognormal(mean=4.0, sigma=0.4, size=length)
    flight = rng.lognormal(mean=4.5, sigma=0.5, size=length)
    return np.stack([timestamps, dwell, flight], axis=1).astype(np.float32)


def _bot_keystrokes(rng: np.random.Generator, length: int = SEQ_LEN) -> np.ndarray:
    """Bot keystrokes — near-constant dwell + flight."""
    base_dwell = rng.uniform(40, 60)
    base_flight = rng.uniform(80, 120)
    timestamps = np.arange(length) * (base_dwell + base_flight)
    dwell = np.full(length, base_dwell) + rng.normal(0, 1.5, size=length)
    flight = np.full(length, base_flight) + rng.normal(0, 1.5, size=length)
    return np.stack([timestamps, dwell, flight], axis=1).astype(np.float32)


def synth_mouse(label: int, rng: np.random.Generator, length: int = SEQ_LEN) -> np.ndarray:
    return _bot_mouse(rng, length) if label == 1 else _human_mouse(rng, length)


def synth_keystrokes(label: int, rng: np.random.Generator, length: int = SEQ_LEN) -> np.ndarray:
    return _bot_keystrokes(rng, length) if label == 1 else _human_keystrokes(rng, length)


def make_sequence_dataset(
    labels: np.ndarray,
    *,
    length: int = SEQ_LEN,
    seed: int = 42,
) -> tuple[np.ndarray, np.ndarray]:
    """Build a (N, T, 6) tensor by stacking mouse + keystroke channels.

    Channels: ``[t_mouse, x, y, t_key, dwell, flight]``.
    """
    rng = np.random.default_rng(seed)
    out = np.zeros((len(labels), length, 6), dtype=np.float32)
    for i, lab in enumerate(labels):
        m = synth_mouse(int(lab), rng, length)
        k = synth_keystrokes(int(lab), rng, length)
        out[i, :, 0:3] = m
        out[i, :, 3:6] = k
    # per-channel min-max normalise
    flat = out.reshape(-1, 6)
    lo = flat.min(axis=0)
    hi = flat.max(axis=0)
    out = (out - lo) / (hi - lo + 1e-9)
    return out.astype(np.float32), labels.astype(np.int64)
