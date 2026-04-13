import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface DynamoDbConstructProps {
  /** KMS key for table encryption */
  encryptionKey: kms.IKey;
  /** Environment name */
  environment: string;
}

/**
 * DynamoDB tables for the Rexell AI Bot Detection system.
 *
 * Requirements: 2.6, 9.2, 11.2
 */
export class DynamoDbConstruct extends Construct {
  public readonly behavioralDataTable: dynamodb.Table;
  public readonly riskScoresTable: dynamodb.Table;
  public readonly verificationTokensTable: dynamodb.Table;
  public readonly userReputationTable: dynamodb.Table;
  public readonly challengeStateTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DynamoDbConstructProps) {
    super(scope, id);

    // ── BehavioralData Table ──────────────────────────────────────────
    this.behavioralDataTable = new dynamodb.Table(this, 'BehavioralData', {
      tableName: `RexellBotDetection-BehavioralData-${props.environment}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.encryptionKey,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.behavioralDataTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ── RiskScores Table ──────────────────────────────────────────────
    this.riskScoresTable = new dynamodb.Table(this, 'RiskScores', {
      tableName: `RexellBotDetection-RiskScores-${props.environment}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.encryptionKey,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.riskScoresTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'decision', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.riskScoresTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ── VerificationTokens Table ──────────────────────────────────────
    this.verificationTokensTable = new dynamodb.Table(this, 'VerificationTokens', {
      tableName: `RexellBotDetection-VerificationTokens-${props.environment}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.encryptionKey,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.verificationTokensTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'walletAddress', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'issuedAt', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ── UserReputation Table ──────────────────────────────────────────
    this.userReputationTable = new dynamodb.Table(this, 'UserReputation', {
      tableName: `RexellBotDetection-UserReputation-${props.environment}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.encryptionKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ── ChallengeState Table ──────────────────────────────────────────
    this.challengeStateTable = new dynamodb.Table(this, 'ChallengeState', {
      tableName: `RexellBotDetection-ChallengeState-${props.environment}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.encryptionKey,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.challengeStateTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });
  }
}
