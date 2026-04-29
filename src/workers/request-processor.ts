import dotenv from 'dotenv';
dotenv.config();

import {
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message,
} from '@aws-sdk/client-sqs';
import { sqsClient } from '../config/aws';
import prisma from '../config/database';

const SQS_QUEUE_URL =
  process.env.SQS_QUEUE_URL || 'http://localhost:4566/000000000000/devportal-requests';
const POLL_INTERVAL = 5000; // 5 segundos

interface RequestMessage {
  requestId: string;
  type: string;
  title: string;
  authorId: string;
}

export async function processMessage(message: Message): Promise<void> {
  if (!message.Body) {
    console.warn('Mensagem SQS sem body, ignorando.');
    return;
  }

  const payload: RequestMessage = JSON.parse(message.Body);
  console.info(`Processando solicitação: ${payload.requestId} (${payload.type})`);

  // Atualiza status para in_progress
  await prisma.request.update({
    where: { id: payload.requestId },
    data: { status: 'in_progress' },
  });

  await prisma.requestEvent.create({
    data: {
      requestId: payload.requestId,
      eventType: 'status_change',
      payload: { from: 'pending', to: 'in_progress' },
    },
  });

  // Simula processamento (em produção, aqui seria a integração com Devin ou outro serviço)
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Atualiza status para review
  await prisma.request.update({
    where: { id: payload.requestId },
    data: { status: 'review' },
  });

  await prisma.requestEvent.create({
    data: {
      requestId: payload.requestId,
      eventType: 'status_change',
      payload: { from: 'in_progress', to: 'review' },
    },
  });

  console.info(`Solicitação ${payload.requestId} processada com sucesso.`);
}

export async function pollMessages(): Promise<void> {
  const command = new ReceiveMessageCommand({
    QueueUrl: SQS_QUEUE_URL,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 20,
  });

  try {
    const response = await sqsClient.send(command);

    if (response.Messages && response.Messages.length > 0) {
      for (const message of response.Messages) {
        try {
          await processMessage(message);

          // Remove mensagem da fila após processamento
          if (message.ReceiptHandle) {
            await sqsClient.send(
              new DeleteMessageCommand({
                QueueUrl: SQS_QUEUE_URL,
                ReceiptHandle: message.ReceiptHandle,
              }),
            );
          }
        } catch (err) {
          console.error(`Erro ao processar mensagem ${message.MessageId}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('Erro ao buscar mensagens do SQS:', err);
  }
}

export async function startWorker(): Promise<void> {
  console.info('Worker de processamento de solicitações iniciado.');
  console.info(`Polling da fila: ${SQS_QUEUE_URL}`);

  for (;;) {
    await pollMessages();
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

// Inicia o worker apenas quando executado diretamente
if (require.main === module) {
  startWorker().catch((err) => {
    console.error('Erro fatal no worker:', err);
    process.exit(1);
  });
}
