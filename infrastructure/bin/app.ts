#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { AuthStack } from '../lib/auth-stack';
import { ApiStack } from '../lib/api-stack';
import { MonitoringStack } from '../lib/monitoring-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'ap-east-1' // ✅ Your region
};

// Create stacks in dependency order
const databaseStack = new DatabaseStack(app, 'DatabaseStack', { env });

const authStack = new AuthStack(app, 'AuthStack', { env });

const apiStack = new ApiStack(app, 'ApiStack', {
  env,
  usersTable: databaseStack.usersTable,
  userPool: authStack.userPool
});

const monitoringStack = new MonitoringStack(app, 'MonitoringStack', {
  env,
  lambdaFunctions: apiStack.lambdaFunctions,
  apiGatewayName: 'serverless-api-starter'
});

monitoringStack.addDependency(apiStack);
monitoringStack.addDependency(databaseStack);

