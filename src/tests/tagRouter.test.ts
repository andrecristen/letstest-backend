import request from 'supertest';
import app from '../index';

describe('Tag Router', () => {
    let token: string;
    let projectId: number = 1; // Substituir pelo ID de um projeto válido para os testes
    let tagId: number;
    let tagValueId: number;

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

    it('deve buscar uma tag por ID', async () => {
        const response = await request(app)
            .get(`/api/tag/${tagId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', tagId);
    });

    it('deve buscar todas as tags de um projeto', async () => {
        const response = await request(app)
            .get(`/api/tag/project/${projectId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
    });

    it('deve criar uma nova tag', async () => {
        const response = await request(app)
            .post(`/api/tag/${projectId}`)
            .send({ name: 'Teste', tagValues: [{ name: 'Teste', situation: 1 }, { name: 'Teste 2', situation: 1 }] })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        tagId = response.body.id;
    });

    it('deve atualizar uma tag existente', async () => {
        const response = await request(app)
            .put(`/api/tag/${tagId}`)
            .send({ name: 'Teste Atualizado', situation: 1, tagValues: [{ id: 2, name: 'Teste (Alterado)', situation: 1 }, { id: 3, name: 'Teste 2 (Alterado)', situation: 1 }] })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
    });

    it('deve criar um novo valor de tag', async () => {
        const response = await request(app)
            .post(`/api/tag/value/${tagId}`)
            .send({ name: 'Novo Valor de Tag' })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        tagValueId = response.body.id;
    });

    it('deve atualizar um valor de tag existente', async () => {
        const response = await request(app)
            .put(`/api/tag/value/${tagValueId}`)
            .send({ name: 'Valor de Tag Atualizado', situation: 2 })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
    });

    it('deve retornar 404 para uma tag não encontrada', async () => {
        const response = await request(app)
            .get('/api/tag/99999')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(404);
    });

    it('deve retornar 404 para um valor de tag não encontrado', async () => {
        const response = await request(app)
            .get('/api/tag/value/99999')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(404);
    });
});