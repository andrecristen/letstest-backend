import bcrypt from 'bcrypt';

let crypt: any = {};

crypt.compare = async (value: string, compare: string) => {
    try {
        console.log(value, compare);
        const result = await bcrypt.compare(value, compare);
        console.log(result);
        return result;
    } catch (error) {
        console.error('Erro ao comparar:', error);
        return false;
    }
}

crypt.encrypt = async (value: string) => {
    const saltRounds = 10;
    try {
        const hash = await bcrypt.hash(value, saltRounds);
        console.log(hash);
        return hash;
    } catch (error) {
        console.error('Erro ao criptografar:', error);
        return null;
    }
}

export { crypt };
