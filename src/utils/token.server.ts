import jwt, { JwtPayload } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
}

declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

export type TokenPayload = {
    id: number;
    email: string;
    name: string;
    access: number;
    organizationId?: number;
    organizationRole?: string;
};

let token: any = {};

token.sign = (payload: TokenPayload) => {
    return jwt.sign(payload, SECRET, { expiresIn: '15m' });
}

token.verify = (rawToken: string) => {
    return jwt.verify(rawToken, SECRET);
}

token.signPasswordReset = (payload: { id: number; email: string }) => {
    return jwt.sign({ ...payload, type: "password_reset" }, SECRET, { expiresIn: "1h" });
}

token.verifyPasswordReset = (rawToken: string) => {
    const decoded = jwt.verify(rawToken, SECRET) as JwtPayload & { type?: string };
    if (decoded.type !== "password_reset") {
        throw new Error("Invalid reset token");
    }
    return decoded;
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
        if (!req.user?.id) {
            return res.status(401).json({ error: "Usuário não autenticado" });
        }
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token de autenticação inválido' });
    }
};

export { token };
