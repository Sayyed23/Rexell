#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BotDetectionStack } from '../lib/bot-detection-stack';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') || 'dev';

new BotDetectionStack(app, `RexellBotDetection-${environment}`, {
  environment,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: `Rexell AI Bot Detection Infrastructure (${environment})`,
  tags: {
    Project: 'RexellBotDetection',
    Environment: environment,
    ManagedBy: 'CDK',
  },
});

app.synth();
