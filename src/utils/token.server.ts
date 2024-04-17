import jwt, { Secret, JwtPayload } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User } from '../user/user.service';


const SECRET = "41468fee1c47b0cf6252da2317cde5562564866b6194ada13df5bc378ba61c67";

declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

let token: any = {};

token.sign = (user: User) => {
    return jwt.sign(user, SECRET, { expiresIn: '8h' });
}

token.authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: 'Token de autenticação não fornecido' });
    }

    const [bearer, token] = authHeader.split(' ');

    if (bearer !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Formato de token inválido' });
    }

    try {
        const decoded = jwt.verify(token, SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token de autenticação inválido' });
    }
};

export { token };