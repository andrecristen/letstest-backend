import request from 'supertest';
import app from '../index';

describe('Test Case Router', () => {
    let token: string;
    let projectId: number = 1; // Substituir pelo ID de um projeto válido para os testes
    let testCaseId: number;
    let testScenarioId: number = 1; // Substituir pelo ID de um cenário de teste válido
    let environmentId: number = 10; // Substituir pelo ID de um ambiente válido

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

    it('deve buscar todos os casos de teste de um projeto', async () => {
        const response = await request(app)
            .get(`/api/test-case/project/${projectId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
    });

    it('deve buscar um caso de teste por ID', async () => {
        const response = await request(app)
            .get(`/api/test-case/${testCaseId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', testCaseId);
    });

    it('deve criar um novo caso de teste', async () => {
        const response = await request(app)
            .post(`/api/test-case/${projectId}`)
            .send({
                name: 'Novo Caso de Teste',
                testScenarioId: testScenarioId,
                environmentId: environmentId,
                data: { fields: [1, 2, 3], values: [4, 5, 6] }
            })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        testCaseId = response.body.id;
    });

    it('deve atualizar um caso de teste existente', async () => {
        const response = await request(app)
            .put(`/api/test-case/${testCaseId}`)
            .send({
                name: 'Caso de Teste Atualizado',
                testScenarioId: testScenarioId,
                environmentId: environmentId,
                data: { fields: [1, 2, 3], values: [4, 5, 6] }
            })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
    });

    it('deve retornar 404 para um caso de teste não encontrado', async () => {
        const response = await request(app)
            .get('/api/test-case/99999')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(404);
    });
});