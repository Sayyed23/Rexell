"""
Challenge Engine Models

This module defines Pydantic models for the Challenge Engine component.
Implements Requirements 4.1, 4.2, 4.3 from the design document.
"""

from typing import Dict, Any, Optional, List
from uuid import UUID
from pydantic import BaseModel, Field

# Import ChallengeType enum from shared models
from shared.models.types import ChallengeType


class ChallengeContent(BaseModel):
    """
    Content payload for a challenge.
    
    For image_selection challenges:
        - images: List[str] - URLs of images to display
        - correctIndices: List[int] - Indices of correct images (encrypted server-side)
        - prompt: str - Instruction text (e.g., "Select all images containing traffic lights")
    
    For behavioral_confirmation challenges:
        - action: str - Action to perform (e.g., "click_sequence", "typing_pattern")
        - parameters: Dict[str, Any] - Action-specific parameters
    
    For multi_step challenges:
        - steps: List[Dict[str, Any]] - Sequence of challenge steps
    """
    
    # Generic content structure - specific fields depend on challenge type
    data: Dict[str, Any] = Field(
        ...,
        description="Challenge-specific content payload"
    )


class Challenge(BaseModel):
    """
    Challenge model representing a verification challenge presented to a user.
    
    Attributes:
        challenge_id: Unique identifier for the challenge (UUID v4)
        type: Type of challenge (image_selection, behavioral_confirmation, multi_step)
        content: Challenge content payload
        expires_at: Unix timestamp (seconds) when challenge expires
        max_attempts: Maximum number of attempts allowed (default: 3)
    """
    
    challenge_id: UUID = Field(
        ...,
        description="Unique challenge identifier"
    )
    
    type: ChallengeType = Field(
        ...,
        description="Challenge type: image_selection, behavioral_confirmation, or multi_step"
    )
    
    content: ChallengeContent = Field(
        ...,
        description="Challenge content payload"
    )
    
    expires_at: int = Field(
        ...,
        description="Unix timestamp (seconds) when challenge expires (5 minutes from creation)",
        gt=0
    )
    
    max_attempts: int = Field(
        default=3,
        description="Maximum number of attempts allowed",
        ge=1,
        le=10
    )


class ChallengeResponse(BaseModel):
    """
    User's response to a challenge.
    
    Attributes:
        challenge_id: UUID of the challenge being responded to
        response_data: User's response payload (structure depends on challenge type)
    
    For image_selection:
        response_data: {"selected_indices": [0, 2, 5]}
    
    For behavioral_confirmation:
        response_data: {"action_data": {...}}
    
    For multi_step:
        response_data: {"step_responses": [{...}, {...}]}
    """
    
    challenge_id: UUID = Field(
        ...,
        description="Challenge identifier"
    )
    
    response_data: Dict[str, Any] = Field(
        ...,
        description="User's response payload (structure depends on challenge type)"
    )


class ChallengeResult(BaseModel):
    """
    Result of challenge validation.
    
    Attributes:
        success: Whether the challenge was successfully completed
        risk_score_adjustment: Risk score adjustment (-30 for success, +10 for failure)
        remaining_attempts: Number of attempts remaining (0 if max reached)
        blocked_until: Optional Unix timestamp when user is blocked until (15 minutes after 3 failures)
    """
    
    success: bool = Field(
        ...,
        description="Whether the challenge was successfully completed"
    )
    
    risk_score_adjustment: int = Field(
        ...,
        description="Risk score adjustment: -30 for success, +10 for failure"
    )
    
    remaining_attempts: int = Field(
        ...,
        description="Number of attempts remaining",
        ge=0
    )
    
    blocked_until: Optional[int] = Field(
        default=None,
        description="Unix timestamp (seconds) when user is blocked until (15 minutes after 3 failures)"
    )
