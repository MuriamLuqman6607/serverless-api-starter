import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export class DatabaseStack extends cdk.Stack {
  public readonly usersTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ✅ DYNAMODB TABLE WITH MONITORING
    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'serverless-api-users',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.ON_DEMAND,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      // ✅ ENABLE POINT-IN-TIME RECOVERY
      pointInTimeRecovery: true,
      // ✅ ENABLE DELETION PROTECTION FOR PRODUCTION
      deletionProtection: false // Set to true in production
    });

    // ✅ ADD GLOBAL SECONDARY INDEX FOR QUERIES
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING }
    });

    // ✅ CREATE DYNAMODB ALARMS
    new cloudwatch.Alarm(this, 'DynamoDBReadThrottleAlarm', {
      alarmName: 'DynamoDB-ReadThrottles',
      alarmDescription: 'DynamoDB read throttles detected',
      metric: this.usersTable.metricUserErrors(),
      threshold: 1,
      evaluationPeriods: 2
    });

    new cloudwatch.Alarm(this, 'DynamoDBWriteThrottleAlarm', {
      alarmName: 'DynamoDB-WriteThrottles',
      alarmDescription: 'DynamoDB write throttles detected',
      metric: this.usersTable.metricSystemErrors(),
      threshold: 1,
      evaluationPeriods: 2
    });
  }
}
