import request from 'supertest';
import app from '../index';

describe('Device Router', () => {
    let token: string;
    let userId: number = 20; // Substituir pelo ID de um usuário válido para os testes
    let deviceId: number;

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

    it('deve buscar todos os dispositivos de um usuário', async () => {
        const response = await request(app)
            .get(`/api/device/${userId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
    });

    it('deve buscar um dispositivo por ID', async () => {
        const response = await request(app)
            .get(`/api/device/${deviceId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', deviceId);
    });

    it('deve criar um novo dispositivo', async () => {
        const response = await request(app)
            .post(`/api/device/${userId}`)
            .send({ type: 1, brand: 'Apple', model: 'iPhone 15 Pro', system: 'iOS 17' })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        deviceId = response.body.id;
    });

    it('deve atualizar um dispositivo existente', async () => {
        const response = await request(app)
            .put(`/api/device/${deviceId}`)
            .send({ type: 1, brand: 'Apple', model: 'iPhone 15 Pro Max', system: 'iOS 18' })
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
    });

    it('deve deletar um dispositivo', async () => {
        const response = await request(app)
            .delete(`/api/device/${deviceId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
    });

    it('deve retornar 404 para um dispositivo não encontrado', async () => {
        const response = await request(app)
            .get('/api/device/99999')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(404);
    });
});
