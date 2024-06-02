import request from 'supertest';
import app from '../index';

describe('Environment Router', () => {
    let token: string;
    let projectId: number = 1; // Substituir pelo ID de um projeto válido para os testes
    let environmentId: number;

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

    it('deve buscar todos os ambientes de um projeto', async () => {
        const response = await request(app)
            .get(`/api/environment/project/${projectId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
    });

    it('deve buscar um ambiente por ID', async () => {
        const response = await request(app)
            .get(`/api/environment/${environmentId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', environmentId);
    });

    it('deve criar um novo ambiente', async () => {
        const response = await request(app)
            .post(`/api/environment/${projectId}`)
            .send({ name: 'Ambiente de Testes', description: 'Descrição do ambiente', situation: 1 })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        environmentId = response.body.id;
    });

    it('deve atualizar um ambiente existente', async () => {
        const response = await request(app)
            .put(`/api/environment/${environmentId}`)
            .send({ name: 'Ambiente de Testes Atualizado', description: 'Descrição atualizada', situation: 1 })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
    });

    it('deve retornar 404 para um ambiente não encontrado', async () => {
        const response = await request(app)
            .get('/api/environment/99999')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(404);
    });
});