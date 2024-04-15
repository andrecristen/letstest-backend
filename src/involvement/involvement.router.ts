import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";

import * as InvolvementService from "./involvement.service";

export const involvementRouter = express.Router();

involvementRouter.post("/apply", token.authMiddleware, body("project").isNumeric(), async (request: Request, response: Response) => {
    try {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            return response.status(400).json({ errors: errors.array() });
        }
        const userId = request.user?.id;
        if (!userId) {
            return response.status(401).json({ error: "Usuário não autenticado" });
        }
        //@todo validar se o usuário já não está nesse projeto
        const projectId = parseInt(request.body.project);
        const involvement = {
            situation: InvolvementService.EnvironmentSituation.applied,
            type: InvolvementService.EnvironmenType.tester,
            userId: userId,
            projectId: projectId,
        };
        const newProject = await InvolvementService.create(involvement);
        return response.status(201).json(newProject);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

involvementRouter.post("/invite", token.authMiddleware, async (request: Request, response: Response) => {

});

involvementRouter.put("/accept/:id", token.authMiddleware, async (request: Request, response: Response) => {
});

involvementRouter.put("/reject/:id", token.authMiddleware, async (request: Request, response: Response) => {
});

involvementRouter.delete("/:id", token.authMiddleware, async (request: Request, response: Response) => {
});