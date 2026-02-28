"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const node_crypto_1 = require("node:crypto"); // ✅ FIXED: Use node:crypto
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
// ✅ STRUCTURED LOGGING FUNCTION
const log = (level, message, data) => {
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
const handler = async (event, context) => {
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
        const userId = (0, node_crypto_1.randomUUID)();
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
        await docClient.send(new lib_dynamodb_1.PutCommand({
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
    }
    catch (error) {
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
exports.handler = handler;
