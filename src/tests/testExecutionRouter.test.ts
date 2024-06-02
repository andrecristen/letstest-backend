import request from 'supertest';
import app from '../index';

describe('Test Execution Router', () => {
    let token: string;
    let testCaseId: number = 1; // Substituir pelo ID de um caso de teste válido
    let testExecutionId: number;

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

    it('deve buscar uma execução de teste por ID', async () => {
        const response = await request(app)
            .get(`/api/test-execution/${testExecutionId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', testExecutionId);
    });

    it('deve buscar todas as execuções de teste de um caso de teste', async () => {
        const response = await request(app)
            .get(`/api/test-execution/test-case/${testCaseId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
    });

    it('deve buscar minhas execuções de teste de um caso de teste', async () => {
        const response = await request(app)
            .get(`/api/test-execution/test-case/${testCaseId}/my`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
    });

    it('deve criar uma nova execução de teste', async () => {
        const response = await request(app)
            .post(`/api/test-execution/${testCaseId}`)
            .send({ testTime: 10, deviceId: 10, data: {} })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        testExecutionId = response.body.id;
    });

    it('deve retornar 404 para uma execução de teste não encontrada', async () => {
        const response = await request(app)
            .get('/api/test-execution/99999')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(404);
    });
});
