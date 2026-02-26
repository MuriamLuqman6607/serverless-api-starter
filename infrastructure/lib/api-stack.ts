import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway'; // ✅ USE REST API (STABLE)
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface ApiStackProps extends cdk.StackProps {
  usersTable: any;
  userPool: any;
}

export class ApiStack extends cdk.Stack {
  public readonly lambdaFunctions: lambda.Function[] = [];
  public readonly restApi: apigateway.RestApi;

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
      tracing: lambda.Tracing.ACTIVE,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
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

    // ✅ REST API GATEWAY (STABLE VERSION)
    this.restApi = new apigateway.RestApi(this, 'ServerlessApi', {
      restApiName: 'serverless-api-starter',
      description: 'Serverless API Starter with monitoring',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['*']
      },
      deployOptions: {
        stageName: 'prod',
        accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: false,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true
        })
      }
    });

    // ✅ CREATE API RESOURCES AND METHODS
    const usersResource = this.restApi.root.addResource('users');
    
    // GET /users/{userId}
    const userResource = usersResource.addResource('{userId}');
    userResource.addMethod('GET', new apigateway.LambdaIntegration(getUserFunction));
    
    // POST /users
    usersResource.addMethod('POST', new apigateway.LambdaIntegration(createUserFunction));

    // ✅ OUTPUT API URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.restApi.url,
      description: 'REST API Gateway URL'
    });
  }
}
