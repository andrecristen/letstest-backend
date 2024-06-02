import request from 'supertest';
import app from '../index';

describe('Involvement Router', () => {
    let token: string;
    let projectId: number = 18; // Substituir pelo ID de um projeto válido para os testes
    let involvementId: number;
    let situation: number = 2;

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

    it('deve buscar envolvimentos por projeto e situação', async () => {
        const response = await request(app)
            .get(`/api/involvement/${projectId}/${situation}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
    });

    it('deve buscar convites de envolvimento do usuário', async () => {
        const response = await request(app)
            .get(`/api/involvement/invitations`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
    });

    it('deve buscar aplicações de envolvimento do usuário', async () => {
        const response = await request(app)
            .get(`/api/involvement/applied`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
    });

    it('deve aplicar para um projeto', async () => {
        const response = await request(app)
            .post(`/api/involvement/apply`)
            .send({ project: projectId })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        involvementId = response.body.id;
    });

    it('deve convidar um usuário para um projeto', async () => {
        const response = await request(app)
            .post(`/api/involvement/invite`)
            .send({ project: projectId, email: 'dev@dev.com', type: 1 })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        involvementId = response.body.id;
    });

    it('deve aceitar um convite de envolvimento', async () => {
        const response = await request(app)
            .put(`/api/involvement/accept/${involvementId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
    });

    it('deve rejeitar um convite de envolvimento', async () => {
        const response = await request(app)
            .put(`/api/involvement/reject/${involvementId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
    });

    it('deve deletar um envolvimento', async () => {
        const response = await request(app)
            .delete(`/api/involvement/${involvementId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
    });

    it('deve retornar 404 para um envolvimento não encontrado', async () => {
        const response = await request(app)
            .get('/api/involvement/99999')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(404);
    });
});