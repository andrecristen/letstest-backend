import request from 'supertest';
import app from '../index';

describe('Project Router', () => {
    let token: string;
    let projectId: number;
    const currentDate = new Date();
    const email = `email${currentDate.toTimeString()}@test.com`;
    const password = "senha-de-teste";

    beforeAll(async () => {
        // Registrar e autenticar um usuário para obter o token
        await request(app)
            .post('/api/users/register')
            .send({ name: 'Teste Criação', email: email, password: password });

        const authResponse = await request(app)
            .post('/api/users/auth')
            .send({ email: email, password: password });

        token = authResponse.body.token;
    });

    it('deve criar um novo projeto', async () => {
        const response = await request(app)
            .post('/api/projects')
            .send({
                name: "Teste Meu Projeto 1",
                description: "Teste do teste e apenas teste 1",
                visibility: 1,
                situation: 3
            })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        projectId = response.body.id;
    });

    it('deve buscar os projetos do usuário logado (dono ou gerente)', async () => {
        const response = await request(app)
            .get('/api/projects/me')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
    });

    it('deve buscar os projetos onde o usuário está envolvido', async () => {
        const response = await request(app)
            .get('/api/projects/test')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
    });

    it('deve buscar projetos públicos', async () => {
        const response = await request(app)
            .get('/api/projects/public')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
    });

    it('deve buscar um projeto por ID', async () => {
        const response = await request(app)
            .get(`/api/projects/${projectId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', projectId);
    });



    it('deve atualizar um projeto existente', async () => {
        const response = await request(app)
            .put(`/api/projects/${projectId}`)
            .send({ name: 'Projeto Atualizado', description: 'Descrição atualizada' })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
    });

    it('deve buscar a visão geral de um projeto por ID', async () => {
        const response = await request(app)
            .get(`/api/projects/${projectId}/overview`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', projectId);
    });
});
