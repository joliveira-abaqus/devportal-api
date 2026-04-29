import { Message } from '@aws-sdk/client-sqs';

// Mock do Prisma
const mockPrismaRequestUpdate = jest.fn();
const mockPrismaRequestEventCreate = jest.fn();
jest.mock('../config/database', () => ({
  __esModule: true,
  default: {
    request: {
      update: (...args: unknown[]) => mockPrismaRequestUpdate(...args),
    },
    requestEvent: {
      create: (...args: unknown[]) => mockPrismaRequestEventCreate(...args),
    },
    $disconnect: jest.fn(),
  },
}));

// Mock do SQS client
const mockSqsSend = jest.fn();
jest.mock('../config/aws', () => ({
  sqsClient: {
    send: (...args: unknown[]) => mockSqsSend(...args),
  },
  s3Client: {},
}));

import { processMessage, pollMessages } from '../workers/request-processor';

describe('Request Processor Worker', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processMessage', () => {
    it('deve processar mensagem válida: atualiza status e cria eventos', async () => {
      mockPrismaRequestUpdate.mockResolvedValue({});
      mockPrismaRequestEventCreate.mockResolvedValue({});

      const message: Message = {
        MessageId: 'msg-1',
        Body: JSON.stringify({
          requestId: 'req-123',
          type: 'bug_fix',
          title: 'Fix bug',
          authorId: 'user-123',
        }),
        ReceiptHandle: 'receipt-1',
      };

      await processMessage(message);

      // Deve atualizar status para in_progress e depois review
      expect(mockPrismaRequestUpdate).toHaveBeenCalledTimes(2);
      expect(mockPrismaRequestUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-123' },
          data: { status: 'in_progress' },
        }),
      );
      expect(mockPrismaRequestUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-123' },
          data: { status: 'review' },
        }),
      );

      // Deve criar 2 requestEvent (status_change para in_progress e review)
      expect(mockPrismaRequestEventCreate).toHaveBeenCalledTimes(2);
      expect(mockPrismaRequestEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requestId: 'req-123',
            eventType: 'status_change',
            payload: { from: 'pending', to: 'in_progress' },
          }),
        }),
      );
      expect(mockPrismaRequestEventCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requestId: 'req-123',
            eventType: 'status_change',
            payload: { from: 'in_progress', to: 'review' },
          }),
        }),
      );
    }, 10000);

    it('deve ignorar mensagem sem Body sem erro', async () => {
      const message: Message = {
        MessageId: 'msg-2',
        ReceiptHandle: 'receipt-2',
      };

      await expect(processMessage(message)).resolves.toBeUndefined();
      expect(mockPrismaRequestUpdate).not.toHaveBeenCalled();
      expect(mockPrismaRequestEventCreate).not.toHaveBeenCalled();
    });

    it('deve lançar erro quando o Body contém JSON inválido', async () => {
      const message: Message = {
        MessageId: 'msg-3',
        Body: 'json-invalido{{{',
        ReceiptHandle: 'receipt-3',
      };

      await expect(processMessage(message)).rejects.toThrow();
    });
  });

  describe('pollMessages', () => {
    it('deve processar e deletar cada mensagem quando SQS retorna mensagens', async () => {
      mockPrismaRequestUpdate.mockResolvedValue({});
      mockPrismaRequestEventCreate.mockResolvedValue({});

      const messages: Message[] = [
        {
          MessageId: 'msg-a',
          Body: JSON.stringify({
            requestId: 'req-a',
            type: 'feature',
            title: 'Feature A',
            authorId: 'user-a',
          }),
          ReceiptHandle: 'receipt-a',
        },
        {
          MessageId: 'msg-b',
          Body: JSON.stringify({
            requestId: 'req-b',
            type: 'bug_fix',
            title: 'Bug B',
            authorId: 'user-b',
          }),
          ReceiptHandle: 'receipt-b',
        },
      ];

      // Primeira chamada retorna mensagens (ReceiveMessageCommand), demais chamadas para DeleteMessageCommand
      mockSqsSend
        .mockResolvedValueOnce({ Messages: messages })
        .mockResolvedValue({});

      await pollMessages();

      // ReceiveMessageCommand + 2 DeleteMessageCommand
      expect(mockSqsSend).toHaveBeenCalledTimes(3);
    }, 15000);

    it('não deve processar nada quando SQS retorna vazio', async () => {
      mockSqsSend.mockResolvedValue({ Messages: [] });

      await pollMessages();

      expect(mockSqsSend).toHaveBeenCalledTimes(1);
      expect(mockPrismaRequestUpdate).not.toHaveBeenCalled();
    });

    it('não deve processar nada quando SQS retorna sem Messages', async () => {
      mockSqsSend.mockResolvedValue({});

      await pollMessages();

      expect(mockSqsSend).toHaveBeenCalledTimes(1);
      expect(mockPrismaRequestUpdate).not.toHaveBeenCalled();
    });

    it('não deve quebrar quando SQS lança erro', async () => {
      mockSqsSend.mockRejectedValue(new Error('SQS unavailable'));

      await expect(pollMessages()).resolves.toBeUndefined();
    });

    it('não deve tentar deletar mensagem sem ReceiptHandle', async () => {
      mockPrismaRequestUpdate.mockResolvedValue({});
      mockPrismaRequestEventCreate.mockResolvedValue({});

      const messages: Message[] = [
        {
          MessageId: 'msg-no-receipt',
          Body: JSON.stringify({
            requestId: 'req-nr',
            type: 'feature',
            title: 'No Receipt',
            authorId: 'user-nr',
          }),
          // Sem ReceiptHandle
        },
      ];

      mockSqsSend.mockResolvedValueOnce({ Messages: messages });

      await pollMessages();

      // Apenas ReceiveMessageCommand, sem DeleteMessageCommand
      expect(mockSqsSend).toHaveBeenCalledTimes(1);
    }, 10000);

    it('erro em uma mensagem individual não deve impedir processamento das demais', async () => {
      mockPrismaRequestUpdate.mockResolvedValue({});
      mockPrismaRequestEventCreate.mockResolvedValue({});

      const messages: Message[] = [
        {
          MessageId: 'msg-fail',
          Body: 'json-invalido',
          ReceiptHandle: 'receipt-fail',
        },
        {
          MessageId: 'msg-ok',
          Body: JSON.stringify({
            requestId: 'req-ok',
            type: 'feature',
            title: 'OK Message',
            authorId: 'user-ok',
          }),
          ReceiptHandle: 'receipt-ok',
        },
      ];

      mockSqsSend
        .mockResolvedValueOnce({ Messages: messages })
        .mockResolvedValue({});

      await pollMessages();

      // A segunda mensagem deve ser processada e deletada mesmo que a primeira falhe
      // ReceiveMessageCommand + DeleteMessageCommand da segunda mensagem
      expect(mockPrismaRequestUpdate).toHaveBeenCalled();
    }, 15000);
  });
});
