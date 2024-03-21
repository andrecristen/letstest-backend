import bcrypt from 'bcrypt';

let crypt: any = {};

crypt.compare = async (value: string, compare: string) => {
    try {
        return await bcrypt.compare(value, compare);
    } catch (error) {
        console.error('Erro ao comparar:', error);
        return false;
    }
}

crypt.encrypt = async (value: string) => {
    const saltRounds = 10;
    try {
        return await bcrypt.hash(value, saltRounds);
    } catch (error) {
        console.error('Erro ao criptografar:', error);
        return null;
    }
}

export { crypt };
