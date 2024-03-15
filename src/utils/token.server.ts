import jwt, { Secret, JwtPayload } from 'jsonwebtoken';
import { User } from '../user/user.service';

const SECRET = "41468fee1c47b0cf6252da2317cde5562564866b6194ada13df5bc378ba61c67";

let token: any = {};

token.sign = (user: User) => {
    return jwt.sign(user, SECRET, { expiresIn: '1h' });
}

export { token };