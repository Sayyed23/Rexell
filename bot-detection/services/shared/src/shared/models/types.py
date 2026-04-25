from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any, Union, Annotated, Literal
from pydantic import BaseModel, Field, field_validator, Discriminator

# Task 4.1: Risk Decision Thresholds
RISK_THRESHOLD_BLOCK = 80
RISK_THRESHOLD_CHALLENGE = 50

class ChallengeType(str, Enum):
    image_selection = "image_selection"
    behavioral_confirmation = "behavioral_confirmation"
    multi_step = "multi_step"

class EventType(str, Enum):
    mousemove = "mousemove"
    click = "click"
    scroll = "scroll"
    keydown = "keydown"
    keyup = "keyup"
    navigation = "navigation"

class BaseEvent(BaseModel):
    timestamp: float
    type: EventType

class MouseEvent(BaseEvent):
    type: Literal[EventType.mousemove, EventType.click, EventType.scroll]
    x: float
    y: float

    @field_validator('x', 'y')
    @classmethod
    def check_non_negative(cls, v: float, info) -> float:
        if v < 0:
            raise ValueError(f"{info.field_name} coordinate cannot be negative")
        return v

class KeystrokeEvent(BaseEvent):
    type: Literal[EventType.keydown, EventType.keyup]
    key: str
    pressTime: Optional[float] = None
    interKeyInterval: Optional[float] = None

    @field_validator('pressTime', 'interKeyInterval')
    @classmethod
    def check_positive_duration(cls, v: Optional[float], info) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError(f"{info.field_name} must be a positive duration")
        return v

class NavigationEvent(BaseEvent):
    type: Literal[EventType.navigation]
    fromPage: Optional[str] = None
    toPage: str
    dwellTime: Optional[float] = None

    @field_validator('dwellTime')
    @classmethod
    def check_positive_dwell(cls, v: Optional[float], info) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError(f"{info.field_name} must be a positive duration")
        return v

class BehavioralData(BaseModel):
    sessionId: str
    walletAddress: str
    userAgent: str
    # The browser cannot reliably determine its own public IP, so this is
    # injected server-side from request.client.host before the payload is
    # processed. Required-on-the-wire would have failed Pydantic validation
    # for every legitimate /v1/detect call from the SDK and the frontend
    # shim and silently disabled bot detection (the frontend graceful-
    # degrade path swallows 422s).
    ipAddress: Optional[str] = None
    events: List[Annotated[Union[MouseEvent, KeystrokeEvent, NavigationEvent], Field(discriminator='type')]] = Field(..., description="Chronological sequence of physical interactions")

    @field_validator('events')
    @classmethod
    def validate_events(cls, events: List[BaseEvent]) -> List[BaseEvent]:
        if not events:
            raise ValueError("events list cannot be empty")
        
        # Check chronological order
        for i in range(1, len(events)):
            if events[i].timestamp < events[i-1].timestamp:
                raise ValueError("events must be in strict chronological order")
        return events

class FeatureVector(BaseModel):
    mouse_velocity_mean: float
    mouse_velocity_std: float
    mouse_acceleration: float
    mouse_curvature: float
    click_frequency: float
    flight_time_mean: float
    flight_time_std: float
    dwell_time_mean: float
    navigation_entropy: float
    page_dwell_time_dist: float

class RiskContext(BaseModel):
    accountAgeDays: int = 0
    transactionCount: int = 0
    isBulkPurchase: bool = False
    requestedQuantity: int = 1

class DetectionRequest(BaseModel):
    behavioralData: BehavioralData
    context: Optional[RiskContext] = None

class DetectionResponseDecision(str, Enum):
    allow = "allow"
    challenge = "challenge"
    block = "block"

class DetectionResponse(BaseModel):
    decision: DetectionResponseDecision
    riskScore: float
    verificationToken: Optional[str] = None
    challengeId: Optional[str] = None
    challengeType: Optional[ChallengeType] = None
    challengeContent: Optional[Dict[str, Any]] = None

class VerificationToken(BaseModel):
    tokenId: str
    walletAddress: str
    eventId: Optional[str] = None
    maxQuantity: Optional[int] = None
    issuedAt: int
    expiresAt: int
    signature: str

class RiskFactor(BaseModel):
    factor: str
    contribution: float
    description: str

class RiskScore(BaseModel):
    score: float
    factors: List[RiskFactor]
    decision: DetectionResponseDecision

class ReputationScore(BaseModel):
    score: float
    trusted: bool
    last_updated: int
