import { crypt } from '../utils/crypt.server';

describe('Crypt Server', () => {
    let password: string;
    let hashedPassword: string;

    beforeAll(() => {
        password = 'senha-secreta';
    });

    it('deve criptografar uma senha', async () => {
        hashedPassword = await crypt.hash(password);
        expect(hashedPassword).toBeDefined();
        expect(hashedPassword).not.toBe(password);
    });

    it('deve comparar uma senha com seu hash', async () => {
        const isMatch = await crypt.compare(password, hashedPassword);
        expect(isMatch).toBe(true);
    });

    it('não deve comparar uma senha errada com seu hash', async () => {
        const isMatch = await crypt.compare('senha-errada', hashedPassword);
        expect(isMatch).toBe(false);
    });
});
