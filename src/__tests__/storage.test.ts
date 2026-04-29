import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// Mock do cliente AWS
const mockSend = jest.fn();
jest.mock('../config/aws', () => ({
  s3Client: {
    send: (...args: unknown[]) => mockSend(...args),
  },
  sqsClient: {},
}));

import { uploadFile, downloadFile } from '../services/storage.service';

describe('Storage Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('deve fazer upload com sucesso e retornar a key', async () => {
      mockSend.mockResolvedValue({});

      const key = await uploadFile('test-key.pdf', Buffer.from('conteudo'), 'application/pdf');

      expect(key).toBe('test-key.pdf');
      expect(mockSend).toHaveBeenCalledTimes(1);

      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input.Key).toBe('test-key.pdf');
      expect(command.input.ContentType).toBe('application/pdf');
    });

    it('deve propagar exceção quando o S3 falha', async () => {
      mockSend.mockRejectedValue(new Error('Bucket inexistente'));

      await expect(
        uploadFile('test-key.pdf', Buffer.from('conteudo'), 'application/pdf'),
      ).rejects.toThrow('Bucket inexistente');
    });
  });

  describe('downloadFile', () => {
    it('deve fazer download com sucesso e retornar Buffer', async () => {
      const conteudo = Buffer.from('conteudo do arquivo');
      const stream = Readable.from([conteudo]);

      mockSend.mockResolvedValue({ Body: stream });

      const result = await downloadFile('test-key.pdf');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('conteudo do arquivo');
      expect(mockSend).toHaveBeenCalledTimes(1);

      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input.Key).toBe('test-key.pdf');
    });

    it('deve propagar exceção quando o arquivo não é encontrado no S3', async () => {
      mockSend.mockRejectedValue(new Error('NoSuchKey'));

      await expect(downloadFile('arquivo-inexistente.pdf')).rejects.toThrow('NoSuchKey');
    });
  });
});
