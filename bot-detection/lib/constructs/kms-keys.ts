import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

/**
 * Customer-managed KMS keys for encrypting bot detection data.
 *
 * Requirements: 9.2 - Encrypt all data at rest using AWS KMS
 */
export class KmsKeysConstruct extends Construct {
  /** CMK for DynamoDB table encryption */
  public readonly dynamoDbKey: kms.Key;

  /** CMK for S3 bucket encryption (model artifacts, archived data) */
  public readonly s3Key: kms.Key;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.dynamoDbKey = new kms.Key(this, 'DynamoDbEncryptionKey', {
      alias: 'rexell-bot-detection/dynamodb',
      description: 'CMK for encrypting bot detection DynamoDB tables',
      enableKeyRotation: true, // Annual automatic rotation
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pendingWindow: cdk.Duration.days(30),
    });

    this.s3Key = new kms.Key(this, 'S3EncryptionKey', {
      alias: 'rexell-bot-detection/s3',
      description: 'CMK for encrypting bot detection S3 buckets (models, archives)',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pendingWindow: cdk.Duration.days(30),
    });
  }
}
