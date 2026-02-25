import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  lambdaFunctions: lambda.Function[];
  apiGatewayName: string;
}

export class MonitoringStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // SNS Topic for alerts
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: 'serverless-api-alarms',
      displayName: 'Serverless API Alarms'
    });

    // Add email subscription (replace with your email)
    this.alarmTopic.addSubscription(
      new subscriptions.EmailSubscription('your-email@example.com')
    );

    // Create alarms for each Lambda function
    props.lambdaFunctions.forEach((func, index) => {
      this.createLambdaAlarms(func, index);
    });

    // Create API Gateway alarms
    this.createApiGatewayAlarms(props.apiGatewayName);

    // Create cost alarm
    this.createCostAlarm();
  }

  private createLambdaAlarms(lambdaFunction: lambda.Function, index: number) {
    // Error Rate Alarm
    new cloudwatch.Alarm(this, `LambdaErrorAlarm${index}`, {
      alarmName: `${lambdaFunction.functionName}-HighErrorRate`,
      alarmDescription: `High error rate for ${lambdaFunction.functionName}`,
      metric: lambdaFunction.metricErrors({
        period: cdk.Duration.minutes(5)
      }),
      threshold: 5,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    }).addAlarmAction(new cloudwatch.SnsAction(this.alarmTopic));

    // Duration Alarm
    new cloudwatch.Alarm(this, `LambdaDurationAlarm${index}`, {
      alarmName: `${lambdaFunction.functionName}-HighDuration`,
      alarmDescription: `High duration for ${lambdaFunction.functionName}`,
      metric: lambdaFunction.metricDuration({
        period: cdk.Duration.minutes(5)
      }),
      threshold: 10000, // 10 seconds
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    }).addAlarmAction(new cloudwatch.SnsAction(this.alarmTopic));

    // Throttle Alarm
    new cloudwatch.Alarm(this, `LambdaThrottleAlarm${index}`, {
      alarmName: `${lambdaFunction.functionName}-Throttles`,
      alarmDescription: `Throttles detected for ${lambdaFunction.functionName}`,
      metric: lambdaFunction.metricThrottles({
        period: cdk.Duration.minutes(5)
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
    }).addAlarmAction(new cloudwatch.SnsAction(this.alarmTopic));
  }

  private createApiGatewayAlarms(apiName: string) {
    // API Gateway 4XX Errors
    new cloudwatch.Alarm(this, 'ApiGateway4XXAlarm', {
      alarmName: `${apiName}-High4XXErrors`,
      alarmDescription: 'High 4XX error rate on API Gateway',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '4XXError',
        dimensionsMap: {
          ApiName: apiName
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Sum'
      }),
      threshold: 10,
      evaluationPeriods: 2
    }).addAlarmAction(new cloudwatch.SnsAction(this.alarmTopic));

    // API Gateway 5XX Errors
    new cloudwatch.Alarm(this, 'ApiGateway5XXAlarm', {
      alarmName: `${apiName}-High5XXErrors`,
      alarmDescription: 'High 5XX error rate on API Gateway',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: {
          ApiName: apiName
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Sum'
      }),
      threshold: 5,
      evaluationPeriods: 1
    }).addAlarmAction(new cloudwatch.SnsAction(this.alarmTopic));

    // API Gateway Latency
    new cloudwatch.Alarm(this, 'ApiGatewayLatencyAlarm', {
      alarmName: `${apiName}-HighLatency`,
      alarmDescription: 'High latency on API Gateway',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Latency',
       


