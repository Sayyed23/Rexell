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


# ---------------------------------------------------------------------------
# Challenge Validation
# ---------------------------------------------------------------------------

# Block TTL after max failures: 15 minutes (900 seconds)
BLOCK_TTL_SECONDS = 900

# Maximum attempts allowed per challenge session
MAX_ATTEMPTS = 3

# Risk score adjustments
RISK_ADJUSTMENT_SUCCESS = -30
RISK_ADJUSTMENT_FAILURE = +10

# Lua script: atomically fetch state from Redis, increment attempts,
# optionally set block key, and persist updated state.
#
# KEYS[1] = redis_key  (challenge:{challenge_id})
# KEYS[2] = block_key  (block:{user_hash}, may be empty string when user_hash unknown)
# ARGV[1] = max_attempts
# ARGV[2] = block_ttl_seconds
# ARGV[3] = remaining_ttl  (seconds until challenge expires)
# ARGV[4] = blocked_until  (unix timestamp = now + block_ttl, pre-computed in Python)
#
# Returns: [new_attempts (int), blocked_until (int, 0 if not blocked)]
# Returns: [-1, 0] when the challenge key no longer exists in Redis.
_RECORD_FAILURE_SCRIPT = """
local raw = redis.call('GET', KEYS[1])
if not raw then
    return {-1, 0}
end

local state     = cjson.decode(raw)
local max_att   = tonumber(ARGV[1])
local block_ttl = tonumber(ARGV[2])
local rem_ttl   = tonumber(ARGV[3])
local blk_until = tonumber(ARGV[4])

state['attempts'] = (state['attempts'] or 0) + 1
local attempts = state['attempts']

local blocked_until = 0

if attempts >= max_att and KEYS[2] ~= '' then
    redis.call('SETEX', KEYS[2], block_ttl, '1')
    blocked_until = blk_until
end

redis.call('SETEX', KEYS[1], rem_ttl, cjson.encode(state))

return {attempts, blocked_until}
"""


class ChallengeExpiredError(Exception):
    """Raised when a challenge has expired or does not exist in Redis."""


class ChallengeNotFoundError(Exception):
    """Raised when a challenge_id is not found in Redis."""


class ChallengeAlreadyCompletedError(Exception):
    """Raised when a challenge has already been completed (replay/resubmission guard)."""


class ChallengeValidator:
    """
    Validates user responses to verification challenges.

    Responsibilities:
    - Retrieve challenge state from Redis by challenge_id
    - Validate user response against the stored correct answer
    - Track attempt count and enforce max 3 attempts per session
    - Apply risk score adjustment: −30 on success, +10 on failure
    - Set Redis block key ``block:{user_hash}`` with 15-minute TTL after 3 failures

    Requirements: 4.4, 4.5, 4.6
    """

    def __init__(self, redis_client: redis.Redis):
        """
        Args:
            redis_client: Async Redis client for challenge state retrieval and updates.
        """
        self.redis = redis_client
        self._record_failure_script = self.redis.register_script(_RECORD_FAILURE_SCRIPT)

    async def validate_challenge(
        self,
        challenge_id: str,
        response_data: dict,
    ) -> "ChallengeResult":
        """
        Validate a user's response to a challenge.

        Steps:
        1. Retrieve challenge state from Redis (``challenge:{challenge_id}``).
        2. Check expiration.
        3. Validate the response against the stored correct answer.
        4. On success: mark status="completed" in Redis, return success result.
        5. On failure: increment attempts; if attempts >= MAX_ATTEMPTS, set block key.

        Args:
            challenge_id: UUID string of the challenge to validate.
            response_data: User's response payload (e.g. ``{"selected_indices": [0, 2, 5]}``).

        Returns:
            A :class:`ChallengeResult` instance.

        Raises:
            ChallengeNotFoundError: If no challenge state exists for the given ID.
            ChallengeExpiredError: If the challenge has expired.
        """
        from .models import ChallengeResult  # local import to avoid circular deps

        redis_key = f"challenge:{challenge_id}"
        raw = await self.redis.get(redis_key)

        if raw is None:
            raise ChallengeNotFoundError(
                f"Challenge {challenge_id} not found in Redis"
            )

        state = json.loads(raw)

        # Check expiration
        now = current_timestamp()
        if now > state["expires_at"]:
            raise ChallengeExpiredError(
                f"Challenge {challenge_id} has expired"
            )

        # Guard against replay/resubmission of already-completed challenges
        if state.get("status") == "completed":
            raise ChallengeAlreadyCompletedError(
                f"Challenge {challenge_id} already completed"
            )

        # Validate response
        is_correct = self._validate_response(state, response_data)

        if is_correct:
            # Mark challenge as completed
            state["status"] = "completed"
            remaining_ttl = max(state["expires_at"] - now, 1)
            await self.redis.setex(
                redis_key,
                remaining_ttl,
                json.dumps(state),
            )

            logger.info(
                "Challenge %s completed successfully for user_hash=%s",
                challenge_id,
                state.get("user_hash"),
            )

            return ChallengeResult(
                success=True,
                risk_score_adjustment=RISK_ADJUSTMENT_SUCCESS,
                remaining_attempts=0,
                blocked_until=None,
            )
        else:
            # Atomically increment attempts, conditionally set block key, and
            # persist updated state — all in one Lua script to avoid races.
            user_hash = state.get("user_hash", "")
            block_key = f"block:{user_hash}" if user_hash else ""
            remaining_ttl = max(state["expires_at"] - now, 1)
            blocked_until_ts = now + BLOCK_TTL_SECONDS  # pre-computed; Lua uses it only when blocking

            result = await self._record_failure_script(
                keys=[redis_key, block_key],
                args=[
                    json.dumps(state),
                    MAX_ATTEMPTS,
                    BLOCK_TTL_SECONDS,
                    int(remaining_ttl),
                    int(blocked_until_ts),
                ],
            )

            attempts = int(result[0])
            blocked_until: Optional[int] = int(result[1]) if int(result[1]) else None

            if attempts >= MAX_ATTEMPTS:
                if not user_hash:
                    logger.error(
                        "Challenge %s missing user_hash; cannot set block key",
                        challenge_id,
                    )
                else:
                    logger.warning(
                        "Challenge %s: max attempts reached for user_hash=%s; "
                        "blocking until %d",
                        challenge_id,
                        user_hash,
                        blocked_until,
                    )

            remaining_attempts = max(MAX_ATTEMPTS - attempts, 0)

            logger.info(
                "Challenge %s failed (attempt %d/%d) for user_hash=%s",
                challenge_id,
                attempts,
                MAX_ATTEMPTS,
                user_hash,
            )

            return ChallengeResult(
                success=False,
                risk_score_adjustment=RISK_ADJUSTMENT_FAILURE,
                remaining_attempts=remaining_attempts,
                blocked_until=blocked_until,
            )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _validate_response(self, state: dict, response_data: dict) -> bool:
        """
        Dispatch response validation based on challenge type.

        Args:
            state: Challenge state dict retrieved from Redis.
            response_data: User's response payload.

        Returns:
            True if the response is correct, False otherwise.
        """
        challenge_type = state.get("challenge_type")

        if challenge_type == ChallengeType.image_selection.value:
            return self._validate_image_selection(state, response_data)
        elif challenge_type == ChallengeType.multi_step.value:
            return self._validate_multi_step(state, response_data)
        elif challenge_type == ChallengeType.behavioral_confirmation.value:
            # Behavioral data is analyzed separately; any non-empty response is valid
            return self._validate_behavioral_confirmation(response_data)
        else:
            logger.warning("Unknown challenge type '%s'; treating as failure", challenge_type)
            return False

    def _validate_image_selection(self, state: dict, response_data: dict) -> bool:
        """
        Validate an image_selection challenge response.

        Compares ``response_data["selected_indices"]`` against
        ``content_data["correct_indices"]`` using exact set equality.

        Args:
            state: Challenge state dict.
            response_data: Must contain ``selected_indices`` key.

        Returns:
            True if the selected indices exactly match the correct indices.
        """
        content_data = state.get("content_data", {})
        correct_indices = content_data.get("correct_indices", [])
        selected_indices = response_data.get("selected_indices", [])

        return set(selected_indices) == set(correct_indices)

    def _validate_multi_step(self, state: dict, response_data: dict) -> bool:
        """
        Validate a multi_step challenge response.

        Step 1 (image_selection): validate selected_indices against correct_indices
        from the first step in content_data["steps"].

        Step 2 (behavioral_confirmation): accept any non-empty response.

        All steps must be answered; partial submissions are rejected.

        Args:
            state: Challenge state dict.
            response_data: Must contain ``step_responses`` list with one entry per step.

        Returns:
            True only if every step is present and valid.
        """
        content_data = state.get("content_data", {})
        steps = content_data.get("steps", [])
        step_responses = response_data.get("step_responses", [])

        # Reject partial submissions — every step must be answered
        if len(step_responses) != len(steps):
            return False

        for i, step_response in enumerate(step_responses):
            step = steps[i]
            step_type = step.get("type")

            if step_type == ChallengeType.image_selection.value:
                correct_indices = step.get("correct_indices", [])
                selected_indices = step_response.get("selected_indices", [])
                if set(selected_indices) != set(correct_indices):
                    return False

            elif step_type == ChallengeType.behavioral_confirmation.value:
                if not self._validate_behavioral_confirmation(step_response):
                    return False

        return True

    @staticmethod
    def _validate_behavioral_confirmation(response_data: dict) -> bool:
        """
        Validate a behavioral_confirmation response.

        Any non-empty response dict is accepted as valid; the actual behavioral
        data is analyzed asynchronously by the Behavioral_Analyzer.

        Args:
            response_data: User's behavioral response payload.

        Returns:
            True if response_data is non-empty, False otherwise.
        """
        return bool(response_data)
