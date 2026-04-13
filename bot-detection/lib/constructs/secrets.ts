import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

/**
 * Secrets Manager secrets for API authentication and token signing.
 *
 * Requirements: 7.1 - API key authentication
 */
export class SecretsConstruct extends Construct {
  /** API key secret for API Gateway authentication */
  public readonly apiKeySecret: secretsmanager.Secret;

  /** HMAC-SHA256 signing key for verification token generation */
  public readonly signingKeySecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.apiKeySecret = new secretsmanager.Secret(this, 'ApiKeySecret', {
      secretName: 'rexell/bot-detection/api-key',
      description: 'API key for bot detection API Gateway authentication',
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 64,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    cdk.Tags.of(this.apiKeySecret).add('Project', 'RexellBotDetection');

    this.signingKeySecret = new secretsmanager.Secret(this, 'SigningKeySecret', {
      secretName: 'rexell/bot-detection/signing-key',
      description: 'HMAC-SHA256 signing key for verification token generation',
      generateSecretString: {
        excludePunctuation: false,
        passwordLength: 64,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    cdk.Tags.of(this.signingKeySecret).add('Project', 'RexellBotDetection');
  }
}
