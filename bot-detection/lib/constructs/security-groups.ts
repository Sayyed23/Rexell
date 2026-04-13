import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface SecurityGroupsConstructProps {
  /** VPC to create security groups in */
  vpc: ec2.IVpc;
}

/**
 * Security groups for Lambda functions and SageMaker endpoints.
 *
 * Requirements: 10.5 - Security group configuration
 */
export class SecurityGroupsConstruct extends Construct {
  /** Security group for Lambda functions (Detection, Challenge, Training) */
  public readonly lambdaSg: ec2.SecurityGroup;

  /** Security group for SageMaker inference endpoint */
  public readonly sageMakerSg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: SecurityGroupsConstructProps) {
    super(scope, id);

    // Lambda security group — outbound HTTPS to AWS services
    this.lambdaSg = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for bot detection Lambda functions',
      allowAllOutbound: false,
    });

    // Allow Lambda outbound HTTPS (443) for DynamoDB, SageMaker, Secrets Manager, etc.
    this.lambdaSg.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow outbound HTTPS to AWS services'
    );

    // SageMaker security group — only accepts inbound from Lambda
    this.sageMakerSg = new ec2.SecurityGroup(this, 'SageMakerSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for SageMaker bot detection endpoint',
      allowAllOutbound: false,
    });

    // SageMaker accepts inbound HTTPS only from Lambda SG
    this.sageMakerSg.addIngressRule(
      this.lambdaSg,
      ec2.Port.tcp(443),
      'Allow inbound HTTPS from Lambda functions'
    );

    // SageMaker outbound HTTPS for model artifact downloads from S3
    this.sageMakerSg.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow outbound HTTPS for S3 model downloads'
    );
  }
}
