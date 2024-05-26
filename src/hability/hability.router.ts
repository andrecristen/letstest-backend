import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";

import * as HabilityService from "./hability.service";

export const habilityRouter = express.Router();

habilityRouter.get("/:userId", async (request: Request, response: Response) => {
    const userId: number = parseInt(request.params.userId);
    try {
        const habilities = await HabilityService.findBy({ userId });
        if (habilities) {
            return response.status(200).json(habilities);
        }
        return response.status(404).json("Habilidades não encontradas");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

habilityRouter.post("/:userId", token.authMiddleware, body("value").isString(), body("type").isNumeric(), async (request: Request, response: Response) => {
    try {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            return response.status(400).json({ errors: errors.array() });
        }
        const userId = request.user?.id;
        const id: number = parseInt(request.params.userId);
        if (userId != id) {
            return response.status(400).json("Você não pode cadastrar habilidade para esse usuário");
        }
        const habilityData = { ...request.body, userId };
        return response.status(201).json(await HabilityService.create(habilityData));
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

habilityRouter.delete("/:id", token.authMiddleware, async (request: Request, response: Response) => {
    const id: number = parseInt(request.params.id);
    try {
        const userId = request.user?.id;
        const hability = await HabilityService.find(id);
        if (!hability) {
            return response.status(404).json("Habilidade não encontrada");
        }
        if (hability.userId != userId) {
            return response.status(400).json("Você não pode excluir habilidades deste usuário");
        }
        const deletedHability = await HabilityService.remove(id);
        return response.status(200).json(deletedHability);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});