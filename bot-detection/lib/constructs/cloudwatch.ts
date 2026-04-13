import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export interface CloudWatchConstructProps {
  /** Environment name */
  environment: string;
}

/**
 * CloudWatch metrics, alarms, and dashboards for bot detection.
 * 
 * Requirements: 11.2 - Comprehensive monitoring and alerting
 */
export class CloudWatchConstruct extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly namespace: string = 'RexellBotDetection';

  constructor(scope: Construct, id: string, props: CloudWatchConstructProps) {
    super(scope, id);

    // ── Metrics ──────────────────────────────────────────────────────

    // Detection Latency (p95)
    const detectionLatency = new cloudwatch.Metric({
      namespace: this.namespace,
      metricName: 'DetectionLatency',
      dimensionsMap: { Environment: props.environment },
      statistic: 'p95',
      period: cdk.Duration.minutes(1),
    });

    // Risk Score Distribution
    const riskScore = new cloudwatch.Metric({
      namespace: this.namespace,
      metricName: 'RiskScore',
      dimensionsMap: { Environment: props.environment },
      statistic: 'Average',
      period: cdk.Duration.minutes(1),
    });

    // Challenge Success Rate
    const challengePassed = new cloudwatch.Metric({
      namespace: this.namespace,
      metricName: 'ChallengeStatus',
      dimensionsMap: { Environment: props.environment, Status: 'SOLVED' },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const challengeIssued = new cloudwatch.Metric({
      namespace: this.namespace,
      metricName: 'ChallengeStatus',
      dimensionsMap: { Environment: props.environment, Status: 'ISSUED' },
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // ── Alarms ───────────────────────────────────────────────────────

    // High Latency Alarm
    new cloudwatch.Alarm(this, 'HighLatencyAlarm', {
      metric: detectionLatency,
      threshold: 500, // 500ms
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmDescription: 'Detection latency is higher than 500ms (p95) for 2 out of 3 periods',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // High Error Rate Alarm (simulated via status code metric from API GW later, 
    // but here we can set a placeholder or use Lambda Errors)
    // We'll add Lambda alarms when Lambdas are created in Task 5+

    // ── Dashboard ────────────────────────────────────────────────────

    this.dashboard = new cloudwatch.Dashboard(this, 'BotDetectionDashboard', {
      dashboardName: `RexellBotDetection-${props.environment}`,
    });

    this.dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Avg Risk Score',
        metrics: [riskScore],
        width: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Detection Latency (p95)',
        left: [detectionLatency],
        width: 18,
      })
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Challenge Success vs Issued',
        left: [challengeIssued, challengePassed],
        width: 24,
      })
    );
  }
}
