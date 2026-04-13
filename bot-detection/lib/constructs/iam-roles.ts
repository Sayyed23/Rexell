import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface IamRolesConstructProps {
  /** KMS key ARN for DynamoDB encryption */
  dynamoDbKmsKey: kms.IKey;
  /** KMS key ARN for S3 encryption */
  s3KmsKey: kms.IKey;
}

/**
 * IAM execution roles for bot detection Lambda functions.
 * Each role follows least-privilege principle.
 *
 * Requirements: 7.1, 9.2
 */
export class IamRolesConstruct extends Construct {
  /** Execution role for the Detection Lambda */
  public readonly detectionLambdaRole: iam.Role;

  /** Execution role for the Challenge Lambda */
  public readonly challengeLambdaRole: iam.Role;

  /** Execution role for the Training Lambda */
  public readonly trainingLambdaRole: iam.Role;

  constructor(scope: Construct, id: string, props: IamRolesConstructProps) {
    super(scope, id);

    const lambdaPrincipal = new iam.ServicePrincipal('lambda.amazonaws.com');

    // ── Detection Lambda Role ──────────────────────────────────────────
    this.detectionLambdaRole = new iam.Role(this, 'DetectionLambdaRole', {
      roleName: 'RexellBotDetection-DetectionLambdaRole',
      assumedBy: lambdaPrincipal,
      description: 'Execution role for the bot detection Lambda function',
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // Basic Lambda execution (logging + VPC access)
    this.detectionLambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
    );

    // DynamoDB read/write for behavioral data, risk scores, tokens, reputation
    this.detectionLambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'DynamoDBAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:Query',
        'dynamodb:BatchGetItem',
        'dynamodb:BatchWriteItem',
      ],
      resources: ['*'], // Scoped to specific tables when tables are created (Task 2)
      conditions: {
        'ForAllValues:StringLike': {
          'dynamodb:tableName': 'RexellBotDetection-*',
        },
      },
    }));

    // SageMaker endpoint invocation
    this.detectionLambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'SageMakerInvoke',
      effect: iam.Effect.ALLOW,
      actions: ['sagemaker:InvokeEndpoint'],
      resources: ['*'], // Scoped to specific endpoint when deployed (Task 20)
    }));

    // Secrets Manager read for API keys and signing keys
    this.detectionLambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'SecretsManagerRead',
      effect: iam.Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret',
      ],
      resources: ['*'], // Scoped to specific secrets when created
      conditions: {
        'StringLike': {
          'secretsmanager:ResourceTag/Project': 'RexellBotDetection',
        },
      },
    }));

    // KMS decrypt for DynamoDB encryption
    props.dynamoDbKmsKey.grantDecrypt(this.detectionLambdaRole);

    // CloudWatch metrics publishing
    this.detectionLambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CloudWatchMetrics',
      effect: iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
      conditions: {
        'StringEquals': {
          'cloudwatch:namespace': 'RexellBotDetection',
        },
      },
    }));

    // ── Challenge Lambda Role ──────────────────────────────────────────
    this.challengeLambdaRole = new iam.Role(this, 'ChallengeLambdaRole', {
      roleName: 'RexellBotDetection-ChallengeLambdaRole',
      assumedBy: lambdaPrincipal,
      description: 'Execution role for the challenge verification Lambda function',
      maxSessionDuration: cdk.Duration.hours(1),
    });

    this.challengeLambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
    );

    // DynamoDB read/write for challenge state and tokens
    this.challengeLambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'DynamoDBAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:Query',
      ],
      resources: ['*'],
      conditions: {
        'ForAllValues:StringLike': {
          'dynamodb:tableName': 'RexellBotDetection-*',
        },
      },
    }));

    props.dynamoDbKmsKey.grantDecrypt(this.challengeLambdaRole);

    // CloudWatch metrics publishing
    this.challengeLambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CloudWatchMetrics',
      effect: iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
      conditions: {
        'StringEquals': {
          'cloudwatch:namespace': 'RexellBotDetection',
        },
      },
    }));

    // ── Training Lambda Role ───────────────────────────────────────────
    this.trainingLambdaRole = new iam.Role(this, 'TrainingLambdaRole', {
      roleName: 'RexellBotDetection-TrainingLambdaRole',
      assumedBy: lambdaPrincipal,
      description: 'Execution role for the ML model training Lambda function',
      maxSessionDuration: cdk.Duration.hours(1),
    });

    this.trainingLambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
    );

    // SageMaker training job management
    this.trainingLambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'SageMakerTraining',
      effect: iam.Effect.ALLOW,
      actions: [
        'sagemaker:CreateTrainingJob',
        'sagemaker:DescribeTrainingJob',
        'sagemaker:CreateModel',
        'sagemaker:CreateEndpointConfig',
        'sagemaker:UpdateEndpoint',
        'sagemaker:DescribeEndpoint',
      ],
      resources: ['*'],
    }));

    // S3 read/write for model artifacts and training data
    this.trainingLambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'S3ModelAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:ListBucket',
        's3:DeleteObject',
      ],
      resources: [
        'arn:aws:s3:::rexell-bot-detection-models',
        'arn:aws:s3:::rexell-bot-detection-models/*',
      ],
    }));

    // DynamoDB read for training data extraction
    this.trainingLambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'DynamoDBRead',
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:BatchGetItem',
      ],
      resources: ['*'],
      conditions: {
        'ForAllValues:StringLike': {
          'dynamodb:tableName': 'RexellBotDetection-*',
        },
      },
    }));

    props.dynamoDbKmsKey.grantDecrypt(this.trainingLambdaRole);
    props.s3KmsKey.grantEncryptDecrypt(this.trainingLambdaRole);

    // IAM PassRole for SageMaker training jobs
    this.trainingLambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'PassRoleToSageMaker',
      effect: iam.Effect.ALLOW,
      actions: ['iam:PassRole'],
      resources: ['*'],
      conditions: {
        'StringEquals': {
          'iam:PassedToService': 'sagemaker.amazonaws.com',
        },
      },
    }));
  }
}
