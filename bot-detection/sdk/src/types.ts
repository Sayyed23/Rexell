export enum ChallengeType {
  ImageSelection = 'image_selection',
  BehavioralConfirmation = 'behavioral_confirmation',
  MultiStep = 'multi_step'
}

export enum EventType {
  MouseMove = 'mousemove',
  Click = 'click',
  Scroll = 'scroll',
  KeyDown = 'keydown',
  KeyUp = 'keyup',
  Navigation = 'navigation'
}

export interface BaseEvent {
  timestamp: number;
  type: EventType;
}

export interface MouseEvent extends BaseEvent {
  type: EventType.MouseMove | EventType.Click | EventType.Scroll;
  x: number;
  y: number;
}

export interface KeystrokeEvent extends BaseEvent {
  type: EventType.KeyDown | EventType.KeyUp;
  key: string;
  pressTime?: number;
  interKeyInterval?: number;
}

export interface NavigationEvent extends BaseEvent {
  type: EventType.Navigation;
  fromPage?: string;
  toPage: string;
  dwellTime?: number;
}

export type TrackedEvent = MouseEvent | KeystrokeEvent | NavigationEvent;

export interface BehavioralData {
  sessionId: string;
  walletAddress: string;
  userAgent: string;
  ipAddress?: string; // Often injected by backend, optional in client
  events: TrackedEvent[];
}

export interface FeatureVector {
  mouse_velocity_mean: number;
  mouse_velocity_std: number;
  mouse_acceleration: number;
  mouse_curvature: number;
  click_frequency: number;
  flight_time_mean: number;
  flight_time_std: number;
  dwell_time_mean: number;
  navigation_entropy: number;
  page_dwell_time_dist: number;
}

export interface DetectionRequest {
  behavioralData: BehavioralData;
  context?: Record<string, any>;
}

export enum DetectionResponseDecision {
  Allow = 'allow',
  Challenge = 'challenge',
  Block = 'block'
}

export interface DetectionResponse {
  decision: DetectionResponseDecision;
  riskScore: number;
  verificationToken?: string;
  challengeId?: string;
  challengeType?: ChallengeType;
  challengeContent?: Record<string, any>;
}

export interface VerificationToken {
  tokenId: string;
  walletAddress: string;
  eventId?: string;
  maxQuantity?: number;
  issuedAt: number;
  expiresAt: number;
  signature: string;
}
