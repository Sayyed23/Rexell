"""
Unit tests for ChallengeValidator.

Tests challenge validation logic including:
- Successful image_selection validation
- Failed image_selection validation
- multi_step challenge validation
- behavioral_confirmation validation
- Attempt tracking and max-attempts enforcement
- Redis block key creation after 3 failures
- Expired and missing challenge handling
- Risk score adjustments

Requirements: 4.4, 4.5, 4.6
"""

import json
import time
from unittest.mock import AsyncMock, MagicMock, call, patch

import pytest

from .challenge_engine import (
    BLOCK_TTL_SECONDS,
    MAX_ATTEMPTS,
    RISK_ADJUSTMENT_FAILURE,
    RISK_ADJUSTMENT_SUCCESS,
    ChallengeExpiredError,
    ChallengeNotFoundError,
    ChallengeValidator,
)
from .models import ChallengeResult
from shared.models.types import ChallengeType


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_image_selection_state(
    challenge_id: str = "test-challenge-id",
    user_hash: str = "user_abc",
    session_id: str = "sess-001",
    correct_indices: list = None,
    attempts: int = 0,
    expires_at: int = None,
    status: str = "pending",
) -> dict:
    """Build a minimal image_selection challenge state dict."""
    if correct_indices is None:
        correct_indices = [0, 1, 2]
    if expires_at is None:
        expires_at = int(time.time()) + 300  # 5 minutes from now

    return {
        "challenge_id": challenge_id,
        "challenge_type": ChallengeType.image_selection.value,
        "content_data": {
            "images": [f"http://minio/img{i}.jpg" for i in range(9)],
            "prompt": "Select all traffic lights",
            "correct_indices": correct_indices,
            "category": "traffic_lights",
        },
        "expires_at": expires_at,
        "session_id": session_id,
        "user_hash": user_hash,
        "attempts": attempts,
        "status": status,
    }


def _make_multi_step_state(
    challenge_id: str = "test-multi-id",
    user_hash: str = "user_xyz",
    session_id: str = "sess-002",
    correct_indices: list = None,
    attempts: int = 0,
    expires_at: int = None,
) -> dict:
    """Build a minimal multi_step challenge state dict."""
    if correct_indices is None:
        correct_indices = [0, 1, 2]
    if expires_at is None:
        expires_at = int(time.time()) + 300

    return {
        "challenge_id": challenge_id,
        "challenge_type": ChallengeType.multi_step.value,
        "content_data": {
            "steps": [
                {
                    "step": 1,
                    "type": ChallengeType.image_selection.value,
                    "images": [f"http://minio/img{i}.jpg" for i in range(9)],
                    "prompt": "Select all traffic lights",
                    "correct_indices": correct_indices,
                    "category": "traffic_lights",
                },
                {
                    "step": 2,
                    "type": ChallengeType.behavioral_confirmation.value,
                    "action": "click_sequence",
                    "parameters": {"sequence_length": 3},
                },
            ]
        },
        "expires_at": expires_at,
        "session_id": session_id,
        "user_hash": user_hash,
        "attempts": attempts,
        "status": "pending",
    }


def _make_validator(state: dict = None) -> tuple:
    """
    Create a ChallengeValidator with a mocked async Redis client.

    Returns:
        (validator, mock_redis)
    """
    mock_redis = AsyncMock()

    if state is not None:
        mock_redis.get = AsyncMock(return_value=json.dumps(state))
    else:
        mock_redis.get = AsyncMock(return_value=None)

    mock_redis.setex = AsyncMock()

    return ChallengeValidator(redis_client=mock_redis), mock_redis


# ---------------------------------------------------------------------------
# ChallengeNotFoundError
# ---------------------------------------------------------------------------


class TestChallengeNotFound:
    """Tests for missing challenge state in Redis."""

    @pytest.mark.asyncio
    async def test_raises_when_challenge_not_in_redis(self):
        """Should raise ChallengeNotFoundError when Redis returns None."""
        validator, _ = _make_validator(state=None)

        with pytest.raises(ChallengeNotFoundError):
            await validator.validate_challenge(
                challenge_id="nonexistent-id",
                response_data={"selected_indices": [0, 1, 2]},
            )


# ---------------------------------------------------------------------------
# ChallengeExpiredError
# ---------------------------------------------------------------------------


class TestChallengeExpired:
    """Tests for expired challenge handling."""

    @pytest.mark.asyncio
    async def test_raises_when_challenge_is_expired(self):
        """Should raise ChallengeExpiredError when expires_at is in the past."""
        expired_state = _make_image_selection_state(
            expires_at=int(time.time()) - 1  # 1 second in the past
        )
        validator, _ = _make_validator(state=expired_state)

        with pytest.raises(ChallengeExpiredError):
            await validator.validate_challenge(
                challenge_id="test-challenge-id",
                response_data={"selected_indices": [0, 1, 2]},
            )


# ---------------------------------------------------------------------------
# image_selection validation
# ---------------------------------------------------------------------------


class TestImageSelectionValidation:
    """Tests for image_selection challenge validation."""

    @pytest.mark.asyncio
    async def test_correct_indices_returns_success(self):
        """Exact match of selected_indices → success result."""
        state = _make_image_selection_state(correct_indices=[0, 1, 2])
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": [0, 1, 2]},
        )

        assert isinstance(result, ChallengeResult)
        assert result.success is True

    @pytest.mark.asyncio
    async def test_correct_indices_in_different_order_returns_success(self):
        """Order of selected_indices should not matter (set equality)."""
        state = _make_image_selection_state(correct_indices=[0, 1, 2])
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": [2, 0, 1]},
        )

        assert result.success is True

    @pytest.mark.asyncio
    async def test_wrong_indices_returns_failure(self):
        """Wrong selected_indices → failure result."""
        state = _make_image_selection_state(correct_indices=[0, 1, 2])
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": [3, 4, 5]},
        )

        assert result.success is False

    @pytest.mark.asyncio
    async def test_partial_correct_indices_returns_failure(self):
        """Partial match (subset) of correct indices → failure."""
        state = _make_image_selection_state(correct_indices=[0, 1, 2])
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": [0, 1]},
        )

        assert result.success is False

    @pytest.mark.asyncio
    async def test_empty_selected_indices_returns_failure(self):
        """Empty selected_indices → failure."""
        state = _make_image_selection_state(correct_indices=[0, 1, 2])
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": []},
        )

        assert result.success is False

    @pytest.mark.asyncio
    async def test_missing_selected_indices_key_returns_failure(self):
        """Missing selected_indices key in response_data → failure."""
        state = _make_image_selection_state(correct_indices=[0, 1, 2])
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={},
        )

        assert result.success is False


# ---------------------------------------------------------------------------
# Risk score adjustments
# ---------------------------------------------------------------------------


class TestRiskScoreAdjustments:
    """Tests for risk score adjustment values (Requirement 4.4)."""

    @pytest.mark.asyncio
    async def test_success_returns_minus_30_adjustment(self):
        """Successful challenge → risk_score_adjustment == -30."""
        state = _make_image_selection_state(correct_indices=[0, 1, 2])
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": [0, 1, 2]},
        )

        assert result.risk_score_adjustment == RISK_ADJUSTMENT_SUCCESS
        assert result.risk_score_adjustment == -30

    @pytest.mark.asyncio
    async def test_failure_returns_plus_10_adjustment(self):
        """Failed challenge → risk_score_adjustment == +10."""
        state = _make_image_selection_state(correct_indices=[0, 1, 2])
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": [5, 6, 7]},
        )

        assert result.risk_score_adjustment == RISK_ADJUSTMENT_FAILURE
        assert result.risk_score_adjustment == 10

    @pytest.mark.asyncio
    async def test_success_returns_zero_remaining_attempts(self):
        """Successful challenge → remaining_attempts == 0."""
        state = _make_image_selection_state(correct_indices=[0, 1, 2])
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": [0, 1, 2]},
        )

        assert result.remaining_attempts == 0

    @pytest.mark.asyncio
    async def test_success_returns_no_blocked_until(self):
        """Successful challenge → blocked_until is None."""
        state = _make_image_selection_state(correct_indices=[0, 1, 2])
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": [0, 1, 2]},
        )

        assert result.blocked_until is None


# ---------------------------------------------------------------------------
# Attempt tracking
# ---------------------------------------------------------------------------


class TestAttemptTracking:
    """Tests for attempt count tracking and remaining attempts (Requirement 4.5)."""

    @pytest.mark.asyncio
    async def test_first_failure_returns_two_remaining_attempts(self):
        """First failure (attempts=0 → 1) → remaining_attempts == 2."""
        state = _make_image_selection_state(correct_indices=[0, 1, 2], attempts=0)
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": [5, 6, 7]},
        )

        assert result.remaining_attempts == 2

    @pytest.mark.asyncio
    async def test_second_failure_returns_one_remaining_attempt(self):
        """Second failure (attempts=1 → 2) → remaining_attempts == 1."""
        state = _make_image_selection_state(correct_indices=[0, 1, 2], attempts=1)
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": [5, 6, 7]},
        )

        assert result.remaining_attempts == 1

    @pytest.mark.asyncio
    async def test_third_failure_returns_zero_remaining_attempts(self):
        """Third failure (attempts=2 → 3) → remaining_attempts == 0."""
        state = _make_image_selection_state(correct_indices=[0, 1, 2], attempts=2)
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": [5, 6, 7]},
        )

        assert result.remaining_attempts == 0

    @pytest.mark.asyncio
    async def test_failure_increments_attempts_in_redis(self):
        """Failure should persist incremented attempt count back to Redis."""
        state = _make_image_selection_state(correct_indices=[0, 1, 2], attempts=0)
        validator, mock_redis = _make_validator(state=state)

        await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": [5, 6, 7]},
        )

        # setex should have been called to persist updated state
        mock_redis.setex.assert_called_once()
        call_args = mock_redis.setex.call_args
        stored_state = json.loads(call_args[0][2])
        assert stored_state["attempts"] == 1

    @pytest.mark.asyncio
    async def test_success_marks_status_completed_in_redis(self):
        """Success should persist status='completed' back to Redis."""
        state = _make_image_selection_state(correct_indices=[0, 1, 2])
        validator, mock_redis = _make_validator(state=state)

        await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": [0, 1, 2]},
        )

        mock_redis.setex.assert_called_once()
        call_args = mock_redis.setex.call_args
        stored_state = json.loads(call_args[0][2])
        assert stored_state["status"] == "completed"


# ---------------------------------------------------------------------------
# Block key after max failures (Requirement 4.5)
# ---------------------------------------------------------------------------


class TestBlockKeyAfterMaxFailures:
    """Tests for Redis block key creation after 3 failures (Requirement 4.5)."""

    @pytest.mark.asyncio
    async def test_third_failure_sets_block_key_in_redis(self):
        """After 3rd failure, block:{user_hash} key should be set in Redis."""
        user_hash = "user_blocked_123"
        state = _make_image_selection_state(
            correct_indices=[0, 1, 2],
            user_hash=user_hash,
            attempts=2,  # This will be the 3rd attempt
        )
        validator, mock_redis = _make_validator(state=state)

        await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": [5, 6, 7]},
        )

        # Verify block key was set
        block_key = f"block:{user_hash}"
        calls = mock_redis.setex.call_args_list
        block_call = next(
            (c for c in calls if c[0][0] == block_key),
            None,
        )
        assert block_call is not None, f"Expected setex call with key '{block_key}'"
        assert block_call[0][1] == BLOCK_TTL_SECONDS  # 900 seconds
        assert block_call[0][2] == "1"

    @pytest.mark.asyncio
    async def test_third_failure_returns_blocked_until_timestamp(self):
        """After 3rd failure, blocked_until should be ~15 minutes from now."""
        state = _make_image_selection_state(
            correct_indices=[0, 1, 2],
            attempts=2,
        )
        validator, _ = _make_validator(state=state)

        before = int(time.time())
        result = await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": [5, 6, 7]},
        )
        after = int(time.time())

        assert result.blocked_until is not None
        assert before + BLOCK_TTL_SECONDS <= result.blocked_until
        assert result.blocked_until <= after + BLOCK_TTL_SECONDS

    @pytest.mark.asyncio
    async def test_first_failure_does_not_set_block_key(self):
        """First failure should NOT set a block key."""
        user_hash = "user_not_blocked"
        state = _make_image_selection_state(
            correct_indices=[0, 1, 2],
            user_hash=user_hash,
            attempts=0,
        )
        validator, mock_redis = _make_validator(state=state)

        await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": [5, 6, 7]},
        )

        block_key = f"block:{user_hash}"
        calls = mock_redis.setex.call_args_list
        block_call = next(
            (c for c in calls if c[0][0] == block_key),
            None,
        )
        assert block_call is None, "Block key should NOT be set on first failure"

    @pytest.mark.asyncio
    async def test_second_failure_does_not_set_block_key(self):
        """Second failure should NOT set a block key."""
        user_hash = "user_not_blocked_yet"
        state = _make_image_selection_state(
            correct_indices=[0, 1, 2],
            user_hash=user_hash,
            attempts=1,
        )
        validator, mock_redis = _make_validator(state=state)

        await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": [5, 6, 7]},
        )

        block_key = f"block:{user_hash}"
        calls = mock_redis.setex.call_args_list
        block_call = next(
            (c for c in calls if c[0][0] == block_key),
            None,
        )
        assert block_call is None

    @pytest.mark.asyncio
    async def test_first_failure_returns_no_blocked_until(self):
        """First failure → blocked_until is None."""
        state = _make_image_selection_state(correct_indices=[0, 1, 2], attempts=0)
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": [5, 6, 7]},
        )

        assert result.blocked_until is None

    @pytest.mark.asyncio
    async def test_block_ttl_is_900_seconds(self):
        """Block TTL should be exactly 900 seconds (15 minutes)."""
        assert BLOCK_TTL_SECONDS == 900


# ---------------------------------------------------------------------------
# multi_step validation
# ---------------------------------------------------------------------------


class TestMultiStepValidation:
    """Tests for multi_step challenge validation."""

    @pytest.mark.asyncio
    async def test_correct_step1_and_nonempty_step2_returns_success(self):
        """Both steps correct → success."""
        state = _make_multi_step_state(correct_indices=[0, 1, 2])
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-multi-id",
            response_data={
                "step_responses": [
                    {"selected_indices": [0, 1, 2]},
                    {"action_data": {"clicks": [1, 2, 3]}},
                ]
            },
        )

        assert result.success is True

    @pytest.mark.asyncio
    async def test_wrong_step1_indices_returns_failure(self):
        """Wrong image selection in step 1 → failure."""
        state = _make_multi_step_state(correct_indices=[0, 1, 2])
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-multi-id",
            response_data={
                "step_responses": [
                    {"selected_indices": [3, 4, 5]},
                    {"action_data": {"clicks": [1, 2, 3]}},
                ]
            },
        )

        assert result.success is False

    @pytest.mark.asyncio
    async def test_empty_step2_behavioral_returns_failure(self):
        """Empty behavioral response in step 2 → failure."""
        state = _make_multi_step_state(correct_indices=[0, 1, 2])
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-multi-id",
            response_data={
                "step_responses": [
                    {"selected_indices": [0, 1, 2]},
                    {},  # empty behavioral response
                ]
            },
        )

        assert result.success is False

    @pytest.mark.asyncio
    async def test_empty_step_responses_returns_failure(self):
        """Empty step_responses list → failure."""
        state = _make_multi_step_state(correct_indices=[0, 1, 2])
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-multi-id",
            response_data={"step_responses": []},
        )

        assert result.success is False

    @pytest.mark.asyncio
    async def test_missing_step_responses_key_returns_failure(self):
        """Missing step_responses key → failure."""
        state = _make_multi_step_state(correct_indices=[0, 1, 2])
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-multi-id",
            response_data={},
        )

        assert result.success is False

    @pytest.mark.asyncio
    async def test_step1_order_independent_matching(self):
        """Step 1 image selection should use set equality (order-independent)."""
        state = _make_multi_step_state(correct_indices=[0, 1, 2])
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="test-multi-id",
            response_data={
                "step_responses": [
                    {"selected_indices": [2, 1, 0]},
                    {"action_data": {"clicks": [1, 2, 3]}},
                ]
            },
        )

        assert result.success is True


# ---------------------------------------------------------------------------
# behavioral_confirmation validation
# ---------------------------------------------------------------------------


class TestBehavioralConfirmationValidation:
    """Tests for behavioral_confirmation challenge type."""

    @pytest.mark.asyncio
    async def test_nonempty_response_returns_success(self):
        """Any non-empty response to behavioral_confirmation → success."""
        state = {
            "challenge_id": "behav-id",
            "challenge_type": ChallengeType.behavioral_confirmation.value,
            "content_data": {"action": "click_sequence"},
            "expires_at": int(time.time()) + 300,
            "session_id": "sess-003",
            "user_hash": "user_behav",
            "attempts": 0,
            "status": "pending",
        }
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="behav-id",
            response_data={"action_data": {"clicks": [1, 2, 3]}},
        )

        assert result.success is True

    @pytest.mark.asyncio
    async def test_empty_response_returns_failure(self):
        """Empty response to behavioral_confirmation → failure."""
        state = {
            "challenge_id": "behav-id",
            "challenge_type": ChallengeType.behavioral_confirmation.value,
            "content_data": {"action": "click_sequence"},
            "expires_at": int(time.time()) + 300,
            "session_id": "sess-003",
            "user_hash": "user_behav",
            "attempts": 0,
            "status": "pending",
        }
        validator, _ = _make_validator(state=state)

        result = await validator.validate_challenge(
            challenge_id="behav-id",
            response_data={},
        )

        assert result.success is False


# ---------------------------------------------------------------------------
# Redis key patterns
# ---------------------------------------------------------------------------


class TestRedisKeyPatterns:
    """Tests for correct Redis key usage."""

    @pytest.mark.asyncio
    async def test_challenge_state_retrieved_with_correct_key(self):
        """Redis.get should be called with 'challenge:{challenge_id}'."""
        state = _make_image_selection_state(challenge_id="my-challenge-uuid")
        validator, mock_redis = _make_validator(state=state)

        await validator.validate_challenge(
            challenge_id="my-challenge-uuid",
            response_data={"selected_indices": [0, 1, 2]},
        )

        mock_redis.get.assert_called_once_with("challenge:my-challenge-uuid")

    @pytest.mark.asyncio
    async def test_block_key_uses_correct_pattern(self):
        """Block key should follow 'block:{user_hash}' pattern."""
        user_hash = "hashed_wallet_address"
        state = _make_image_selection_state(
            user_hash=user_hash,
            correct_indices=[0, 1, 2],
            attempts=2,
        )
        validator, mock_redis = _make_validator(state=state)

        await validator.validate_challenge(
            challenge_id="test-challenge-id",
            response_data={"selected_indices": [5, 6, 7]},
        )

        expected_block_key = f"block:{user_hash}"
        calls = mock_redis.setex.call_args_list
        keys_used = [c[0][0] for c in calls]
        assert expected_block_key in keys_used
