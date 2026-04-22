"""
Unit tests for Challenge Engine generation logic.

Tests challenge type selection, content building, Redis state storage,
and the full generate_challenge flow.

Requirements: 4.2, 4.3
"""

import json
import uuid
from typing import List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from .challenge_engine import (
    CHALLENGE_REDIS_TTL_SECONDS,
    CHALLENGE_SCORE_HIGH,
    CHALLENGE_SCORE_LOW,
    CHALLENGE_SCORE_MID,
    IMAGE_SELECTION_CORRECT_COUNT,
    IMAGE_SELECTION_TOTAL_IMAGES,
    ChallengeGenerator,
    MinIOImageLoader,
    select_challenge_type,
)
from .models import Challenge, ChallengeContent
from shared.models.types import ChallengeType


# ---------------------------------------------------------------------------
# select_challenge_type tests
# ---------------------------------------------------------------------------


class TestSelectChallengeType:
    """Tests for the challenge type selection function (Requirements 4.2, 4.3)."""

    def test_score_at_lower_boundary_returns_image_selection(self):
        """Score exactly 50 → image_selection (Requirement 4.2)."""
        assert select_challenge_type(50) == ChallengeType.image_selection

    def test_score_at_mid_boundary_returns_image_selection(self):
        """Score exactly 65 → image_selection (upper bound of 4.2 range)."""
        assert select_challenge_type(65) == ChallengeType.image_selection

    def test_score_just_above_mid_returns_multi_step(self):
        """Score 65.1 → multi_step (Requirement 4.3)."""
        assert select_challenge_type(65.1) == ChallengeType.multi_step

    def test_score_at_upper_boundary_returns_multi_step(self):
        """Score exactly 80 → multi_step (Requirement 4.3)."""
        assert select_challenge_type(80) == ChallengeType.multi_step

    def test_score_in_image_selection_range(self):
        """Score 57 (mid of 50–65) → image_selection."""
        assert select_challenge_type(57) == ChallengeType.image_selection

    def test_score_in_multi_step_range(self):
        """Score 72 (mid of 65–80) → multi_step."""
        assert select_challenge_type(72) == ChallengeType.multi_step

    def test_score_below_challenge_range_raises(self):
        """Score below 50 is not a challenge score → ValueError."""
        with pytest.raises(ValueError, match="outside the challenge range"):
            select_challenge_type(49)

    def test_score_above_challenge_range_raises(self):
        """Score above 80 is a block score → ValueError."""
        with pytest.raises(ValueError, match="outside the challenge range"):
            select_challenge_type(81)

    def test_score_zero_raises(self):
        """Score 0 is an allow score → ValueError."""
        with pytest.raises(ValueError):
            select_challenge_type(0)

    def test_score_100_raises(self):
        """Score 100 is a block score → ValueError."""
        with pytest.raises(ValueError):
            select_challenge_type(100)


# ---------------------------------------------------------------------------
# MinIOImageLoader tests
# ---------------------------------------------------------------------------


class TestMinIOImageLoader:
    """Tests for MinIO image loading."""

    def _make_loader(self, object_names: List[str]) -> MinIOImageLoader:
        """Create a MinIOImageLoader with a mocked MinIO client."""
        mock_client = MagicMock()
        mock_objects = [MagicMock(object_name=name) for name in object_names]
        mock_client.list_objects.return_value = iter(mock_objects)
        return MinIOImageLoader(
            minio_client=mock_client,
            endpoint_url="http://minio:9000",
        )

    def test_get_image_url_constructs_correct_url(self):
        """Image URL should combine endpoint, bucket, and object name."""
        loader = self._make_loader([])
        url = loader.get_image_url("images/traffic_lights/img1.jpg")
        assert url == "http://minio:9000/challenge-content/images/traffic_lights/img1.jpg"

    def test_load_images_returns_correct_count_when_enough_available(self):
        """Should return exactly `total` URLs when MinIO has enough images."""
        names = [f"images/traffic_lights/img{i}.jpg" for i in range(15)]
        loader = self._make_loader(names)
        urls = loader.load_images_for_challenge("traffic_lights", total=9)
        assert len(urls) == 9

    def test_load_images_pads_with_placeholders_when_insufficient(self):
        """Should pad with placeholder URLs when MinIO has fewer images than needed."""
        names = ["images/traffic_lights/img0.jpg", "images/traffic_lights/img1.jpg"]
        loader = self._make_loader(names)
        urls = loader.load_images_for_challenge("traffic_lights", total=9)
        assert len(urls) == 9
        # First two should be real URLs
        assert "img0.jpg" in urls[0]
        assert "img1.jpg" in urls[1]

    def test_load_images_returns_all_placeholders_when_minio_empty(self):
        """Should return all placeholder URLs when MinIO returns no objects."""
        loader = self._make_loader([])
        urls = loader.load_images_for_challenge("traffic_lights", total=9)
        assert len(urls) == 9
        assert all("placeholder" in url for url in urls)

    def test_load_images_handles_s3_error_gracefully(self):
        """Should return placeholder URLs when MinIO raises S3Error."""
        from minio.error import S3Error

        mock_client = MagicMock()
        mock_client.list_objects.side_effect = S3Error(
            code="NoSuchBucket",
            message="bucket not found",
            resource="challenge-content",
            request_id="test",
            host_id="test",
            response=MagicMock(status=404, headers={}, text=""),
        )
        loader = MinIOImageLoader(
            minio_client=mock_client,
            endpoint_url="http://minio:9000",
        )
        urls = loader.load_images_for_challenge("traffic_lights", total=9)
        assert len(urls) == 9


# ---------------------------------------------------------------------------
# ChallengeGenerator tests
# ---------------------------------------------------------------------------


class TestChallengeGenerator:
    """Tests for the ChallengeGenerator class."""

    def _make_generator(self, image_names: List[str] = None) -> ChallengeGenerator:
        """Create a ChallengeGenerator with mocked dependencies."""
        if image_names is None:
            image_names = [f"images/traffic_lights/img{i}.jpg" for i in range(15)]

        mock_redis = AsyncMock()
        mock_redis.setex = AsyncMock()

        mock_minio = MagicMock()
        mock_objects = [MagicMock(object_name=name) for name in image_names]
        # Return a fresh iterator on every call so multiple generate_challenge
        # invocations each receive a full image list.
        mock_minio.list_objects.side_effect = lambda *args, **kwargs: iter(
            [MagicMock(object_name=name) for name in image_names]
        )

        image_loader = MinIOImageLoader(
            minio_client=mock_minio,
            endpoint_url="http://minio:9000",
        )

        return ChallengeGenerator(
            redis_client=mock_redis,
            image_loader=image_loader,
        ), mock_redis

    @pytest.mark.asyncio
    async def test_generate_challenge_returns_challenge_model(self):
        """generate_challenge should return a Challenge instance."""
        generator, _ = self._make_generator()
        challenge = await generator.generate_challenge(
            risk_score=55,
            session_id="sess-001",
            user_hash="abc123",
        )
        assert isinstance(challenge, Challenge)

    @pytest.mark.asyncio
    async def test_generate_challenge_assigns_unique_uuid(self):
        """Each generated challenge should have a unique UUID."""
        generator, _ = self._make_generator()
        c1 = await generator.generate_challenge(55, "sess-001", "user1")
        c2 = await generator.generate_challenge(55, "sess-002", "user2")
        assert c1.challenge_id != c2.challenge_id

    @pytest.mark.asyncio
    async def test_generate_challenge_image_selection_for_score_50(self):
        """Score 50 → image_selection challenge type."""
        generator, _ = self._make_generator()
        challenge = await generator.generate_challenge(50, "sess-001", "user1")
        assert challenge.type == ChallengeType.image_selection

    @pytest.mark.asyncio
    async def test_generate_challenge_image_selection_for_score_65(self):
        """Score 65 → image_selection challenge type."""
        generator, _ = self._make_generator()
        challenge = await generator.generate_challenge(65, "sess-001", "user1")
        assert challenge.type == ChallengeType.image_selection

    @pytest.mark.asyncio
    async def test_generate_challenge_multi_step_for_score_66(self):
        """Score 66 → multi_step challenge type."""
        generator, _ = self._make_generator()
        challenge = await generator.generate_challenge(66, "sess-001", "user1")
        assert challenge.type == ChallengeType.multi_step

    @pytest.mark.asyncio
    async def test_generate_challenge_multi_step_for_score_80(self):
        """Score 80 → multi_step challenge type."""
        generator, _ = self._make_generator()
        challenge = await generator.generate_challenge(80, "sess-001", "user1")
        assert challenge.type == ChallengeType.multi_step

    @pytest.mark.asyncio
    async def test_generate_challenge_sets_expiration(self):
        """Challenge expires_at should be approximately now + 300 seconds."""
        import time

        generator, _ = self._make_generator()
        before = int(time.time())
        challenge = await generator.generate_challenge(55, "sess-001", "user1")
        after = int(time.time())

        assert before + CHALLENGE_REDIS_TTL_SECONDS <= challenge.expires_at
        assert challenge.expires_at <= after + CHALLENGE_REDIS_TTL_SECONDS

    @pytest.mark.asyncio
    async def test_generate_challenge_sets_max_attempts_to_3(self):
        """Challenge max_attempts should default to 3."""
        generator, _ = self._make_generator()
        challenge = await generator.generate_challenge(55, "sess-001", "user1")
        assert challenge.max_attempts == 3

    @pytest.mark.asyncio
    async def test_generate_challenge_stores_state_in_redis(self):
        """Challenge state should be stored in Redis with correct key and TTL."""
        generator, mock_redis = self._make_generator()
        challenge = await generator.generate_challenge(55, "sess-001", "user1")

        expected_key = f"challenge:{challenge.challenge_id}"
        mock_redis.setex.assert_called_once()
        call_args = mock_redis.setex.call_args
        assert call_args[0][0] == expected_key
        assert call_args[0][1] == CHALLENGE_REDIS_TTL_SECONDS

    @pytest.mark.asyncio
    async def test_generate_challenge_redis_state_contains_required_fields(self):
        """Redis state should contain all required fields for validation."""
        generator, mock_redis = self._make_generator()
        challenge = await generator.generate_challenge(55, "sess-001", "user_abc")

        call_args = mock_redis.setex.call_args
        stored_json = call_args[0][2]
        state = json.loads(stored_json)

        assert state["challenge_id"] == str(challenge.challenge_id)
        assert state["challenge_type"] == challenge.type.value
        assert state["session_id"] == "sess-001"
        assert state["user_hash"] == "user_abc"
        assert state["attempts"] == 0
        assert state["status"] == "pending"
        assert "expires_at" in state
        assert "content_data" in state

    @pytest.mark.asyncio
    async def test_generate_challenge_image_selection_content_has_images(self):
        """image_selection challenge content should include image URLs."""
        generator, _ = self._make_generator()
        challenge = await generator.generate_challenge(55, "sess-001", "user1")

        assert challenge.type == ChallengeType.image_selection
        assert "images" in challenge.content.data
        assert len(challenge.content.data["images"]) == IMAGE_SELECTION_TOTAL_IMAGES

    @pytest.mark.asyncio
    async def test_generate_challenge_image_selection_content_has_prompt(self):
        """image_selection challenge content should include a prompt string."""
        generator, _ = self._make_generator()
        challenge = await generator.generate_challenge(55, "sess-001", "user1")

        assert "prompt" in challenge.content.data
        assert isinstance(challenge.content.data["prompt"], str)
        assert len(challenge.content.data["prompt"]) > 0

    @pytest.mark.asyncio
    async def test_generate_challenge_image_selection_content_has_correct_indices(self):
        """image_selection challenge content should include correct_indices for server-side validation."""
        generator, _ = self._make_generator()
        challenge = await generator.generate_challenge(55, "sess-001", "user1")

        assert "correct_indices" in challenge.content.data
        assert len(challenge.content.data["correct_indices"]) == IMAGE_SELECTION_CORRECT_COUNT

    @pytest.mark.asyncio
    async def test_generate_challenge_multi_step_content_has_steps(self):
        """multi_step challenge content should include a steps list."""
        generator, _ = self._make_generator()
        challenge = await generator.generate_challenge(70, "sess-001", "user1")

        assert challenge.type == ChallengeType.multi_step
        assert "steps" in challenge.content.data
        assert len(challenge.content.data["steps"]) == 2

    @pytest.mark.asyncio
    async def test_generate_challenge_multi_step_first_step_is_image_selection(self):
        """multi_step challenge step 1 should be image_selection."""
        generator, _ = self._make_generator()
        challenge = await generator.generate_challenge(70, "sess-001", "user1")

        step1 = challenge.content.data["steps"][0]
        assert step1["type"] == ChallengeType.image_selection.value
        assert "images" in step1

    @pytest.mark.asyncio
    async def test_generate_challenge_multi_step_second_step_is_behavioral(self):
        """multi_step challenge step 2 should be behavioral_confirmation."""
        generator, _ = self._make_generator()
        challenge = await generator.generate_challenge(70, "sess-001", "user1")

        step2 = challenge.content.data["steps"][1]
        assert step2["type"] == ChallengeType.behavioral_confirmation.value

    @pytest.mark.asyncio
    async def test_generate_challenge_raises_for_out_of_range_score(self):
        """generate_challenge should raise ValueError for scores outside [50, 80]."""
        generator, _ = self._make_generator()
        with pytest.raises(ValueError):
            await generator.generate_challenge(49, "sess-001", "user1")

        with pytest.raises(ValueError):
            await generator.generate_challenge(81, "sess-001", "user1")
