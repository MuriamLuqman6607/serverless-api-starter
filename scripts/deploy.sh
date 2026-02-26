#!/bin/bash
set -e

echo "🚀 Deploying Serverless API Starter with Monitoring..."

# Install dependencies
echo "📦 Installing dependencies..."
cd infrastructure
npm install

cd ../src
npm install

# Build Lambda functions
echo "🔨 Building Lambda functions..."
npx tsc

# Deploy infrastructure
echo "🏗️ Deploying infrastructure..."
cd ../infrastructure

# Bootstrap CDK (run once per account/region)
cdk bootstrap

# Build and deploy all stacks
npm run build
cdk deploy --all --require-approval never

echo "✅ Deployment complete!"
echo ""
echo "📊 Monitoring Dashboard: https://console.aws.amazon.com/cloudwatch/home#dashboards:"
echo "🔔 SNS Topic created for alerts - check your email for subscription confirmation"
echo "📋 API Gateway URL: $(aws cloudformation describe-stacks --stack-name ApiStack --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text 2>/dev/null || echo 'Check AWS Console')"
echo ""
echo "🎯 Next Steps:"
echo "1. Confirm SNS email subscription"
echo "2. Test API endpoints"
echo "3. Check CloudWatch logs and metrics"
