import request from 'supertest';
import app from '../src/index';

// Descrição do grupo de testes para o controlador de usuários
describe('User Controller', () => {
    let userId: string;
    let token: string;

    const currentDate = new Date();

    const email = `email${currentDate.toTimeString()}@test.com`;
    const password = "senha-de-teste";

    // Teste para criação de um novo usuário
    it('deve criar um novo usuário', async () => {
        // Registrar um novo usuário
        const registerResponse = await request(app)
            .post('/api/users/register')
            .send({ name: 'Teste Criação', email: email, password: password });

        expect(registerResponse.status).toBe(200); // Verifica se a resposta HTTP é 200 (OK)
        expect(registerResponse.body).toHaveProperty('id'); // Verifica se a resposta contém a propriedade 'id'
        userId = registerResponse.body.id; // Armazena o ID do usuário criado para uso nos testes subsequentes
    });


    // Teste para autenticar
    it('deve autenticar o usuário criado', async () => {
        // Autenticar o usuário registrado
        const authResponse = await request(app)
            .post('/api/users/auth')
            .send({ email: email, password: password });

        expect(authResponse.status).toBe(200); // Verifica se a resposta HTTP é 200 (OK)
        expect(authResponse.body).toHaveProperty('token'); // Verifica se a resposta contém a propriedade 'token'
        token = authResponse.body.token; // Armazena o token para uso nas requisições subsequentes
    });

    // Teste para obter todos os usuários
    it('deve buscar todos os usuários', async () => {
        const response = await request(app)
            .get('/api/users')
            .set('Authorization', `Bearer ${token}`); // Define o token de autenticação

        expect(response.status).toBe(200); // Verifica se a resposta HTTP é 200 (OK)
        expect(response.body).toBeInstanceOf(Array); // Verifica se o corpo da resposta é uma instância de Array
    });

    // Teste para obter um usuário por ID
    it('deve buscar um usuário por id', async () => {
        const response = await request(app)
            .get(`/api/users/${userId}`)
            .set('Authorization', `Bearer ${token}`); // Define o token de autenticação

        expect(response.status).toBe(200); // Verifica se a resposta HTTP é 200 (OK)
        expect(response.body).toHaveProperty('id', userId); // Verifica se o corpo da resposta contém a propriedade 'id' com o valor correto
    });

    // Teste para atualizar um usuário
    it('deve atualizar um usuário', async () => {
        const response = await request(app)
            .put(`/api/users/${userId}`)
            .send({ name: 'Teste Alteração', email: email, bio: "Teste de bio" })
            .set('Authorization', `Bearer ${token}`); // Define o token de autenticação

        expect(response.status).toBe(200); // Verifica se a resposta HTTP é 200 (OK)
    });

});
