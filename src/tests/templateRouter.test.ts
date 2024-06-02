import request from 'supertest';
import app from '../index';

describe('Template Router', () => {
    let token: string;
    let projectId: number = 1; // Substituir pelo ID de um projeto válido para os testes
    let templateId: number;

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

    it('deve buscar um template por ID', async () => {
        const response = await request(app)
            .get(`/api/template/${templateId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', templateId);
    });

    it('deve buscar todos os templates de um projeto', async () => {
        const response = await request(app)
            .get(`/api/template/${projectId}/all`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
    });

    it('deve buscar todos os templates de um projeto por tipo', async () => {
        const type = 1; // Substituir pelo tipo de template válido
        const response = await request(app)
            .get(`/api/template/${projectId}/${type}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
    });

    it('deve buscar templates padrão por tipo', async () => {
        const type = 1; // Substituir pelo tipo de template válido
        const response = await request(app)
            .get(`/api/template/defaults/${type}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
    });

    it('deve criar um novo template', async () => {
        const response = await request(app)
            .post(`/api/template/${projectId}`)
            .send({ name: 'Template Execução', description: 'Descrição', data: {}, type: 2 })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        templateId = response.body.id;
    });

    it('deve retornar 404 para um template não encontrado', async () => {
        const response = await request(app)
            .get('/api/template/99999')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(404);
    });
});
