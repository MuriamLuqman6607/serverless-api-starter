# Serverless User Management API

A production-ready serverless REST API built with AWS CDK, Lambda, DynamoDB, and API Gateway.

## 🚀 Live API Endpoints

**Base URL:** `https://ww3w89j11c.execute-api.ap-east-1.amazonaws.com/prod`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/users` | Create a new user |
| GET | `/users/{userId}` | Get user by ID |

## 📋 API Documentation

### Create User
```bash
POST /users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}

Response:

{
  "userId": "32d97b99-2e6b-4fcc-a18d-3360af47d72e",
  "name": "John Doe",
  "email": "john@example.com",
  "createdAt": "2026-03-02T13:50:53.149Z"
}

🏗️ Architecture
AWS Lambda - Serverless compute
Amazon DynamoDB - NoSQL database
API Gateway - REST API management
AWS CDK - Infrastructure as Code
CloudWatch - Monitoring and logging
🛠️ Technologies Used
TypeScript/JavaScript
AWS CDK
AWS Lambda
Amazon DynamoDB
API Gateway
Node.js 18.x
📊 Features
✅ RESTful API design ✅ CORS enabled ✅ Error handling ✅ Input validation ✅ Serverless architecture ✅ Infrastructure as Code ✅ Production-ready logging
