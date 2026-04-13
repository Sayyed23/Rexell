import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { VpcConstruct } from './constructs/vpc';
import { SecurityGroupsConstruct } from './constructs/security-groups';
import { IamRolesConstruct } from './constructs/iam-roles';
import { KmsKeysConstruct } from './constructs/kms-keys';
import { SecretsConstruct } from './constructs/secrets';
import { DynamoDbConstruct } from './constructs/dynamodb';
import { CloudWatchConstruct } from './constructs/cloudwatch';
import { S3StorageConstruct } from './constructs/s3-storage';

export interface BotDetectionStackProps extends cdk.StackProps {
  /** Environment name: 'dev' | 'staging' | 'production' */
  environment: string;
}

/**
 * Main CDK stack for the Rexell AI Bot Detection infrastructure.
 *
 * This stack provisions:
 * - VPC with 3 AZs, public/private subnets, NAT gateways
 * - Security groups for Lambda and SageMaker
 * - KMS customer-managed keys for data encryption
 * - IAM execution roles for Detection, Challenge, and Training Lambdas
 * - Secrets Manager secrets for API keys and token signing
 *
 * Requirements: 7.1, 9.2, 10.5
 */
export class BotDetectionStack extends cdk.Stack {
  public readonly vpc: VpcConstruct;
  public readonly securityGroups: SecurityGroupsConstruct;
  public readonly kmsKeys: KmsKeysConstruct;
  public readonly iamRoles: IamRolesConstruct;
  public readonly secrets: SecretsConstruct;
  public readonly database: DynamoDbConstruct;
  public readonly cloudwatch: CloudWatchConstruct;
  public readonly storage: S3StorageConstruct;

  constructor(scope: Construct, id: string, props: BotDetectionStackProps) {
    super(scope, id, props);

    // ── KMS Keys (created first — other constructs reference them) ──
    this.kmsKeys = new KmsKeysConstruct(this, 'KmsKeys');

    // ── VPC ─────────────────────────────────────────────────────────
    this.vpc = new VpcConstruct(this, 'Vpc', {
      environment: props.environment,
    });

    // ── Security Groups ─────────────────────────────────────────────
    this.securityGroups = new SecurityGroupsConstruct(this, 'SecurityGroups', {
      vpc: this.vpc.vpc,
    });

    // ── IAM Roles ────────────────────────────────────────────────────
    this.iamRoles = new IamRolesConstruct(this, 'IamRoles', {
      dynamoDbKmsKey: this.kmsKeys.dynamoDbKey,
      s3KmsKey: this.kmsKeys.s3Key,
    });

    // ── DynamoDB ────────────────────────────────────────────────────
    this.database = new DynamoDbConstruct(this, 'Database', {
      encryptionKey: this.kmsKeys.dynamoDbKey,
      environment: props.environment,
    });

    // ── CloudWatch ──────────────────────────────────────────────────
    this.cloudwatch = new CloudWatchConstruct(this, 'CloudWatch', {
      environment: props.environment,
    });

    // ── S3 Storage ──────────────────────────────────────────────────
    this.storage = new S3StorageConstruct(this, 'Storage', {
      encryptionKey: this.kmsKeys.s3Key,
      environment: props.environment,
    });

    // ── Secrets Manager ──────────────────────────────────────────────
    this.secrets = new SecretsConstruct(this, 'Secrets');

    // Grant Detection Lambda read access to secrets
    this.secrets.apiKeySecret.grantRead(this.iamRoles.detectionLambdaRole);
    this.secrets.signingKeySecret.grantRead(this.iamRoles.detectionLambdaRole);

    // ── Stack Outputs ────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpc.vpcId,
      description: 'VPC ID for bot detection infrastructure',
      exportName: `${id}-VpcId`,
    });

    new cdk.CfnOutput(this, 'DynamoDbKmsKeyArn', {
      value: this.kmsKeys.dynamoDbKey.keyArn,
      description: 'KMS Key ARN for DynamoDB encryption',
      exportName: `${id}-DynamoDbKmsKeyArn`,
    });

    new cdk.CfnOutput(this, 'S3KmsKeyArn', {
      value: this.kmsKeys.s3Key.keyArn,
      description: 'KMS Key ARN for S3 encryption',
      exportName: `${id}-S3KmsKeyArn`,
    });

    new cdk.CfnOutput(this, 'DetectionLambdaRoleArn', {
      value: this.iamRoles.detectionLambdaRole.roleArn,
      description: 'IAM Role ARN for Detection Lambda',
      exportName: `${id}-DetectionLambdaRoleArn`,
    });

    new cdk.CfnOutput(this, 'ChallengeLambdaRoleArn', {
      value: this.iamRoles.challengeLambdaRole.roleArn,
      description: 'IAM Role ARN for Challenge Lambda',
      exportName: `${id}-ChallengeLambdaRoleArn`,
    });

    new cdk.CfnOutput(this, 'TrainingLambdaRoleArn', {
      value: this.iamRoles.trainingLambdaRole.roleArn,
      description: 'IAM Role ARN for Training Lambda',
      exportName: `${id}-TrainingLambdaRoleArn`,
    });

    new cdk.CfnOutput(this, 'BehavioralDataTableName', {
      value: this.database.behavioralDataTable.tableName,
      description: 'BehavioralData Table Name',
      exportName: `${id}-BehavioralDataTableName`,
    });

    new cdk.CfnOutput(this, 'RiskScoresTableName', {
      value: this.database.riskScoresTable.tableName,
      description: 'RiskScores Table Name',
      exportName: `${id}-RiskScoresTableName`,
    });

    new cdk.CfnOutput(this, 'VerificationTokensTableName', {
      value: this.database.verificationTokensTable.tableName,
      description: 'VerificationTokens Table Name',
      exportName: `${id}-VerificationTokensTableName`,
    });

    new cdk.CfnOutput(this, 'CloudWatchDashboardName', {
      value: this.cloudwatch.dashboard.dashboardName,
      description: 'CloudWatch Monitoring Dashboard Name',
      exportName: `${id}-DashboardName`,
    });

    new cdk.CfnOutput(this, 'ModelBucketName', {
      value: this.storage.modelBucket.bucketName,
      description: 'S3 Bucket for Machine Learning Models',
      exportName: `${id}-ModelBucketName`,
    });
  }
}
