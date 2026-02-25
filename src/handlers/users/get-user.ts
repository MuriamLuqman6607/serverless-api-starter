import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import AWSXRay from 'aws-xray-sdk-core';

// ✅ WRAP AWS SDK WITH X-RAY
const client = AWSXRay.captureAWSv3Client(new DynamoDBClient({}));
const docClient = DynamoDBDocumentClient.from(client);

// ✅ STRUCTURED LOGGING FUNCTION
const log = (level: string, message: string, data?: any) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    requestId: process.env.AWS_REQUEST_ID,
    functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
    functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
    ...(data && { data })
  };
  console.log(JSON.stringify(logEntry));
};

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  // ✅ LOG REQUEST START
  log('INFO', 'Function invocation started', {
    httpMethod: event.httpMethod,
    path: event.path,
    userId: event.pathParameters?.userId
  });

  try {
    const userId = event.pathParameters?.userId;
    
    if (!userId) {
      log('WARN', 'Missing userId parameter');
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'userId parameter is required' })
      };
    }

    // ✅ LOG DATABASE QUERY
    log('INFO', 'Querying DynamoDB', { userId, tableName: process.env.USERS_TABLE });

    const result = await docClient.send(new GetCommand({
      TableName: process.env.USERS_TABLE,
      Key: { userId }
    }));

    // ✅ LOG SUCCESSFUL RESPONSE
    log('INFO', 'Successfully retrieved user', { 
      userId, 
      found: !!result.Item,
      remainingTime: context.getRemainingTimeInMillis()
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result.Item || { message: 'User not found' })
    };

  } catch (error) {
    // ✅ LOG ERROR WITH DETAILS
    log('ERROR', 'Function execution failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: event.pathParameters?.userId
    });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        requestId: context.awsRequestId
      })
    };
  }
};
