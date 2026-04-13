import numpy as np
import math
from collections import Counter
from typing import List
from .models.types import (
    BehavioralData, 
    FeatureVector, 
    EventType, 
    MouseEvent, 
    KeystrokeEvent, 
    NavigationEvent
)

class BehavioralAnalyzer:
    def __init__(self):
        # Heuristic maximums for Min-Max normalization mapping features to bounds [0, 1]
        self.max_velocity = 5000.0       # pixels per second
        self.max_acceleration = 20000.0  # pixels per second squared
        self.max_curvature = 5.0         # ratio of total distance / direct distance
        self.max_click_freq = 10.0       # clicks per second
        self.max_time = 2000.0           # milliseconds
        self.max_entropy = 5.0           # shannon entropy

    def extract_features(self, data: BehavioralData) -> FeatureVector:
        """
        Parses all behavioral events into a normalized FeatureVector for ML ingestion.
        """
        mouse_events = []
        key_events = []
        nav_events = []
        
        # Dispatch events based on extracted class type mapping
        for event in data.events:
            if isinstance(event, MouseEvent):
                mouse_events.append(event)
            elif isinstance(event, KeystrokeEvent):
                key_events.append(event)
            elif isinstance(event, NavigationEvent):
                nav_events.append(event)

        # Mouse Features
        v_mean, v_std, acc, curv, c_freq = self._extract_mouse_features(mouse_events)

        # Keystroke Features
        f_mean, f_std, d_mean = self._extract_keystroke_features(key_events)

        # Navigation Features
        n_ent, p_dist = self._extract_navigation_features(nav_events)

        return FeatureVector(
            mouse_velocity_mean=self._normalize(v_mean, self.max_velocity),
            mouse_velocity_std=self._normalize(v_std, self.max_velocity),
            mouse_acceleration=self._normalize(acc, self.max_acceleration),
            mouse_curvature=self._normalize(curv, self.max_curvature),
            click_frequency=self._normalize(c_freq, self.max_click_freq),
            flight_time_mean=self._normalize(f_mean, self.max_time),
            flight_time_std=self._normalize(f_std, self.max_time),
            dwell_time_mean=self._normalize(d_mean, self.max_time),
            navigation_entropy=self._normalize(n_ent, self.max_entropy),
            page_dwell_time_dist=self._normalize(p_dist, self.max_time)
        )

    def _normalize(self, value: float, max_val: float) -> float:
        """
        Normalizes a value safely to the range [0.0, 1.0]. Returns 0.0 if value is None or NaN.
        """
        if value is None or np.isnan(value):
            return 0.0
        return float(np.clip(value / max_val, 0.0, 1.0))

    def _extract_mouse_features(self, events: List[MouseEvent]):
        if len(events) < 2:
            return 0.0, 0.0, 0.0, 1.0, 0.0

        coords = np.array([[e.x, e.y] for e in events])
        times = np.array([e.timestamp for e in events])
        
        # Temporal difference delta
        dt = np.diff(times)
        # Avoid division by zero issues
        dt = np.where(dt == 0, 0.001, dt)
        
        # Path distance magnitudes
        dists = np.linalg.norm(np.diff(coords, axis=0), axis=1)
        
        # Velocity
        velocities = dists / dt
        v_mean = np.mean(velocities)
        v_std = np.std(velocities)
        
        # Acceleration
        acc_mean = 0.0
        if len(dt) > 1:
            accs = np.diff(velocities) / dt[1:]
            acc_mean = np.mean(np.abs(accs))
        
        # Curvature Path Mapping
        total_dist = np.sum(dists)
        direct_dist = np.linalg.norm(coords[-1] - coords[0])
        curvature = total_dist / direct_dist if direct_dist > 0 else 1.0
        
        # Click frequency tracking
        clicks = [e for e in events if e.type == EventType.click]
        total_time = (times[-1] - times[0])
        c_freq = len(clicks) / total_time if total_time > 0 else 0.0

        return float(v_mean), float(v_std), float(acc_mean), float(curvature), float(c_freq)

    def _extract_keystroke_features(self, events: List[KeystrokeEvent]):
        if not events:
            return 0.0, 0.0, 0.0

        flight_times = [e.interKeyInterval for e in events if e.interKeyInterval is not None]
        dwell_times = [e.pressTime for e in events if e.pressTime is not None]

        f_mean = np.mean(flight_times) if flight_times else 0.0
        f_std = np.std(flight_times) if flight_times else 0.0
        d_mean = np.mean(dwell_times) if dwell_times else 0.0

        return float(f_mean), float(f_std), float(d_mean)

    def _extract_navigation_features(self, events: List[NavigationEvent]):
        if not events:
            return 0.0, 0.0

        pages = [e.toPage for e in events]
        counts = Counter(pages)
        total = sum(counts.values())
        
        # Calculate navigation entropy bound probabilistically
        probs = [c / total for c in counts.values()]
        entropy = -sum(p * math.log2(p) for p in probs)

        dwell_times = [e.dwellTime for e in events if e.dwellTime is not None]
        d_std = np.std(dwell_times) if len(dwell_times) > 1 else 0.0

        return float(entropy), float(d_std)
