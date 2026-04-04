import { SendMessageCommand } from '@aws-sdk/client-sqs';

// Mock do SQS client
const mockSend = jest.fn();
jest.mock('../config/aws', () => ({
  sqsClient: {
    send: (...args: unknown[]) => mockSend(...args),
  },
  s3Client: {},
}));

import { sendToQueue } from '../services/queue.service';

describe('Queue Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve enviar mensagem para a fila SQS', async () => {
    mockSend.mockResolvedValue({ MessageId: 'test-message-id' });

    const result = await sendToQueue({
      requestId: 'req-123',
      type: 'bug_fix',
      title: 'Fix bug',
      authorId: 'user-123',
    });

    expect(result).toBe('test-message-id');
    expect(mockSend).toHaveBeenCalledTimes(1);

    const command = mockSend.mock.calls[0][0];
    expect(command).toBeInstanceOf(SendMessageCommand);
  });

  it('deve incluir atributos de mensagem com o tipo', async () => {
    mockSend.mockResolvedValue({ MessageId: 'test-message-id-2' });

    await sendToQueue({
      requestId: 'req-456',
      type: 'feature',
      title: 'New feature',
      authorId: 'user-456',
    });

    const command = mockSend.mock.calls[0][0];
    const input = command.input;
    expect(input.MessageAttributes.type.StringValue).toBe('feature');
  });

  it('deve propagar erros do SQS', async () => {
    mockSend.mockRejectedValue(new Error('SQS error'));

    await expect(
      sendToQueue({
        requestId: 'req-789',
        type: 'migration',
        title: 'Migration',
        authorId: 'user-789',
      }),
    ).rejects.toThrow('SQS error');
  });
});
