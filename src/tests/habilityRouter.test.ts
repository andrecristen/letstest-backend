import request from 'supertest';
import app from '../index';

describe('Hability Router', () => {
    let token: string;
    let userId: number = 20; // Substituir pelo ID de um usuário válido para os testes
    let habilityId: number;

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
        userId = authResponse.body.userId;
        token = authResponse.body.token;
    });

    it('deve buscar habilidades por usuário', async () => {
        const response = await request(app)
            .get(`/api/hability/${userId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
    });

    it('deve criar uma nova habilidade', async () => {
        const response = await request(app)
            .post(`/api/hability/${userId}`)
            .send({ type: 1, value: 'André Cristen' })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        habilityId = response.body.id;
    });

    it('deve deletar uma habilidade', async () => {
        const response = await request(app)
            .delete(`/api/hability/${habilityId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
    });

    it('deve retornar 404 para uma habilidade não encontrada', async () => {
        const response = await request(app)
            .get('/api/hability/99999')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(404);
    });
});
