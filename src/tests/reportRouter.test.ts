import request from 'supertest';
import app from '../index';

describe('Report Router', () => {
    let token: string;
    let testExecutionId: number = 12; // Substituir pelo ID de uma execução de teste válida para os testes
    let reportId: number;

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

    it('deve buscar um relatório por ID', async () => {
        const response = await request(app)
            .get(`/api/report/${reportId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', reportId);
    });

    it('deve buscar relatórios por execução de teste', async () => {
        const response = await request(app)
            .get(`/api/report/test-execution/${testExecutionId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
    });

    it('deve criar um novo relatório', async () => {
        const response = await request(app)
            .post(`/api/report/${testExecutionId}`)
            .send({ type: 1, score: 10, commentary: 'Perfeito' })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        reportId = response.body.id;
    });

    it('deve retornar 404 para um relatório não encontrado', async () => {
        const response = await request(app)
            .get('/api/report/99999')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(404);
    });
});
