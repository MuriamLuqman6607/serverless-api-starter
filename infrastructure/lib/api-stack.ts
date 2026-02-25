import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';

export class ApiStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props: any) {
    super(scope, id, props);

    // Lambda function
    const getUserFunction = new lambda.Function(this, 'GetUserFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'get-user.handler',
      code: lambda.Code.fromAsset('../src/handlers/users'),
      environment: {
        USERS_TABLE: props.usersTable.tableName
      }
    });

    // Grant DynamoDB permissions
    props.usersTable.grantReadData(getUserFunction);

    // HTTP API Gateway (cheaper than REST API)
    const httpApi = new apigatewayv2.HttpApi(this, 'ServerlessApi', {
      apiName: 'serverless-api-starter',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
        allowHeaders: ['*']
      }
    });

    // Add routes
    httpApi.addRoutes({
      path: '/users/{userId}',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetUserIntegration', getUserFunction)
    });
  }
}
