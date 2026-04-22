"""
Challenge Engine - Generation Logic

Implements challenge generation for the Challenge Engine component.
Handles challenge type selection based on risk score, image loading from MinIO,
Redis state storage, and challenge response construction.

Requirements: 4.2, 4.3
"""

import json
import logging
import uuid
from typing import List, Optional

import redis.asyncio as redis
from minio import Minio
from minio.error import S3Error

from shared.models.types import ChallengeType
from shared.utils.time_utils import current_timestamp

from .models import Challenge, ChallengeContent

logger = logging.getLogger(__name__)

# Challenge type selection thresholds (Requirements 4.2, 4.3)
CHALLENGE_SCORE_LOW = 50
CHALLENGE_SCORE_MID = 65
CHALLENGE_SCORE_HIGH = 80

# MinIO configuration
MINIO_CHALLENGE_BUCKET = "challenge-content"
MINIO_IMAGES_PREFIX = "images/"

# Redis TTL for challenge state: 5 minutes (300 seconds)
CHALLENGE_REDIS_TTL_SECONDS = 300

# Default image categories available in MinIO
DEFAULT_IMAGE_CATEGORIES = ["traffic_lights", "crosswalks"]

# Number of images to present per challenge
IMAGE_SELECTION_TOTAL_IMAGES = 9
IMAGE_SELECTION_CORRECT_COUNT = 3


def select_challenge_type(risk_score: float) -> ChallengeType:
    """
    Select challenge type based on risk score.

    - 50 <= score <= 65  → image_selection  (Requirement 4.2)
    - 65 < score <= 80   → multi_step       (Requirement 4.3)

    Args:
        risk_score: Calculated risk score in range [50, 80].

    Returns:
        ChallengeType enum value.

    Raises:
        ValueError: If risk_score is outside the challenge range [50, 80].
    """
    if risk_score < CHALLENGE_SCORE_LOW or risk_score > CHALLENGE_SCORE_HIGH:
        raise ValueError(
            f"Risk score {risk_score} is outside the challenge range "
            f"[{CHALLENGE_SCORE_LOW}, {CHALLENGE_SCORE_HIGH}]"
        )

    if risk_score <= CHALLENGE_SCORE_MID:
        return ChallengeType.image_selection
    else:
        return ChallengeType.multi_step


class MinIOImageLoader:
    """
    Loads challenge images from MinIO object storage.

    Images are stored in the `challenge-content` bucket under the `images/` prefix,
    organized by category subdirectory (e.g. images/traffic_lights/).
    """

    def __init__(self, minio_client: Minio, endpoint_url: str):
        """
        Args:
            minio_client: Configured MinIO client instance.
            endpoint_url: Public-facing base URL for constructing presigned/direct image URLs.
        """
        self.client = minio_client
        self.endpoint_url = endpoint_url.rstrip("/")

    def list_images_for_category(self, category: str) -> List[str]:
        """
        List all image object names for a given category from MinIO.

        Args:
            category: Image category name (e.g. "traffic_lights").

        Returns:
            List of object names (keys) within the category prefix.
        """
        prefix = f"{MINIO_IMAGES_PREFIX}{category}/"
        try:
            objects = self.client.list_objects(
                MINIO_CHALLENGE_BUCKET,
                prefix=prefix,
                recursive=True,
            )
            return [obj.object_name for obj in objects]
        except S3Error as exc:
            logger.warning(
                "Failed to list images for category '%s' from MinIO: %s",
                category,
                exc,
            )
            return []

    def get_image_url(self, object_name: str) -> str:
        """
        Build a direct URL for an image object.

        Args:
            object_name: Full object name/key in the bucket.

        Returns:
            URL string pointing to the image.
        """
        return f"{self.endpoint_url}/{MINIO_CHALLENGE_BUCKET}/{object_name}"

    def load_images_for_challenge(
        self,
        category: str,
        total: int = IMAGE_SELECTION_TOTAL_IMAGES,
    ) -> List[str]:
        """
        Load a list of image URLs for a challenge from a given category.

        Falls back to placeholder URLs if MinIO is unavailable or has insufficient images.

        Args:
            category: Image category to load from.
            total: Total number of image URLs to return.

        Returns:
            List of image URL strings (length == total).
        """
        object_names = self.list_images_for_category(category)

        if len(object_names) >= total:
            # Use the first `total` objects (deterministic for reproducibility)
            selected = object_names[:total]
        else:
            # Pad with placeholder URLs if not enough images are available
            selected = list(object_names)
            for i in range(total - len(object_names)):
                selected.append(
                    f"{MINIO_IMAGES_PREFIX}{category}/placeholder_{i}.jpg"
                )

        return [self.get_image_url(name) for name in selected]


class ChallengeGenerator:
    """
    Generates verification challenges based on risk score.

    Responsibilities:
    - Select challenge type from risk score
    - Load challenge images from MinIO
    - Persist challenge state in Redis with 5-minute TTL
    - Return a fully populated Challenge model
    """

    def __init__(
        self,
        redis_client: redis.Redis,
        image_loader: MinIOImageLoader,
    ):
        """
        Args:
            redis_client: Async Redis client for challenge state storage.
            image_loader: MinIOImageLoader for fetching challenge images.
        """
        self.redis = redis_client
        self.image_loader = image_loader

    async def generate_challenge(
        self,
        risk_score: float,
        session_id: str,
        user_hash: str,
    ) -> Challenge:
        """
        Generate a verification challenge appropriate for the given risk score.

        Steps:
        1. Select challenge type based on risk score (Requirements 4.2, 4.3)
        2. Build challenge content (load images from MinIO)
        3. Assign a unique UUID challenge_id
        4. Persist challenge state in Redis with 5-minute TTL
        5. Return the Challenge model

        Args:
            risk_score: Calculated risk score in range [50, 80].
            session_id: Session identifier for the user.
            user_hash: Anonymized user identifier (hashed wallet address).

        Returns:
            A populated Challenge instance.

        Raises:
            ValueError: If risk_score is outside the challenge range.
        """
        challenge_type = select_challenge_type(risk_score)
        challenge_id = str(uuid.uuid4())
        expires_at = current_timestamp() + CHALLENGE_REDIS_TTL_SECONDS

        content = self._build_content(challenge_type)

        challenge = Challenge(
            challenge_id=uuid.UUID(challenge_id),
            type=challenge_type,
            content=content,
            expires_at=expires_at,
            max_attempts=3,
        )

        await self._store_challenge_state(
            challenge_id=challenge_id,
            challenge_type=challenge_type,
            content_data=content.data,
            expires_at=expires_at,
            session_id=session_id,
            user_hash=user_hash,
        )

        logger.info(
            "Generated challenge %s (type=%s) for session %s",
            challenge_id,
            challenge_type.value,
            session_id,
        )

        return challenge

    def _build_content(self, challenge_type: ChallengeType) -> ChallengeContent:
        """
        Build the ChallengeContent payload for the given challenge type.

        For image_selection:
            - Loads images from a single category
            - Includes prompt and correct answer indices (server-side only)

        For multi_step:
            - Step 1: image_selection sub-challenge
            - Step 2: behavioral_confirmation sub-challenge

        Args:
            challenge_type: The type of challenge to build content for.

        Returns:
            A ChallengeContent instance with the appropriate data payload.
        """
        if challenge_type == ChallengeType.image_selection:
            return self._build_image_selection_content()
        elif challenge_type == ChallengeType.multi_step:
            return self._build_multi_step_content()
        else:
            # behavioral_confirmation is not used for generation in this range
            raise ValueError(
                f"Unsupported challenge type for generation: {challenge_type}"
            )

    def _build_image_selection_content(self) -> ChallengeContent:
        """
        Build content for an image_selection challenge.

        Loads images from the first available category in MinIO.
        Correct indices are the first IMAGE_SELECTION_CORRECT_COUNT images
        (server-side knowledge; not exposed to the client directly).

        Returns:
            ChallengeContent with images, prompt, and correct_indices.
        """
        category = DEFAULT_IMAGE_CATEGORIES[0]  # e.g. "traffic_lights"
        images = self.image_loader.load_images_for_challenge(
            category=category,
            total=IMAGE_SELECTION_TOTAL_IMAGES,
        )

        # Correct indices are the first N images (deterministic for this implementation)
        correct_indices = list(range(IMAGE_SELECTION_CORRECT_COUNT))

        return ChallengeContent(
            data={
                "images": images,
                "prompt": f"Select all images containing {category.replace('_', ' ')}",
                "correct_indices": correct_indices,  # Server-side; not sent to client
                "category": category,
            }
        )

    def _build_multi_step_content(self) -> ChallengeContent:
        """
        Build content for a multi_step challenge.

        Combines an image_selection step with a behavioral_confirmation step.

        Returns:
            ChallengeContent with a steps list.
        """
        category = DEFAULT_IMAGE_CATEGORIES[0]
        images = self.image_loader.load_images_for_challenge(
            category=category,
            total=IMAGE_SELECTION_TOTAL_IMAGES,
        )
        correct_indices = list(range(IMAGE_SELECTION_CORRECT_COUNT))

        steps = [
            {
                "step": 1,
                "type": ChallengeType.image_selection.value,
                "images": images,
                "prompt": f"Select all images containing {category.replace('_', ' ')}",
                "correct_indices": correct_indices,
                "category": category,
            },
            {
                "step": 2,
                "type": ChallengeType.behavioral_confirmation.value,
                "action": "click_sequence",
                "parameters": {
                    "description": "Click the highlighted areas in order",
                    "sequence_length": 3,
                },
            },
        ]

        return ChallengeContent(data={"steps": steps})

    async def _store_challenge_state(
        self,
        challenge_id: str,
        challenge_type: ChallengeType,
        content_data: dict,
        expires_at: int,
        session_id: str,
        user_hash: str,
    ) -> None:
        """
        Persist challenge state in Redis with a 5-minute TTL.

        Redis key pattern: `challenge:{challenge_id}`

        The stored state includes all fields needed for validation:
        - challenge_type
        - content_data (including correct_indices for server-side validation)
        - expires_at
        - session_id
        - user_hash
        - attempts (initialized to 0)
        - status (initialized to "pending")

        Args:
            challenge_id: UUID string for the challenge.
            challenge_type: The type of challenge.
            content_data: The full content data dict (including correct answers).
            expires_at: Unix timestamp when the challenge expires.
            session_id: Session identifier.
            user_hash: Anonymized user identifier.
        """
        redis_key = f"challenge:{challenge_id}"

        state = {
            "challenge_id": challenge_id,
            "challenge_type": challenge_type.value,
            "content_data": content_data,
            "expires_at": expires_at,
            "session_id": session_id,
            "user_hash": user_hash,
            "attempts": 0,
            "status": "pending",
        }

        await self.redis.setex(
            redis_key,
            CHALLENGE_REDIS_TTL_SECONDS,
            json.dumps(state),
        )

        logger.debug(
            "Stored challenge state in Redis: key=%s ttl=%ds",
            redis_key,
            CHALLENGE_REDIS_TTL_SECONDS,
        )
