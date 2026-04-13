import sys
import os

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "src")))

from shared.models.types import BehavioralData, MouseEvent, KeystrokeEvent, NavigationEvent, EventType
from shared.analyzer import BehavioralAnalyzer
import time

def run_demo():
    print("--- Rexell Behavioral Analyzer Demo ---")
    
    # Simulate a user session
    events = []
    start_time = time.time()
    
    # 1. Mouse movements (linear then jittery)
    for i in range(10):
        events.append(MouseEvent(
            timestamp=start_time + i * 0.1,
            type=EventType.mousemove,
            x=100 + i * 10,
            y=100 + i * 5
        ))
    
    # 2. A click
    events.append(MouseEvent(
        timestamp=start_time + 1.1,
        type=EventType.click,
        x=200,
        y=150
    ))
    
    # 3. Keystrokes
    events.append(KeystrokeEvent(
        timestamp=start_time + 1.5,
        type=EventType.keydown,
        key="h",
        pressTime=100.0
    ))
    events.append(KeystrokeEvent(
        timestamp=start_time + 1.7,
        type=EventType.keydown,
        key="e",
        pressTime=110.0,
        interKeyInterval=200.0
    ))
    
    # 4. Navigation
    events.append(NavigationEvent(
        timestamp=start_time + 3.0,
        type=EventType.navigation,
        toPage="/checkout",
        fromPage="/home",
        dwellTime=1500.0
    ))
    
    data = BehavioralData(
        sessionId="test-session-123",
        walletAddress="0x123",
        userAgent="Mozilla/5.0",
        ipAddress="127.0.0.1",
        events=events
    )
    
    print(f"Session with {len(data.events)} events created.")
    
    analyzer = BehavioralAnalyzer()
    vector = analyzer.extract_features(data)
    
    print("\nExtracted Feature Vector:")
    for field, value in vector.model_dump().items():
        print(f"  {field}: {value:.4f}")

if __name__ == "__main__":
    try:
        run_demo()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
