import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";

import * as HabilityService from "./hability.service";

export const habilityRouter = express.Router();

habilityRouter.get("/:userId",  token.authMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Habilities']
    // #swagger.description = 'Lista habilidades de um usuario (paginado).'
    const userId: number = parseInt(request.params.userId);
    try {
        const pagination = getPaginationParams(request.query);
        const result = await HabilityService.findByPaged({ userId }, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

habilityRouter.post("/:userId", token.authMiddleware, body("value").isString(), body("type").isNumeric(), async (request: Request, response: Response) => {
    // #swagger.tags = ['Habilities']
    // #swagger.description = 'Cria uma habilidade para o usuario autenticado.'
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
    // #swagger.tags = ['Habilities']
    // #swagger.description = 'Remove uma habilidade do usuario.'
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
