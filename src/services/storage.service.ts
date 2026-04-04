import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../config/aws';
import { Readable } from 'stream';

const S3_BUCKET = process.env.S3_BUCKET || 'devportal-attachments';

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3Client.send(command);
  console.info(`Arquivo enviado para S3: ${key}`);
  return key;
}

export async function downloadFile(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  const result = await s3Client.send(command);
  const stream = result.Body as Readable;

  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
