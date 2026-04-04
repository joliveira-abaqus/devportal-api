import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { sqsClient } from '../config/aws';

const SQS_QUEUE_URL =
  process.env.SQS_QUEUE_URL || 'http://localhost:4566/000000000000/devportal-requests';

interface QueueMessage {
  requestId: string;
  type: string;
  title: string;
  authorId: string;
}

export async function sendToQueue(message: QueueMessage): Promise<string | undefined> {
  const command = new SendMessageCommand({
    QueueUrl: SQS_QUEUE_URL,
    MessageBody: JSON.stringify(message),
    MessageAttributes: {
      type: {
        DataType: 'String',
        StringValue: message.type,
      },
    },
  });

  const result = await sqsClient.send(command);
  console.info(`Mensagem enviada para SQS: ${result.MessageId}`);
  return result.MessageId;
}
