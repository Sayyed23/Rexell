import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface S3StorageConstructProps {
  /** KMS key for bucket encryption */
  encryptionKey: kms.IKey;
  /** Environment name */
  environment: string;
}

/**
 * S3 storage for model artifacts and archived data with automated lifecycle rules.
 * 
 * Requirements: 11.2 - Data persistence and archival
 */
export class S3StorageConstruct extends Construct {
  public readonly modelBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: S3StorageConstructProps) {
    super(scope, id);

    this.modelBucket = new s3.Bucket(this, 'ModelBucket', {
      bucketName: `rexell-bot-detection-models-${props.environment}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      versioned: true,
      lifecycleRules: [
        {
          id: 'ArchiveToGlacier',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
        {
          id: 'ExpireOldVersions',
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(90),
        },
      ],
    });

    cdk.Tags.of(this.modelBucket).add('Project', 'RexellBotDetection');
    cdk.Tags.of(this.modelBucket).add('Environment', props.environment);
  }
}
