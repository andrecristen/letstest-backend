import path from 'path';
import request from 'supertest';
import app from '../index';

describe('File Router', () => {
    let token: string;

    beforeAll(async () => {
        // Registrar e autenticar um usuário para obter o token
        const currentDate = new Date();
        const email = `email${currentDate.toTimeString()}@test.com`;
        const password = "senha-de-teste";

        await request(app)
            .post('/api/users/register')
            .send({ name: 'Teste Criação', email: email, password: password });

        const authResponse = await request(app)
            .post('/api/users/auth')
            .send({ email: email, password: password });

        token = authResponse.body.token;
    });

    it('deve fazer upload de um arquivo', async () => {
        const filePath = path.join(__dirname, 'files', 'test-file.txt'); // Certifique-se de que o arquivo exista no caminho especificado

        const response = await request(app)
            .post('/api/file/upload')
            .set('Authorization', `Bearer ${token}`)
            .attach('file', filePath);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('url');
    });

    it('deve retornar 404 para um arquivo não encontrado', async () => {
        const response = await request(app)
            .get('/api/file/99999')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(404);
    });
});