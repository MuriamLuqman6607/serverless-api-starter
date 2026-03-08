import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Reference existing DynamoDB Table
    const usersTable = dynamodb.Table.fromTableName(this, 'UsersTable', 'serverless-api-users');

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'serverless-api-users',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Updated UserPoolClient with enhanced auth flows and OAuth
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
        adminUserPassword: true,  // ✅ This enables ADMIN_NO_SRP_AUTH
        custom: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
      },
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

    // Updated Cognito Authorizer with explicit configuration
    const auth = new apigateway.CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
      authorizerName: 'CognitoAuthorizer',
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'ServerlessApi', {
      restApiName: 'serverless-api-starter',
      description: 'Serverless API for user management with Cognito auth',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    const users = api.root.addResource('users');
    
    // Protected endpoints with explicit authorization type
    users.addMethod('POST', new apigateway.LambdaIntegration(createUserFunction), {
      authorizer: auth,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const userById = users.addResource('{userId}');
    userById.addMethod('GET', new apigateway.LambdaIntegration(getUserFunction), {
      authorizer: auth,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Public endpoint for testing (no auth required)
    const health = api.root.addResource('health');
    health.addMethod('GET', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseTemplates: {
          'application/json': '{"status": "healthy", "timestamp": "$context.requestTime"}'
        }
      }],
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      }
    }), {
      methodResponses: [{
        statusCode: '200',
        responseModels: {
          'application/json': apigateway.Model.EMPTY_MODEL
        }
      }]
    });

    // CloudWatch Alarms
    const errorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
      alarmName: 'serverless-api-lambda-errors',
      metric: createUserFunction.metricErrors(),
      threshold: 5,
      evaluationPeriods: 2,
      alarmDescription: 'Lambda function error rate is too high'
    });

    // CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'ApiDashboard', {
      dashboardName: 'serverless-api-dashboard',
      widgets: [
        [
          new cloudwatch.GraphWidget({
            title: 'API Gateway Requests',
            left: [api.metricCount()],
            width: 12,
          }),
          new cloudwatch.GraphWidget({
            title: 'API Gateway Latency',
            left: [api.metricLatency()],
            width: 12,
          }),
        ],
        [
          new cloudwatch.GraphWidget({
            title: 'Lambda Invocations',
            left: [createUserFunction.metricInvocations(), getUserFunction.metricInvocations()],
            width: 12,
          }),
          new cloudwatch.GraphWidget({
            title: 'Lambda Errors',
            left: [createUserFunction.metricErrors(), getUserFunction.metricErrors()],
            width: 12,
          }),
        ],
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });

    new cdk.CfnOutput(this, 'ServerlessApiEndpoint', {
      value: api.url,
    });

    // Add dashboard URL to outputs
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
    });
  }
}
