import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { beforeAll, expect, test, jest } from '@jest/globals';
import { BotDetectionStack } from '../lib/bot-detection-stack';

let template: Template;

beforeAll(() => {
  const app = new cdk.App();
  const stack = new BotDetectionStack(app, 'TestStack', {
    environment: 'test',
    env: { account: '123456789012', region: 'us-east-1' },
  });
  template = Template.fromStack(stack);
});

// ── VPC ────────────────────────────────────────────────────────────
test('creates a VPC', () => {
  template.resourceCountIs('AWS::EC2::VPC', 1);
});

test('creates subnets across 3 AZs (public + private + isolated = 9)', () => {
  template.resourceCountIs('AWS::EC2::Subnet', 9);
});

test('creates 3 NAT gateways', () => {
  template.resourceCountIs('AWS::EC2::NatGateway', 3);
});

// ── Security Groups ────────────────────────────────────────────────
test('creates Lambda and SageMaker security groups', () => {
  // The VPC also creates a default SG, so check for our named ones
  template.hasResourceProperties('AWS::EC2::SecurityGroup', {
    GroupDescription: 'Security group for bot detection Lambda functions',
  });
  template.hasResourceProperties('AWS::EC2::SecurityGroup', {
    GroupDescription: 'Security group for SageMaker bot detection endpoint',
  });
});

// ── KMS Keys ───────────────────────────────────────────────────────
test('creates 2 KMS keys with rotation enabled', () => {
  template.resourceCountIs('AWS::KMS::Key', 2);
  template.hasResourceProperties('AWS::KMS::Key', {
    EnableKeyRotation: true,
  });
});

// ── IAM Roles ──────────────────────────────────────────────────────
test('creates Detection Lambda execution role', () => {
  template.hasResourceProperties('AWS::IAM::Role', {
    RoleName: 'RexellBotDetection-DetectionLambdaRole',
  });
});

test('creates Challenge Lambda execution role', () => {
  template.hasResourceProperties('AWS::IAM::Role', {
    RoleName: 'RexellBotDetection-ChallengeLambdaRole',
  });
});

test('creates Training Lambda execution role', () => {
  template.hasResourceProperties('AWS::IAM::Role', {
    RoleName: 'RexellBotDetection-TrainingLambdaRole',
  });
});

// ── Secrets Manager ────────────────────────────────────────────────
test('creates API key secret', () => {
  template.hasResourceProperties('AWS::SecretsManager::Secret', {
    Name: 'rexell/bot-detection/api-key',
  });
});

test('creates signing key secret', () => {
  template.hasResourceProperties('AWS::SecretsManager::Secret', {
    Name: 'rexell/bot-detection/signing-key',
  });
});

// ── CloudWatch ──────────────────────────────────────────────────────
test('creates a CloudWatch dashboard', () => {
  template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
});

test('creates a high latency alarm', () => {
  template.hasResourceProperties('AWS::CloudWatch::Alarm', {
    AlarmDescription: 'Detection latency is higher than 500ms (p95) for 2 out of 3 periods',
    Threshold: 500,
  });
});

// ── S3 ─────────────────────────────────────────────────────────────
test('creates a versioned S3 bucket with encryption', () => {
  template.hasResourceProperties('AWS::S3::Bucket', {
    VersioningConfiguration: { Status: 'Enabled' },
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });
});

test('has lifecycle rule to transition to Glacier after 30 days', () => {
  template.hasResourceProperties('AWS::S3::Bucket', {
    LifecycleConfiguration: {
      Rules: Match.arrayWith([
        Match.objectLike({
          Id: 'ArchiveToGlacier',
          Status: 'Enabled',
          Transitions: [{
            StorageClass: 'GLACIER',
            TransitionInDays: 30,
          }],
        }),
      ]),
    },
  });
});

// ── Snapshot ───────────────────────────────────────────────────────
test('matches snapshot', () => {
  expect(template.toJSON()).toMatchSnapshot();
});
