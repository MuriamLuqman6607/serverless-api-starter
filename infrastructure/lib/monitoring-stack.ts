import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions'; // ✅ ADD THIS LINE
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
      new subscriptions.EmailSubscription('luqmanmuriam@gmail.com')
    );

    // Create alarms for each Lambda function
    props.lambdaFunctions.forEach((func, index) => {
      this.createLambdaAlarms(func, index);
    });

    // Create API Gateway alarms
    this.createApiGatewayAlarms(props.apiGatewayName);

    // Create cost alarm
    this.createCostAlarm();

    // ✅ CREATE CLOUDWATCH DASHBOARD
    this.createDashboard(props.lambdaFunctions, props.apiGatewayName);
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
    }).addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

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
    }).addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

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
    }).addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
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
        ApiName: apiName,
        Stage: 'prod' // ✅ ADD STAGE DIMENSION
      },
      period: cdk.Duration.minutes(5),
      statistic: 'Sum'
    }),
    threshold: 10,
    evaluationPeriods: 2
  }).addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

  // API Gateway 5XX Errors
  new cloudwatch.Alarm(this, 'ApiGateway5XXAlarm', {
    alarmName: `${apiName}-High5XXErrors`,
    alarmDescription: 'High 5XX error rate on API Gateway',
    metric: new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: '5XXError',
      dimensionsMap: {
        ApiName: apiName,
        Stage: 'prod' // ✅ ADD STAGE DIMENSION
      },
      period: cdk.Duration.minutes(5),
      statistic: 'Sum'
    }),
    threshold: 5,
    evaluationPeriods: 1
  }).addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));

  // API Gateway Latency
  new cloudwatch.Alarm(this, 'ApiGatewayLatencyAlarm', {
    alarmName: `${apiName}-HighLatency`,
    alarmDescription: 'High latency on API Gateway',
    metric: new cloudwatch.Metric({
      namespace: 'AWS/ApiGateway',
      metricName: 'Latency',
      dimensionsMap: {
        ApiName: apiName,
        Stage: 'prod' // ✅ ADD STAGE DIMENSION
      },
      period: cdk.Duration.minutes(5),
      statistic: 'Average'
    }),
    threshold: 2000, // 2 seconds
    evaluationPeriods: 3
  }).addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
}


  private createCostAlarm() {
    // Monthly cost alarm to stay within $20 budget
    new cloudwatch.Alarm(this, 'MonthlyCostAlarm', {
      alarmName: 'ServerlessAPI-MonthlyCostAlert',
      alarmDescription: 'Monthly cost approaching $20 limit',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Billing',
        metricName: 'EstimatedCharges',
        dimensionsMap: {
          Currency: 'USD'
        },
        period: cdk.Duration.hours(6),
        statistic: 'Maximum'
      }),
      threshold: 15, // Alert at $15 to stay under $20
      evaluationPeriods: 1
    }).addAlarmAction(new cloudwatchActions.SnsAction(this.alarmTopic));
  }

  // ✅ COMPLETE CLOUDWATCH DASHBOARD METHOD
  private createDashboard(lambdaFunctions: lambda.Function[], apiName: string) {
    const dashboard = new cloudwatch.Dashboard(this, 'ServerlessApiDashboard', {
      dashboardName: 'ServerlessAPI-Monitoring',
      periodOverride: cloudwatch.PeriodOverride.AUTO
    });

    // Row 1: API Gateway Overview
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: '🌐 API Gateway - Request Count',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Count',
            dimensionsMap: { ApiName: apiName },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5)
          })
        ],
        width: 8,
        height: 6,
        view: cloudwatch.GraphWidgetView.TIME_SERIES,
        stacked: false
      }),
      new cloudwatch.GraphWidget({
        title: '🚨 API Gateway - Error Rates',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '4XXError',
            dimensionsMap: { ApiName: apiName },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            label: '4XX Errors'
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '5XXError',
            dimensionsMap: { ApiName: apiName },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            label: '5XX Errors'
          })
        ],
        width: 8,
        height: 6,
        view: cloudwatch.GraphWidgetView.TIME_SERIES
      }),
      new cloudwatch.GraphWidget({
        title: '⏱️ API Gateway - Latency',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Latency',
            dimensionsMap: { ApiName: apiName },
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
            label: 'Average Latency'
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Latency',
            dimensionsMap: { ApiName: apiName },
            statistic: 'p99',
            period: cdk.Duration.minutes(5),
            label: 'P99 Latency'
          })
        ],
        width: 8,
        height: 6,
        view: cloudwatch.GraphWidgetView.TIME_SERIES
      })
    );

    // Row 2: Lambda Functions Overview
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: '⚡ Lambda - Invocations',
        left: lambdaFunctions.map(func => 
          func.metricInvocations({
            period: cdk.Duration.minutes(5),
            label: func.functionName
          })
        ),
        width: 8,
        height: 6,
        view: cloudwatch.GraphWidgetView.TIME_SERIES,
        stacked: false
      }),
      new cloudwatch.GraphWidget({
        title: '❌ Lambda - Errors',
        left: lambdaFunctions.map(func => 
          func.metricErrors({
            period: cdk.Duration.minutes(5),
            label: `${func.functionName} Errors`
          })
        ),
        width: 8,
        height: 6,
        view: cloudwatch.GraphWidgetView.TIME_SERIES
      }),
      new cloudwatch.GraphWidget({
        title: '🕐 Lambda - Duration',
        left: lambdaFunctions.map(func => 
          func.metricDuration({
            period: cdk.Duration.minutes(5),
            statistic: 'Average',
            label: `${func.functionName} Avg Duration`
          })
        ),
        right: lambdaFunctions.map(func => 
          func.metricDuration({
            period: cdk.Duration.minutes(5),
            statistic: 'p99',
            label: `${func.functionName} P99 Duration`
          })
        ),
        width: 8,
        height: 6,
        view: cloudwatch.GraphWidgetView.TIME_SERIES
      })
    );

    // Row 3: Lambda Performance Details
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: '🔥 Lambda - Throttles & Concurrent Executions',
        left: lambdaFunctions.map(func => 
          func.metricThrottles({
            period: cdk.Duration.minutes(5),
            label: `${func.functionName} Throttles`
          })
        ),
        right: [
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'ConcurrentExecutions',
            statistic: 'Maximum',
            period: cdk.Duration.minutes(5),
            label: 'Concurrent Executions'
          })
        ],
        width: 12,
        height: 6,
        view: cloudwatch.GraphWidgetView.TIME_SERIES
      }),
      new cloudwatch.GraphWidget({
        title: '🧠 Lambda - Memory Utilization',
        left: lambdaFunctions.map(func => 
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Duration',
            dimensionsMap: { FunctionName: func.functionName },
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
            label: `${func.functionName} Memory Usage`
          })
        ),
        width: 12,
        height: 6,
        view: cloudwatch.GraphWidgetView.TIME_SERIES
      })
    );

    // Row 4: DynamoDB Metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: '🗄️ DynamoDB - Read/Write Capacity',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedReadCapacityUnits',
            dimensionsMap: { TableName: 'serverless-api-users' },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            label: 'Read Capacity Units'
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedWriteCapacityUnits',
            dimensionsMap: { TableName: 'serverless-api-users' },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            label: 'Write Capacity Units'
          })
        ],
        width: 8,
        height: 6,
        view: cloudwatch.GraphWidgetView.TIME_SERIES
      }),
      new cloudwatch.GraphWidget({
        title: '⚠️ DynamoDB - Throttles & Errors',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ReadThrottles',
            dimensionsMap: { TableName: 'serverless-api-users' },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            label: 'Read Throttles'
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'WriteThrottles',
            dimensionsMap: { TableName: 'serverless-api-users' },
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            label: 'Write Throttles'
          })
        ],
        width: 8,
        height: 6,
        view: cloudwatch.GraphWidgetView.TIME_SERIES
      }),

      new cloudwatch.GraphWidget({
        title: '💰 Estimated Monthly Cost',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/Billing',
            metricName: 'EstimatedCharges',
            dimensionsMap: { Currency: 'USD' },
            statistic: 'Maximum',
            period: cdk.Duration.hours(6),
            label: 'Total Estimated Charges'
          })
        ],
        width: 8,
        height: 6,
        view: cloudwatch.GraphWidgetView.TIME_SERIES,
        leftYAxis: {
          min: 0,
          max: 25
        }
      })

    );

    // Row 5: System Health Summary
    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: '📊 API Health Summary',
        metrics: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: 'Count',
            dimensionsMap: { ApiName: apiName },
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
            label: 'Total Requests (1h)'
          })
        ],
        width: 6,
        height: 6
      }),
      new cloudwatch.SingleValueWidget({
        title: '⚡ Lambda Invocations',
        metrics: lambdaFunctions.map(func => 
          func.metricInvocations({
            period: cdk.Duration.hours(1),
            statistic: 'Sum',
            label: `${func.functionName} (1h)`
          })
        ),
        width: 6,
        height: 6
      }),
      new cloudwatch.SingleValueWidget({
        title: '❌ Error Count (24h)',
        metrics: [
          ...lambdaFunctions.map(func => 
            func.metricErrors({
              period: cdk.Duration.hours(24),
              statistic: 'Sum',
              label: `${func.functionName} Errors`
            })
          ),
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '5XXError',
            dimensionsMap: { ApiName: apiName },
            statistic: 'Sum',
            period: cdk.Duration.hours(24),
            label: 'API 5XX Errors'
          })
        ],
        width: 6,
        height: 6
      }),
      new cloudwatch.SingleValueWidget({
        title: '💵 Current Month Cost',
        metrics: [
          new cloudwatch.Metric({
            namespace: 'AWS/Billing',
            metricName: 'EstimatedCharges',
            dimensionsMap: { Currency: 'USD' },
            statistic: 'Maximum',
            period: cdk.Duration.hours(6),
            label: 'USD'
          })
        ],
        width: 6,
        height: 6
      })
    );

    // Output dashboard URL
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL'
    });
  }
}
