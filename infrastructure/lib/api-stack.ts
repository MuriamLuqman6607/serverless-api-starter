import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface ApiStackProps extends cdk.StackProps {
  usersTable: any;
  userPool: any;
}

export class ApiStack extends cdk.Stack {
  public readonly lambdaFunctions: lambda.Function[] = [];
  public readonly httpApi: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // ✅ CREATE LOG GROUPS FOR LAMBDA FUNCTIONS
    const getUserLogGroup = new logs.LogGroup(this, 'GetUserLogGroup', {
      logGroupName: '/aws/lambda/serverless-api-get-user',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const createUserLogGroup = new logs.LogGroup(this, 'CreateUserLogGroup', {
      logGroupName: '/aws/lambda/serverless-api-create-user',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // ✅ LAMBDA FUNCTIONS WITH ENHANCED LOGGING
    const getUserFunction = new lambda.Function(this, 'GetUserFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'get-user.handler',
      code: lambda.Code.fromAsset('../src/handlers/users'),
      environment: {
        USERS_TABLE: props.usersTable.tableName,
        LOG_LEVEL: 'INFO'
      },
      logGroup: getUserLogGroup,
      // ✅ ENABLE X-RAY TRACING
      tracing: lambda.Tracing.ACTIVE,
      // ✅ SET TIMEOUT
      timeout: cdk.Duration.seconds(30),
      // ✅ MEMORY CONFIGURATION
      memorySize: 256,
      // ✅ ARM ARCHITECTURE FOR COST SAVINGS
      architecture: lambda.Architecture.ARM_64
    });

    const createUserFunction = new lambda.Function(this, 'CreateUserFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'create-user.handler',
      code: lambda.Code.fromAsset('../src/handlers/users'),
      environment: {
        USERS_TABLE: props.usersTable.tableName,
        LOG_LEVEL: 'INFO'
      },
      logGroup: createUserLogGroup,
      tracing: lambda.Tracing.ACTIVE,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      architecture: lambda.Architecture.ARM_64
    });

    // ✅ ADD TO FUNCTIONS ARRAY FOR MONITORING
    this.lambdaFunctions.push(getUserFunction, createUserFunction);

    // Grant DynamoDB permissions
    props.usersTable.grantReadData(getUserFunction);
    props.usersTable.grantWriteData(createUserFunction);

    // ✅ CREATE API GATEWAY ACCESS LOG GROUP
    const apiLogGroup = new logs.LogGroup(this, 'ApiGatewayLogGroup', {
      logGroupName: '/aws/apigateway/serverless-api-starter',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // ✅ HTTP API GATEWAY WITH LOGGING
    this.httpApi = new apigatewayv2.HttpApi(this, 'ServerlessApi', {
      apiName: 'serverless-api-starter',
      description: 'Serverless API Starter with monitoring',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
        allowHeaders: ['*']
      }
    });

    // ✅ CREATE API GATEWAY STAGE WITH LOGGING
    const stage = new apigatewayv2.HttpStage(this, 'ApiStage', {
      httpApi: this.httpApi,
      stageName: 'prod',
      autoDeploy: true,
      accessLogSettings: {
        destinationArn: apiLogGroup.logGroupArn,
        format: JSON.stringify({
          requestId: '$context.requestId',
          ip: '$context.identity.sourceIp',
          requestTime: '$context.requestTime',
          httpMethod: '$context.httpMethod',
          routeKey: '$context.routeKey',
          status: '$context.status',
          protocol: '$context.protocol',
          responseLength: '$context.responseLength',
          error: '$context.error.message',
          integrationError: '$context.integrationErrorMessage'
        })
      }
    });

    // Add routes
    this.httpApi.addRoutes({
      path: '/users/{userId}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetUserIntegration', getUserFunction)
    });

    this.httpApi.addRoutes({
      path: '/users',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('CreateUserIntegration', createUserFunction)
    });

    // ✅ OUTPUT API URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.httpApi.url!,
      description: 'HTTP API Gateway URL'
    });
  }
}
