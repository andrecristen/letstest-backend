import request from 'supertest';
import app from '../index';

describe('Test Scenario Router', () => {
    let token: string;
    let projectId: number = 1; // Substituir pelo ID de um projeto válido para os testes
    let testScenarioId: number;

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

    it('deve buscar todos os cenários de teste de um projeto', async () => {
        const response = await request(app)
            .get(`/api/test-scenario/project/${projectId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
    });

    it('deve buscar um cenário de teste por ID', async () => {
        const response = await request(app)
            .get(`/api/test-scenario/${testScenarioId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', testScenarioId);
    });

    it('deve criar um novo cenário de teste', async () => {
        const response = await request(app)
            .post(`/api/test-scenario/${projectId}`)
            .send({ name: 'Novo Cenário de Teste', data: { steps: 'Passos de teste' } })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        testScenarioId = response.body.id;
    });

    it('deve atualizar um cenário de teste existente', async () => {
        const response = await request(app)
            .put(`/api/test-scenario/${testScenarioId}`)
            .send({ name: 'Cenário de Teste Atualizado', data: { steps: 'Passos de teste atualizados' } })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
    });

    it('deve retornar 404 para um cenário de teste não encontrado', async () => {
        const response = await request(app)
            .get('/api/test-scenario/99999')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(404);
    });
});