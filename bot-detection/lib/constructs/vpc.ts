import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface VpcConstructProps {
  /** Environment name for tagging */
  environment: string;
}

/**
 * VPC construct with 3 availability zones, public/private subnets,
 * and NAT gateways for Lambda outbound access.
 *
 * Requirements: 10.5 - Deploy across multiple AWS availability zones
 */
export class VpcConstruct extends Construct {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: VpcConstructProps) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, 'BotDetectionVpc', {
      maxAzs: 3,
      natGateways: 3,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
      flowLogs: {
        'VpcFlowLogs': {
          destination: ec2.FlowLogDestination.toCloudWatchLogs(),
          trafficType: ec2.FlowLogTrafficType.ALL,
        },
      },
    });

    cdk.Tags.of(this.vpc).add('Environment', props.environment);
    cdk.Tags.of(this.vpc).add('Project', 'RexellBotDetection');
  }
}
