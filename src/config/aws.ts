import { S3Client } from '@aws-sdk/client-s3';
import { SQSClient } from '@aws-sdk/client-sqs';

const awsEndpoint = process.env.AWS_ENDPOINT || 'http://localhost:4566';
const awsRegion = process.env.AWS_REGION || 'us-east-1';

const commonConfig = {
  region: awsRegion,
  endpoint: awsEndpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
};

export const s3Client = new S3Client(commonConfig);
export const sqsClient = new SQSClient(commonConfig);
