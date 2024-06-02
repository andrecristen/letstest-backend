import request from 'supertest';
import app from '../src/index';

// Descrição do grupo de testes para o controlador de usuários
describe('User Controller', () => {
    let userId: string;

    // Teste para criação de um novo usuário
    it('deve criar um novo usuário', async () => {
        const response = await request(app)
            .post('/users')
            .send({ name: 'John Doe', email: 'john@example.com' });

        expect(response.status).toBe(201); // Verifica se a resposta HTTP é 201 (Criado)
        expect(response.body).toHaveProperty('id'); // Verifica se a resposta contém a propriedade 'id'
        userId = response.body.id; // Armazena o ID do usuário criado para uso nos testes subsequentes
    });

    // Teste para obter todos os usuários
    it('deve buscar todos os usuários', async () => {
        const response = await request(app).get('/users');
        expect(response.status).toBe(200); // Verifica se a resposta HTTP é 200 (OK)
        expect(response.body).toBeInstanceOf(Array); // Verifica se o corpo da resposta é uma instância de Array
    });

    // Teste para obter um usuário por ID
    it('deve buscar um usuário por id', async () => {
        const response = await request(app).get(`/users/${userId}`);
        expect(response.status).toBe(200); // Verifica se a resposta HTTP é 200 (OK)
        expect(response.body).toHaveProperty('id', userId); // Verifica se o corpo da resposta contém a propriedade 'id' com o valor correto
    });

    // Teste para atualizar um usuário
    it('deve atualizar um usuário', async () => {
        const response = await request(app)
            .put(`/users/${userId}`)
            .send({ name: 'Jane Doe' });

        expect(response.status).toBe(200); // Verifica se a resposta HTTP é 200 (OK)
        expect(response.body).toHaveProperty('name', 'Jane Doe'); // Verifica se o corpo da resposta contém a propriedade 'name' com o valor atualizado
    });

    // Teste para deletar um usuário
    it('deve deletar um usuário', async () => {
        const response = await request(app).delete(`/users/${userId}`);
        expect(response.status).toBe(200); // Verifica se a resposta HTTP é 200 (OK)
    });

    // Teste para verificar a resposta ao buscar um usuário inexistente
    it('deve retornar 404 para usuário inexistente', async () => {
        const response = await request(app).get('/users/nonexistentid');
        expect(response.status).toBe(404); // Verifica se a resposta HTTP é 404 (Não Encontrado)
    });
});
