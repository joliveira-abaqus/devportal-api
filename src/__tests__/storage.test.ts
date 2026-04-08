import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

// Mock do S3 client
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

      const key = 'attachments/test-file.pdf';
      const body = Buffer.from('conteúdo do arquivo');
      const contentType = 'application/pdf';

      const result = await uploadFile(key, body, contentType);

      expect(result).toBe(key);
      expect(mockSend).toHaveBeenCalledTimes(1);

      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input.Key).toBe(key);
      expect(command.input.ContentType).toBe(contentType);
    });

    it('deve propagar erro quando o upload falha', async () => {
      mockSend.mockRejectedValue(new Error('S3 upload error'));

      await expect(
        uploadFile('attachments/fail.pdf', Buffer.from('dados'), 'application/pdf'),
      ).rejects.toThrow('S3 upload error');
    });
  });

  describe('downloadFile', () => {
    it('deve fazer download com sucesso e retornar Buffer correto', async () => {
      const fileContent = 'conteúdo do arquivo para download';
      const readable = Readable.from([Buffer.from(fileContent)]);

      mockSend.mockResolvedValue({ Body: readable });

      const result = await downloadFile('attachments/test-file.pdf');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe(fileContent);
      expect(mockSend).toHaveBeenCalledTimes(1);

      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input.Key).toBe('attachments/test-file.pdf');
    });

    it('deve propagar erro quando o download falha', async () => {
      mockSend.mockRejectedValue(new Error('NoSuchKey: arquivo não encontrado'));

      await expect(downloadFile('attachments/inexistente.pdf')).rejects.toThrow(
        'NoSuchKey: arquivo não encontrado',
      );
    });
  });
});
