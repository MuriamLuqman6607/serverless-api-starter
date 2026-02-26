import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto'; // ✅ FIXED: Use node:crypto

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// ✅ STRUCTURED LOGGING FUNCTION
const log = (level: string, message: string, data?: any) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    requestId: process.env.AWS_REQUEST_ID, // ✅ FIXED: process is now available
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
  
  log('INFO', 'Create user function invocation started', {
    httpMethod: event.httpMethod,
    path: event.path
  });

  try {
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.email || !body.name) {
      log('WARN', 'Missing required fields', { body });
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          error: 'Missing required fields: email and name are required' 
        })
      };
    }

    const userId = randomUUID();
    
    const user = {
      userId,
      email: body.email,
      name: body.name,
      createdAt: new Date().toISOString()
    };

    log('INFO', 'Creating user in DynamoDB', { 
      userId, 
      email: body.email,
      tableName: process.env.USERS_TABLE 
    });

    await docClient.send(new PutCommand({
      TableName: process.env.USERS_TABLE,
      Item: user
    }));

    log('INFO', 'User created successfully', { 
      userId,
      remainingTime: context.getRemainingTimeInMillis()
    });

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(user)
    };

  } catch (error) {
    log('ERROR', 'Create user function failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
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
