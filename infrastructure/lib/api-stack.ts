import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'serverless-api-users',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda Functions
    const createUserFunction = new lambda.Function(this, 'CreateUserFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('../src'),
      handler: 'handlers/users/create-user.handler',
      environment: {
        USERS_TABLE: usersTable.tableName,
        LOG_LEVEL: 'INFO'
      },
      timeout: cdk.Duration.seconds(30)
    });

    const getUserFunction = new lambda.Function(this, 'GetUserFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('../src'),
      handler: 'handlers/users/get-user.handler',
      environment: {
        USERS_TABLE: usersTable.tableName,
        LOG_LEVEL: 'INFO'
      },
      timeout: cdk.Duration.seconds(30)
    });

    // Grant permissions
    usersTable.grantReadWriteData(createUserFunction);
    usersTable.grantReadData(getUserFunction);

    // API Gateway
    const api = new apigateway.RestApi(this, 'ServerlessApi', {
      restApiName: 'serverless-api-starter',
      description: 'Serverless API for user management',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    const users = api.root.addResource('users');
    users.addMethod('POST', new apigateway.LambdaIntegration(createUserFunction));

    const userById = users.addResource('{userId}');
    userById.addMethod('GET', new apigateway.LambdaIntegration(getUserFunction));

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
    });

    new cdk.CfnOutput(this, 'ServerlessApiEndpoint', {
      value: api.url,
    });

    // Export function names for reference
    new cdk.CfnOutput(this, 'CreateUserFunctionName', {
      value: createUserFunction.functionName,
      exportName: 'CreateUserFunctionName'
    });

    new cdk.CfnOutput(this, 'GetUserFunctionName', {
      value: getUserFunction.functionName,
      exportName: 'GetUserFunctionName'
    });
  }
}
