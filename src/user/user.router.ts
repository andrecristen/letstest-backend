import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { crypt } from "../utils/crypt.server";
import { token } from "../utils/token.server";


import * as UserService from "./user.service";

export const userRouter = express.Router();

userRouter.post("/register", body("email").isString(), body("name").isString(), body("password").isString(), async (request: Request, response: Response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const user = request.body;
        user.password = await crypt.encrypt(user.password);
        const newuser = await UserService.create(user);
        return response.status(200).json(newuser);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

userRouter.put("/:id", token.authMiddleware, body("email").isString(), body("name").isString(), async (request: Request, response: Response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    const id: number = parseInt(request.params.id);
    const userId = request.user?.id;
    if (userId != id) {
        return response.status(400).json("Você não pode alterar esse usuário");
    }
    try {
        await UserService.update(id, request.body);
        return response.status(200).json("Usuário alterado com sucesso");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

userRouter.get("/", token.authMiddleware, async (request: Request, response: Response) => {
    try {
        const users = await UserService.list();
        return response.status(200).json(users);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

userRouter.get("/:id", token.authMiddleware, async (request: Request, response: Response) => {
    const id: number = parseInt(request.params.id);
    try {
        const user = await UserService.find(id);
        if (user) {
            return response.status(200).json(user);
        }
        return response.status(404).json("Usuário não encontrado");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

userRouter.post('/auth', async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const user = await UserService.findOneBy({
        email: email,
    });

    if (user && await crypt.compare(password, user.password)) {
        res.json({ userId: user.id, token: token.sign(user) });
    } else {
        return res.status(401).json({ error: 'Usuário não encontrado' });
    }
});