# Implementation Plan: Rexell AI Bot Detection Integration (Cloud-Agnostic)

## Overview

This implementation plan breaks down the cloud-agnostic AI-powered bot detection system into discrete coding tasks. The system uses containerized Python/FastAPI microservices, PostgreSQL, Redis, RabbitMQ, MinIO, and open-source ML frameworks (scikit-learn/XGBoost) orchestrated with Docker Compose (dev) and Kubernetes (production).

The implementation follows a phased approach: project foundation and data layer, core detection services, ML model development, frontend SDK, smart contract integration, monitoring, and testing infrastructure.

## Tasks

- [x] 1. Set up project structure and core interfaces
  - Create monorepo directory structure: `services/detection`, `services/challenge`, `services/training`, `sdk/`, `k8s/`, `docker/`
  - Define shared Python Pydantic models and TypeScript interfaces for BehavioralData, FeatureVector, DetectionRequest/Response, VerificationToken
  - Set up Docker Compose for local development (PostgreSQL, Redis, RabbitMQ, MinIO)
  - Configure pytest (Python) and Jest (TypeScript SDK) test frameworks with Hypothesis and fast-check for property tests
  - _Requirements: 1.1, 7.1_


- [x] 2. Implement PostgreSQL data layer
  - [x] 2.1 Create database schema migrations
    - Write Alembic migrations for all tables: behavioral_data, risk_scores, verification_tokens, user_reputation, challenge_state, audit_log
    - Add indexes, TTL-equivalent expires_at columns, and constraints per the schema in the design document
    - _Requirements: 2.6, 9.2, 11.2_

  - [x] 2.2 Implement data access layer (Python)
    - Create async SQLAlchemy repository classes for each table
    - Implement CRUD operations with connection pooling (asyncpg)
    - Add wallet address hashing (SHA-256 + salt) utility
    - Implement expires_at calculation utilities (90-day TTL for behavioral_data)
    - _Requirements: 2.6, 9.1, 11.2_

  - [ ]* 2.3 Write property test for data retention TTL
    - **Property 7: Data Retention TTL** — for any behavioral data record, expires_at SHALL be exactly 90 days from created_at
    - **Validates: Requirements 2.6**

  - [ ]* 2.4 Write unit tests for data access layer
    - Test CRUD operations with test database
    - Test wallet address hashing produces consistent, anonymized output
    - Test TTL calculation correctness
    - _Requirements: 2.6, 9.1_


- [x] 3. Implement Behavioral Analyzer component
  - [x] 3.1 Create behavioral data types and validation
    - Define Pydantic models for BehavioralData, MouseEvent, KeystrokeEvent, NavigationEvent
    - Implement field-level validation with descriptive error messages
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Implement feature extraction algorithms
    - Extract mouse velocity statistics (mean, std, acceleration) using NumPy
    - Calculate mouse curvature and click frequency
    - Extract keystroke timing features (flight time mean/std, dwell time mean)
    - Calculate navigation entropy and dwell time distribution
    - Normalize all features to [0, 1] range for ML model input
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 3.3 Write property test for behavioral data completeness
    - **Property 5: Behavioral Data Completeness** — for any behavioral data transmission, keystroke events SHALL include pressTime and inter-key intervals; navigation events SHALL include fromPage, toPage, and dwellTime
    - **Validates: Requirements 2.2, 2.3**

  - [ ]* 3.4 Write property test for mouse movement sampling rate
    - **Property 4: Mouse Movement Sampling Rate** — for any session lasting at least 1 second, the Behavioral_Analyzer SHALL collect at least 10 mouse movement samples per second during active interaction
    - **Validates: Requirements 2.1**

  - [ ]* 3.5 Write unit tests for feature extraction
    - Test with known bot patterns (linear movement, constant velocity)
    - Test with known human patterns (natural curves, variable timing)
    - Test edge cases: empty data, single event, 10,000+ events
    - _Requirements: 2.1, 2.2, 2.3_


- [ ] 4. Implement Risk Scorer component
  - [ ] 4.1 Create risk scoring interfaces and types
    - Define Pydantic models for RiskContext, RiskScore, RiskFactor, ReputationScore
    - Define decision threshold constants: allow (<50), challenge (50–80), block (>80)
    - _Requirements: 1.2, 1.3, 1.4_

  - [ ] 4.2 Implement ML Inference Service HTTP client
    - Create async HTTP client for ML Inference Service (TorchServe/Triton REST API at POST /predictions)
    - Implement circuit breaker pattern (5 consecutive failures → open for 60 seconds → half-open probe)
    - Add retry logic with exponential backoff using tenacity library
    - Implement rule-based fallback scoring when ML service is unavailable (conservative thresholds: challenge at 40)
    - _Requirements: 1.1, 3.4_

  - [ ] 4.3 Implement reputation scoring system
    - Calculate reputation score from transaction history in PostgreSQL user_reputation table
    - Cache reputation scores in Redis with 5-minute TTL using key pattern `reputation:{user_hash}`
    - Implement trusted status logic: assign after 30 days of consistent human-like behavior
    - Apply reputation adjustments to final risk scores
    - _Requirements: 6.3, 6.4_

  - [ ] 4.4 Implement final risk score calculation and decision logic
    - Combine ML model score with contextual signals (account age, transaction history, recent failures)
    - Apply 1.5x multiplier for bulk ticket purchases (buyTickets)
    - Calculate risk factors with contribution values
    - Determine decision based on thresholds (allow/challenge/block)
    - _Requirements: 1.2, 1.3, 1.4, 5.1_

  - [ ]* 4.5 Write property test for risk score decision thresholds
    - **Property 2: Risk Score Decision Thresholds** — for any risk score, return 'block' when >80, 'challenge' when 50–80, 'allow' with token when <50
    - **Validates: Requirements 1.2, 1.3, 1.4**

  - [ ]* 4.6 Write property test for resale risk scoring factors
    - **Property 20: Resale Risk Scoring Factors** — for any resale request, the Risk_Scorer SHALL include account age, transaction history, and behavioral consistency as scoring factors
    - **Validates: Requirements 6.3**

  - [ ]* 4.7 Write unit tests for risk scorer
    - Test decision thresholds at boundaries (49, 50, 80, 81)
    - Test circuit breaker behavior and fallback scoring
    - Test reputation caching and cache invalidation
    - _Requirements: 1.2, 1.3, 1.4, 6.3_


- [ ] 5. Implement Challenge Engine component
  - [ ] 5.1 Create challenge types and Pydantic models
    - Define Challenge, ChallengeContent, ChallengeResponse, ChallengeResult models
    - Define ChallengeType enum: image_selection, behavioral_confirmation, multi_step
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 5.2 Implement challenge generation logic
    - Select challenge type based on risk score: image_selection for 50–65, multi_step for 65–80
    - Load challenge images from MinIO challenge-content bucket
    - Store challenge state in Redis with 5-minute TTL using key `challenge:{challenge_id}`
    - Return challenge with unique UUID, type, content, and expiration
    - _Requirements: 4.2, 4.3_

  - [ ] 5.3 Implement challenge validation logic
    - Retrieve challenge state from Redis by challenge_id
    - Validate user response against encrypted correct answer
    - Track attempt count and enforce max 3 attempts per session
    - Apply risk score adjustment: −30 on success, +10 on failure
    - Set Redis block key `block:{user_hash}` with 15-minute TTL after 3 failures
    - _Requirements: 4.4, 4.5, 4.6_

  - [ ]* 5.4 Write property test for challenge type selection
    - **Property 10: Challenge Type Selection** — for any risk score requiring a challenge, image_selection for 50–65, multi_step for 65–80
    - **Validates: Requirements 4.2, 4.3**

  - [ ]* 5.5 Write property test for challenge success risk reduction
    - **Property 11: Challenge Success Risk Reduction** — for any successfully completed challenge, the user's risk score SHALL be reduced by exactly 30 points
    - **Validates: Requirements 4.4**

  - [ ]* 5.6 Write property test for challenge failure blocking
    - **Property 12: Challenge Failure Blocking** — for any session with 3 challenge failures, further purchase attempts SHALL be blocked for exactly 15 minutes
    - **Validates: Requirements 4.5**

  - [ ]* 5.7 Write property test for challenge validation latency
    - **Property 13: Challenge Validation Latency** — for any challenge response submission, validation SHALL complete within 100 milliseconds
    - **Validates: Requirements 4.6**

  - [ ]* 5.8 Write unit tests for challenge engine
    - Test challenge type selection at score boundaries (50, 65, 80)
    - Test challenge expiration handling
    - Test max attempts enforcement and 15-minute cooldown
    - _Requirements: 4.2, 4.3, 4.4, 4.5_


- [ ] 6. Implement verification token system
  - [ ] 6.1 Create token generation functions
    - Generate UUID v4 for token_id
    - Create token payload with wallet_address, event_id, max_quantity, issued_at, expires_at (5 minutes)
    - Calculate HMAC-SHA256 signature using signing key from environment secret
    - Encode token as base64 string
    - Store token in PostgreSQL verification_tokens table
    - _Requirements: 5.4, 5.5_

  - [ ] 6.2 Implement token validation functions
    - Decode base64 token and parse JSON payload
    - Verify HMAC signature matches
    - Check expiration (5 minutes from issuance)
    - Verify wallet address matches request
    - Check token not already consumed
    - _Requirements: 5.3, 5.6_

  - [ ] 6.3 Implement token consumption tracking
    - Mark token as consumed in PostgreSQL with consumed_at timestamp and tx_hash
    - Prevent reuse of consumed tokens
    - _Requirements: 5.6_

  - [ ]* 6.4 Write property test for token structure and validity
    - **Property 16: Token Structure and Validity** — for any generated token, it SHALL include walletAddress, timestamp, cryptographic signature, and expiresAt set to exactly 5 minutes from issuedAt
    - **Validates: Requirements 5.4, 5.5**

  - [ ]* 6.5 Write property test for token consumption prevention
    - **Property 17: Token Consumption Prevention** — for any token used in a successful transaction, it SHALL be marked consumed and SHALL NOT be accepted for subsequent transactions
    - **Validates: Requirements 5.6**

  - [ ]* 6.6 Write property test for invalid token rejection
    - **Property 15: Invalid Token Rejection** — for any transaction with invalid or expired token, the Rexell_Platform SHALL reject the transaction and return an error message
    - **Validates: Requirements 5.3**

  - [ ]* 6.7 Write unit tests for token system
    - Test token generation with all required fields
    - Test signature validation with tampered tokens
    - Test expiration enforcement
    - Test consumption tracking and double-consumption prevention
    - _Requirements: 5.3, 5.4, 5.5, 5.6_


- [ ] 7. Implement Detection Service (FastAPI)
  - [ ] 7.1 Create FastAPI app and routing
    - Set up FastAPI application with lifespan context manager (DB pool, Redis connection)
    - Implement POST /v1/detect endpoint with Pydantic request validation
    - Configure API key authentication middleware (header-based)
    - Configure Redis-based sliding window rate limiting middleware (100 req/s per key, burst 200)
    - _Requirements: 1.1, 7.1, 7.2_

  - [ ] 7.2 Implement bot detection orchestration handler
    - Validate incoming behavioral data
    - Query user history from PostgreSQL (cache miss) or Redis (cache hit)
    - Extract features using Behavioral_Analyzer
    - Calculate risk score using Risk_Scorer
    - Generate verification token for low-risk users (score <50)
    - Return challenge type and challenge_id for medium-risk users (50–80)
    - Block high-risk users (score >80) and log the event
    - Store risk score and decision in PostgreSQL risk_scores table
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 7.3 Implement structured logging
    - Log all detection events with severity level, risk score, decision, session_id, user_hash
    - Anonymize wallet addresses in logs (use user_hash, never raw address)
    - Add correlation IDs for distributed request tracing
    - _Requirements: 1.5, 8.1, 9.4_

  - [ ] 7.4 Implement error handling and fallback
    - Add exception handlers for all error categories (400, 401, 403, 429, 500, 503, 504)
    - Handle ML service unavailability with rule-based scoring fallback
    - Return structured error bodies with error_code and message
    - _Requirements: 10.1_

  - [ ]* 7.5 Write property test for detection latency
    - **Property 1: Detection Latency** — for any ticket purchase request with valid behavioral data, analysis SHALL complete within 200 milliseconds
    - **Validates: Requirements 1.1**

  - [ ]* 7.6 Write property test for blocked request logging
    - **Property 3: Blocked Request Logging** — for any blocked purchase request, a log entry SHALL be created containing risk score, decision, and behavioral indicators
    - **Validates: Requirements 1.5**

  - [ ]* 7.7 Write property test for detection event logging
    - **Property 25: Detection Event Logging** — for any bot detection analysis, a log entry SHALL be created with severity level, risk score, and decision
    - **Validates: Requirements 8.1**

  - [ ]* 7.8 Write unit tests for Detection Service
    - Test request validation with invalid/missing fields
    - Test low/medium/high risk score flows end-to-end
    - Test error handling for database and ML service failures
    - Test rate limiting enforcement at boundary
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_


- [ ] 8. Implement Challenge Service (FastAPI)
  - [ ] 8.1 Create FastAPI app for challenge operations
    - Set up FastAPI application with POST /v1/verify-challenge endpoint
    - Add Pydantic request validation and API key authentication
    - _Requirements: 4.1, 4.6_

  - [ ] 8.2 Implement challenge verification flow
    - Retrieve challenge state from Redis by challenge_id
    - Validate challenge response against correct answer
    - Update attempt count in Redis and PostgreSQL challenge_state
    - Apply risk score adjustments (−30 success, +10 failure)
    - Generate verification token on successful completion
    - Enforce 15-minute cooldown on max failures (3 attempts)
    - _Requirements: 4.4, 4.5, 4.6_

  - [ ]* 8.3 Write unit tests for Challenge Service
    - Test successful challenge completion and token issuance
    - Test failed challenge attempts and max attempts enforcement
    - Test expired challenge handling
    - _Requirements: 4.4, 4.5, 4.6_

- [ ] 9. Implement token validation, consumption, and health endpoints
  - [ ] 9.1 Add token and health endpoints to Detection Service
    - Implement POST /v1/validate-token endpoint (validates signature, expiry, wallet match)
    - Implement POST /v1/consume-token endpoint (marks token consumed with tx_hash)
    - Implement GET /v1/health endpoint checking PostgreSQL, Redis, and ML Inference Service status
    - Health check response SHALL return within 50 milliseconds
    - _Requirements: 5.2, 5.3, 5.6, 10.4_

  - [ ]* 9.2 Write property test for token request before purchase
    - **Property 14: Token Request Before Purchase** — for any buyTicket or buyTickets call, the Rexell_Platform SHALL request a Verification_Token before executing the transaction
    - **Validates: Requirements 5.1**

  - [ ]* 9.3 Write property test for health check latency
    - **Property 37: Health Check Latency** — for any health check request, the response SHALL be returned within 50 milliseconds
    - **Validates: Requirements 10.4**

  - [ ]* 9.4 Write unit tests for token and health endpoints
    - Test validation with valid, invalid, expired, and consumed tokens
    - Test consumption tracking and double-consumption prevention
    - Test health check response format and dependent service status reporting
    - _Requirements: 5.2, 5.3, 5.6, 10.4_

- [ ] 10. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 11. Implement resale detection logic
  - [ ] 11.1 Create resale pattern analyzer
    - Track resale request frequency per user_hash using Redis sorted sets
    - Detect multiple requests within 60-second window and flag account
    - Write flag to PostgreSQL user_reputation table
    - Require additional verification for all subsequent resale requests from flagged accounts
    - _Requirements: 6.1, 6.2_

  - [ ] 11.2 Implement trusted status management
    - Calculate behavioral consistency score over 30 days from PostgreSQL risk_scores history
    - Assign trusted_status=true in user_reputation when threshold met
    - Monitor trusted users for behavioral anomalies exceeding anomaly threshold
    - Revoke trusted status and reinstate full verification on anomaly detection
    - _Requirements: 6.4, 6.5_

  - [ ]* 11.3 Write property test for rapid resale request flagging
    - **Property 18: Rapid Resale Request Flagging** — for any reseller account, when multiple resale requests are submitted within 60 seconds, the account SHALL be flagged for review
    - **Validates: Requirements 6.1**

  - [ ]* 11.4 Write property test for flagged account verification
    - **Property 19: Flagged Account Verification** — for any flagged reseller account, all subsequent resale requests SHALL require additional verification before approval
    - **Validates: Requirements 6.2**

  - [ ]* 11.5 Write property test for trusted status acquisition
    - **Property 21: Trusted Status Acquisition** — for any reseller demonstrating consistent human-like behavior for 30 consecutive days, the Bot_Detection_Service SHALL assign trusted status
    - **Validates: Requirements 6.4**

  - [ ]* 11.6 Write property test for trusted status revocation
    - **Property 22: Trusted Status Revocation** — for any trusted reseller exhibiting behavioral anomalies exceeding the threshold, trusted status SHALL be revoked and full verification reinstated
    - **Validates: Requirements 6.5**

  - [ ]* 11.7 Write unit tests for resale detection
    - Test rapid request detection with time window edge cases (59s vs 61s)
    - Test trusted status calculation and revocation logic
    - _Requirements: 6.1, 6.2, 6.4, 6.5_


- [ ] 12. Implement fallback mode logic
  - [ ] 12.1 Create fallback mode controller
    - Poll health check endpoint on configurable interval
    - Activate fallback mode by setting Redis key `fallback:active` when health check fails
    - Implement basic rate limiting in fallback mode: 2 tickets per wallet per event using Redis counters
    - Deactivate fallback mode and resume normal operations within 60 seconds of health check success
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ]* 12.2 Write property test for fallback mode activation
    - **Property 34: Fallback Mode Activation** — for any period when the Bot_Detection_Service health check fails, the Rexell_Platform SHALL activate fallback mode with basic rate limiting
    - **Validates: Requirements 10.1**

  - [ ]* 12.3 Write property test for fallback mode purchase limits
    - **Property 35: Fallback Mode Purchase Limits** — for any purchase request in fallback mode, the Rexell_Platform SHALL enforce a maximum of 2 tickets per wallet address per event
    - **Validates: Requirements 10.2**

  - [ ]* 12.4 Write property test for service recovery time
    - **Property 36: Service Recovery Time** — for any Bot_Detection_Service recovery from outage, normal bot detection operations SHALL resume within 60 seconds of health check success
    - **Validates: Requirements 10.3**

  - [ ]* 12.5 Write unit tests for fallback mode
    - Test activation on health check failure
    - Test purchase limit enforcement (2 tickets per wallet per event)
    - Test recovery and deactivation within 60 seconds
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 13. Implement rate limiting and API authentication
  - [ ] 13.1 Implement Redis sliding window rate limiter
    - Implement sliding window counter in Redis using key `rate_limit:{api_key}:{window}` (TTL: 1s)
    - Enforce 100 req/s per API key with burst capacity of 200 requests
    - Return HTTP 429 with Retry-After header when limit exceeded
    - _Requirements: 7.2, 7.3, 7.4_

  - [ ] 13.2 Implement API key authentication middleware
    - Validate API key from request header against stored keys
    - Return HTTP 401 for missing keys, HTTP 403 for invalid permissions
    - _Requirements: 7.1_

  - [ ]* 13.3 Write property test for rate limiting enforcement
    - **Property 23: Rate Limiting Enforcement** — for any API key, when request rate exceeds 100 req/s, the API_Server SHALL throttle subsequent requests and return HTTP 429 with Retry-After header
    - **Validates: Requirements 7.2, 7.3**

  - [ ]* 13.4 Write property test for API response time P99
    - **Property 24: API Response Time P99** — for any 100-request sample window, at least 99 requests SHALL complete within 300 milliseconds
    - **Validates: Requirements 7.6**

  - [ ]* 13.5 Write unit tests for rate limiting
    - Test rate limit enforcement at boundary (100th vs 101st request)
    - Test burst capacity behavior
    - Test Retry-After header value correctness
    - _Requirements: 7.2, 7.3, 7.4_


- [ ] 14. Implement frontend Behavioral SDK (TypeScript)
  - [ ] 14.1 Create TypeScript SDK package structure
    - Set up npm package with TypeScript and tsconfig
    - Define SDK configuration interface (apiUrl, apiKey, samplingRate)
    - Create SDK initialization function with API client
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 14.2 Implement mouse movement tracking
    - Add event listeners for mousemove, click, scroll events
    - Sample mouse coordinates at minimum 10 samples per second using requestAnimationFrame
    - Store events in circular buffer to limit memory usage
    - _Requirements: 2.1_

  - [ ] 14.3 Implement keystroke tracking
    - Add event listeners for keydown, keyup events
    - Record key press duration (pressTime) and inter-key intervals
    - Filter sensitive keys (password fields, credit card inputs) to avoid capturing PII
    - _Requirements: 2.2_

  - [ ] 14.4 Implement navigation tracking
    - Track page transitions using History API (pushState, popstate)
    - Record page dwell times from entry to exit
    - Store navigation events with fromPage, toPage, dwellTime
    - _Requirements: 2.3_

  - [ ] 14.5 Implement data transmission
    - Send collected behavioral data to API Server within 5 seconds of collection completion
    - Implement retry logic for failed transmissions (exponential backoff)
    - Use TLS 1.3 enforced by HTTPS endpoint configuration
    - _Requirements: 2.4, 2.5_

  - [ ]* 14.6 Write property test for data transmission latency
    - **Property 6: Data Transmission Latency** — for any collected behavioral data, the Behavioral_Analyzer SHALL transmit to the API_Server within 5 seconds of collection completion
    - **Validates: Requirements 2.4**

  - [ ]* 14.7 Write unit tests for Behavioral SDK
    - Test mouse event collection and sampling rate (≥10 samples/sec)
    - Test keystroke timing calculation (pressTime, inter-key intervals)
    - Test navigation tracking with History API
    - Test transmission retry logic
    - _Requirements: 2.1, 2.2, 2.3, 2.4_


- [ ] 15. Implement challenge UI components (React)
  - [ ] 15.1 Create React challenge component library
    - Set up React component package with TypeScript
    - Create base challenge container component with loading and error states
    - _Requirements: 4.1_

  - [ ] 15.2 Implement image selection challenge component
    - Display grid of images loaded from MinIO/CDN URL
    - Handle image selection interactions and selection state
    - Submit selected images to Challenge Service POST /v1/verify-challenge
    - Display success/failure feedback to user
    - _Requirements: 4.2_

  - [ ] 15.3 Implement multi-step challenge component
    - Combine image selection and behavioral confirmation steps
    - Manage multi-step flow state machine
    - Display progress indicator
    - _Requirements: 4.3_

  - [ ]* 15.4 Write unit tests for challenge UI components
    - Test image selection interactions and state management
    - Test challenge submission and error handling
    - Test multi-step flow transitions
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 16. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 17. Integrate with Rexell backend service
  - [ ] 17.1 Create bot detection client library (TypeScript)
    - Create HTTP client for bot detection API with typed request/response models
    - Implement methods: detectBot, validateToken, consumeToken
    - Add error handling and retry logic with exponential backoff
    - Configure API key from environment variables
    - _Requirements: 5.1, 5.2_

  - [ ] 17.2 Integrate with buyTicket flow
    - Add bot detection check before buyTicket smart contract transaction
    - Request verification token from bot detection service
    - Handle challenge responses from frontend (poll or webhook)
    - Validate token before executing transaction
    - Consume token after successful transaction
    - _Requirements: 5.1, 5.2, 5.6_

  - [ ] 17.3 Integrate with buyTickets bulk purchase flow
    - Apply 1.5x risk score multiplier for bulk purchases in detection request context
    - Enforce token max_quantity limits against requested ticket quantity
    - _Requirements: 5.1_

  - [ ] 17.4 Integrate with requestResaleVerification flow
    - Add bot detection check for resale requests
    - Track resale request frequency via Detection Service
    - Apply trusted status benefits (reduced verification requirements)
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 17.5 Write integration tests for backend integration
    - Test end-to-end purchase flow with bot detection (low-risk path)
    - Test challenge flow (medium-risk → challenge → success → token → transaction)
    - Test token validation and consumption
    - Test resale verification flow
    - _Requirements: 5.1, 5.2, 5.6, 6.1_


- [ ] 18. Implement ML model training pipeline
  - [ ] 18.1 Create training data preparation script
    - Query behavioral data from PostgreSQL (last 90 days) using date range filter
    - Extract features using Behavioral_Analyzer
    - Label data based on challenge outcomes and manual review flags
    - Split data into train/validation/test sets (70/15/15)
    - Export to Parquet format and upload to MinIO training-data bucket
    - _Requirements: 3.1, 3.6_

  - [ ] 18.2 Implement model training script (scikit-learn / XGBoost)
    - Train GradientBoostingClassifier or XGBClassifier on prepared feature data
    - Define hyperparameters and cross-validation strategy
    - Track experiment with MLflow (parameters, metrics, artifacts)
    - Save model artifacts to MinIO with semantic versioning (v{major}.{minor}.{patch})
    - _Requirements: 3.1_

  - [ ] 18.3 Implement model validation and quality gates
    - Calculate accuracy, precision, recall, F1, and false positive rate on validation set
    - Enforce quality gates: ≥95% accuracy AND <2% false positive rate
    - Block deployment if quality gates not met; publish alert via RabbitMQ
    - Log all validation metrics to MLflow
    - _Requirements: 3.2, 3.3, 3.5_

  - [ ]* 18.4 Write property test for model deployment quality gates
    - **Property 8: Model Deployment Quality Gates** — for any newly trained model, it SHALL NOT be deployed unless it achieves both ≥95% accuracy AND <2% false positive rate
    - **Validates: Requirements 3.2, 3.3**

  - [ ]* 18.5 Write property test for model performance degradation alerting
    - **Property 9: Model Performance Degradation Alerting** — for any deployed model, when measured accuracy falls below 90%, an alert SHALL be triggered to platform administrators
    - **Validates: Requirements 3.5**

  - [ ]* 18.6 Write property test for model deployment validation
    - **Property 40: Model Deployment Validation** — for any model deployment, the Bot_Detection_Service SHALL validate performance against a holdout test dataset before making the model available for inference
    - **Validates: Requirements 12.5**

  - [ ]* 18.7 Write unit tests for training pipeline
    - Test data preparation with mock behavioral data
    - Test feature extraction consistency across runs
    - Test validation metrics calculation
    - Test quality gate enforcement (pass and fail cases)
    - _Requirements: 3.1, 3.2, 3.3_


- [ ] 19. Deploy ML Inference Service
  - [ ] 19.1 Create TorchServe / Triton model handler
    - Write model handler that loads XGBoost/scikit-learn model artifact from MinIO on startup
    - Implement preprocessing (feature normalization to [0,1]) in handler
    - Expose REST endpoint POST /predictions returning bot probability score (0–1)
    - _Requirements: 3.4_

  - [ ] 19.2 Implement model deployment automation script
    - Download model artifacts from MinIO by version
    - Register model version in MLflow Model Registry
    - Update ML Inference Service to load new model version via rolling update
    - Validate endpoint health after deployment
    - _Requirements: 3.4_

  - [ ] 19.3 Implement A/B testing for model updates
    - Route 10% of inference traffic to new model version using weighted routing
    - Monitor accuracy and latency for 48 hours before full rollout
    - Implement automatic rollback if metrics degrade >5%
    - _Requirements: 3.5_

  - [ ]* 19.4 Write unit tests for deployment automation
    - Test model loading from MinIO
    - Test A/B traffic split logic
    - Test rollback trigger logic
    - _Requirements: 3.4, 3.5_

- [ ] 20. Implement monthly model retraining CronJob
  - [ ] 20.1 Create Training Service as Kubernetes CronJob
    - Implement monthly trigger (Kubernetes CronJob schedule: `0 2 1 * *`)
    - Query last 90 days of behavioral data from PostgreSQL
    - Invoke training pipeline (tasks 18.1–18.3)
    - Deploy new model if quality gates pass
    - Publish alert via RabbitMQ if quality gates fail
    - _Requirements: 3.6_

  - [ ]* 20.2 Write unit tests for retraining CronJob
    - Test data query with date range boundaries
    - Test training job invocation and result handling
    - Test deployment on success and alert on failure
    - _Requirements: 3.6_


- [ ] 21. Implement Prometheus metrics and Grafana dashboards
  - [ ] 21.1 Add Prometheus metrics to Detection and Challenge Services
    - Instrument all endpoints with request counter (`bot_detection_requests_total{decision}`), latency histogram (`bot_detection_latency_seconds`), and error counter
    - Publish custom metrics: `bot_detection_risk_score_histogram`, `challenge_completion_rate`, `fallback_mode_active`, `ml_inference_latency_seconds`
    - Expose /metrics endpoint on each service
    - _Requirements: 8.5_

  - [ ] 21.2 Configure Prometheus scrape targets and alert rules
    - Write Prometheus scrape config for all services
    - Define alert rules: detection rate >20% (high-priority), error rate >1% (warning) / >5% (critical), ML latency >500ms (warning), fallback active (critical), model accuracy <90% (critical)
    - _Requirements: 8.2, 8.3, 8.4_

  - [ ] 21.3 Create Grafana dashboards
    - Create operational dashboard: request volume, error rates, latency P50/P95/P99, service health
    - Create detection dashboard: detection rate over time, risk score distribution, challenge success rate
    - Configure Grafana alert notification channels (email/Slack)
    - _Requirements: 8.5_

  - [ ] 21.4 Implement daily summary report generation
    - Create scheduled job to generate daily summary of detection activity and model performance
    - Export report data to MinIO or send via configured notification channel
    - _Requirements: 8.6_

  - [ ]* 21.5 Write property test for metrics publishing
    - **Property 29: Metrics Publishing** — for any detection operation, the Bot_Detection_Service SHALL publish metrics including detection rate, false positive rate, and average risk score to the Monitoring_Service
    - **Validates: Requirements 8.5**

  - [ ]* 21.6 Write property test for high bot detection rate alerting
    - **Property 26: High Bot Detection Rate Alerting** — for any time window where blocked/challenged requests exceed 20% of total, a high-priority alert SHALL be triggered
    - **Validates: Requirements 8.2**

  - [ ]* 21.7 Write property test for service error rate alerting
    - **Property 27: Service Error Rate Alerting** — for any time window where service error rate exceeds 1%, an alert SHALL be triggered to platform administrators
    - **Validates: Requirements 8.3**

  - [ ]* 21.8 Write property test for ML inference latency alerting
    - **Property 28: ML Inference Latency Alerting** — for any time window where ML_Inference_Service latency exceeds 500 milliseconds, a performance alert SHALL be triggered
    - **Validates: Requirements 8.4**

  - [ ]* 21.9 Write unit tests for metrics
    - Test metric data format and label correctness
    - Test alert trigger conditions at boundary values
    - _Requirements: 8.2, 8.3, 8.4, 8.5_


- [ ] 22. Implement data privacy and compliance features
  - [ ] 22.1 Implement data anonymization utilities
    - Hash wallet addresses with SHA-256 + per-deployment salt before any storage
    - Truncate IP addresses to /24 subnet (remove last octet)
    - Normalize user agents to browser family only
    - Remove all PII from log output (no raw wallet addresses, no full IPs)
    - _Requirements: 9.1, 9.4_

  - [ ] 22.2 Implement data deletion endpoint
    - Create DELETE /v1/user-data endpoint accepting wallet address
    - Hash wallet address and query all tables for matching user_hash records
    - Delete records from PostgreSQL (behavioral_data, risk_scores, user_reputation, challenge_state)
    - Delete archived data from MinIO
    - Complete deletion within 30 days via async RabbitMQ job
    - _Requirements: 9.3_

  - [ ] 22.3 Implement audit logging
    - Log all data access operations to audit_log table in PostgreSQL
    - Include timestamp, accessor identity (API key hash), operation type, and resource identifier
    - Retain audit logs for 7 years per compliance requirements
    - _Requirements: 9.6_

  - [ ] 22.4 Implement data retention policy enforcement
    - Implement GDPR/CCPA compliant data retention policies in code
    - Enforce 90-day behavioral data retention via expires_at column and cleanup job
    - Implement 30-day log retention with automatic deletion
    - _Requirements: 9.5, 11.5_

  - [ ]* 22.5 Write property test for user identifier anonymization
    - **Property 30: User Identifier Anonymization** — for any behavioral data stored in the Database, wallet addresses SHALL be hashed using SHA-256 before storage, not stored in plaintext
    - **Validates: Requirements 9.1**

  - [ ]* 22.6 Write property test for PII exclusion from logs
    - **Property 32: PII Exclusion from Logs** — for any log entry, it SHALL NOT contain personally identifiable information such as raw wallet addresses or full IP addresses
    - **Validates: Requirements 9.4**

  - [ ]* 22.7 Write property test for data deletion compliance
    - **Property 31: Data Deletion Compliance** — for any user data deletion request, all associated behavioral data SHALL be removed from the Database and Object_Storage within 30 days
    - **Validates: Requirements 9.3**

  - [ ]* 22.8 Write property test for data access audit logging
    - **Property 33: Data Access Audit Logging** — for any data access operation on behavioral data or risk scores, an audit log entry SHALL be created with timestamp, accessor identity, and operation type
    - **Validates: Requirements 9.6**

  - [ ]* 22.9 Write unit tests for privacy features
    - Test wallet address hashing consistency and irreversibility
    - Test IP address truncation
    - Test data deletion flow end-to-end
    - Test audit log creation on data access
    - _Requirements: 9.1, 9.3, 9.4, 9.6_


- [ ] 23. Implement MinIO data archival
  - [ ] 23.1 Configure MinIO buckets and lifecycle policies
    - Create bot-detection-models bucket for ML artifacts with versioning enabled
    - Create bot-detection-archive bucket for long-term behavioral data storage
    - Configure MinIO lifecycle policy to transition data older than 90 days to archive bucket
    - _Requirements: 11.3_

  - [ ] 23.2 Implement PostgreSQL to MinIO archival job
    - Create async job triggered via RabbitMQ for archiving expired behavioral data
    - Export records to Parquet format, compress with gzip
    - Upload to MinIO organized by year/month/day path structure
    - Delete archived records from PostgreSQL after successful upload
    - _Requirements: 11.3_

  - [ ]* 23.3 Write property test for data archival lifecycle
    - **Property 38: Data Archival Lifecycle** — for any behavioral data record older than 90 days, the Bot_Detection_Service SHALL move the data from the Database to Object_Storage
    - **Validates: Requirements 11.3**

  - [ ]* 23.4 Write unit tests for archival
    - Test Parquet export format correctness
    - Test data compression
    - Test MinIO upload and PostgreSQL cleanup after successful archive
    - _Requirements: 11.3_

- [ ] 24. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 25. Implement testing infrastructure
  - [ ] 25.1 Create testing mode and test data isolation
    - Add `X-Test-Mode: true` header support to all endpoints
    - Tag all test data with `test_run_id` in PostgreSQL to prevent production contamination
    - Route test data to separate Redis key namespace (`test:{test_run_id}:...`)
    - Exclude test-tagged data from production metrics and dashboards
    - _Requirements: 12.1, 12.3_

  - [ ] 25.2 Create synthetic bot traffic generator
    - Generate bot-like behavioral patterns: linear mouse movement, constant keystroke timing
    - Generate human-like behavioral patterns: natural curves, variable timing, realistic dwell times
    - Support configurable traffic volume and pattern mix ratio
    - Output traffic to testing API endpoint (POST /v1/detect with test mode header)
    - _Requirements: 12.4_

  - [ ] 25.3 Implement scenario replay functionality
    - Store historical detection scenarios (request + result) in MinIO
    - Create POST /v1/replay endpoint accepting scenario_id
    - Load scenario data and re-execute detection pipeline
    - Compare results with original detection outcome
    - _Requirements: 12.2_

  - [ ]* 25.4 Write property test for test data isolation
    - **Property 39: Test Data Isolation** — for any detection request with testing mode enabled, all generated data and results SHALL be tagged with a test identifier to prevent contamination of production datasets
    - **Validates: Requirements 12.3**

  - [ ]* 25.5 Write unit tests for testing infrastructure
    - Test data tagging in test mode (verify test_run_id present in all records)
    - Test synthetic traffic generation patterns (bot vs human distinguishability)
    - Test scenario replay accuracy against original results
    - _Requirements: 12.2, 12.3, 12.4_


- [ ] 26. Create Kubernetes manifests and Docker images
  - [ ] 26.1 Write Dockerfiles for all services
    - Detection Service Dockerfile (python:3.11-slim, multi-stage build)
    - Challenge Service Dockerfile (python:3.11-slim)
    - Training Service Dockerfile (python:3.11-slim with scikit-learn/XGBoost)
    - ML Inference Service Dockerfile (pytorch/torchserve base)
    - _Requirements: 10.5_

  - [ ] 26.2 Write Kubernetes manifests
    - Deployments with resource limits, liveness probes, and readiness probes for all services
    - HorizontalPodAutoscaler for Detection Service and ML Inference Service (min 2, max 10 replicas, scale at 80% CPU)
    - Services, ConfigMaps, and Secrets (referencing Kubernetes Secrets for DB URL, Redis URL, signing key)
    - StatefulSets for PostgreSQL, Redis, RabbitMQ, MinIO
    - CronJob for Training Service (monthly schedule)
    - _Requirements: 7.5, 10.5, 10.6_

  - [ ] 26.3 Write environment-specific Kustomize overlays
    - Base manifests in `k8s/base/`
    - Overlays for dev, staging, production in `k8s/overlays/`
    - Environment-specific resource limits and replica counts
    - _Requirements: 12.6_

  - [ ]* 26.4 Write integration tests for multi-replica deployment
    - Test that traffic is distributed across replicas
    - Test that a replica failure does not cause request failures (automatic rerouting)
    - _Requirements: 10.5, 10.6_


- [ ] 27. Implement end-to-end integration tests
  - [ ] 27.1 Create end-to-end test suite
    - Set up pytest integration test suite with Docker Compose test environment
    - Create fixtures for behavioral data generation, mock blockchain transactions
    - _Requirements: 5.1, 5.2_

  - [ ] 27.2 Test complete purchase flow (low-risk)
    - Simulate low-risk user behavioral data → token generation → mock transaction → token consumption
    - Verify token is marked consumed and cannot be reused
    - _Requirements: 5.1, 5.2, 5.6_

  - [ ] 27.3 Test challenge flow (medium-risk)
    - Simulate medium-risk user → challenge presented → successful completion → token → transaction
    - Verify risk score reduced by 30 after challenge success
    - _Requirements: 4.1, 4.4, 5.1_

  - [ ] 27.4 Test blocked flow (high-risk)
    - Simulate high-risk bot behavioral data → block decision → transaction prevented
    - Verify block event is logged with risk score and behavioral indicators
    - _Requirements: 1.2, 1.5_

  - [ ] 27.5 Test fallback flow
    - Simulate ML Inference Service failure → fallback activation → rate limiting enforced → service recovery
    - Verify normal operations resume within 60 seconds of recovery
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ] 27.6 Test resale detection flow
    - Simulate rapid resale requests within 60 seconds → account flagging → additional verification required
    - _Requirements: 6.1, 6.2, 6.4_

- [ ] 28. Implement load testing scripts
  - [ ] 28.1 Create k6 load testing scripts
    - Write test scenarios: normal (50 req/s, 1 hour), peak (200 req/s, 15 min), spike (0→500 req/s, 10 sec), sustained (150 req/s, 4 hours)
    - Configure thresholds: P99 <300ms, error rate <0.1%
    - _Requirements: 7.6_

  - [ ]* 28.2 Write integration tests for auto-scaling behavior
    - Test auto-scaling triggers under load (scale out at 80% capacity)
    - Test performance degradation thresholds
    - _Requirements: 7.5, 7.6_

- [ ] 29. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints at tasks 10, 16, 24, and 29 ensure incremental validation at key milestones
- Property tests use Hypothesis (Python) and fast-check (TypeScript SDK); minimum 100 iterations per test
- All 40 correctness properties from the design document have corresponding property test sub-tasks
- The implementation is cloud-agnostic: no AWS SDK, no vendor-specific managed services
- Docker Compose is used for local development; Kubernetes manifests for all environments
- Kustomize overlays provide environment-specific configuration (dev/staging/production)
- Property test tag format: `# Feature: rexell-ai-bot-detection-integration, Property {N}: {property_text}`
