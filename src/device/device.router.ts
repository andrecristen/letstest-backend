import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";

import * as DeviceService from "./device.service";

export const deviceRouter = express.Router();

deviceRouter.get("/:userId",  token.authMiddleware, async (request: Request, response: Response) => {
    const userId: number = parseInt(request.params.userId);
    try {
        const devices = await DeviceService.findBy({ userId });
        if (devices) {
            return response.status(200).json(devices);
        }
        return response.status(404).json("Dispositvos não encontrados");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

deviceRouter.post("/:userId", token.authMiddleware, body("brand").isString(), body("model").isString(), body("system").isString(), body("type").isNumeric(), async (request: Request, response: Response) => {
    try {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            return response.status(400).json({ errors: errors.array() });
        }
        const userId = request.user?.id;
        const id: number = parseInt(request.params.userId);
        if (userId != id) {
            return response.status(400).json("Você não pode cadastrar dispositivos para esse usuário");
        }
        const deviceData = { ...request.body, userId };
        return response.status(201).json(await DeviceService.create(deviceData));
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

deviceRouter.delete("/:id", token.authMiddleware, async (request: Request, response: Response) => {
    const id: number = parseInt(request.params.id);
    try {
        const userId = request.user?.id;
        const hability = await DeviceService.find(id);
        if (!hability) {
            return response.status(404).json("Dispostivo não encontrado");
        }
        if (hability.userId != userId) {
            return response.status(400).json("Você não pode excluir dispostivos deste usuário");
        }
        const deletedDevice = await DeviceService.remove(id);
        return response.status(200).json(deletedDevice);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});