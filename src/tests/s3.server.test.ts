import { uploadToS3 } from '../utils/s3.server';

describe('S3 Server', () => {
    let fileName: string;
    let fileContent: Buffer;
    let fileUrl: boolean;

    beforeAll(() => {
        fileName = 'test-file.txt';
        fileContent = Buffer.from('Conteúdo do arquivo de teste', 'utf-8');
    });

    it('deve fazer upload de um arquivo para o S3', async () => {
        fileUrl = await uploadToS3(fileName, fileContent, 'text/txt');
        expect(fileUrl).toBeDefined();
        expect(fileUrl).toBe(true);
    });

});