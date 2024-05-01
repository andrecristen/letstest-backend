import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";

import * as ProjectService from "./project.service";

export const projectRouter = express.Router();

projectRouter.get("/me", token.authMiddleware, async (request: Request, response: Response) => {
    try {
        const userId = parseInt(request.user?.id);
        if (!userId) {
            return response.status(401).json({ error: "Usuário não autenticado" });
        }
        const projects = await ProjectService.findBy({ creatorId: userId });
        return response.status(200).json(projects);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

projectRouter.get("/public", token.authMiddleware, async (request: Request, response: Response) => {
    try {
        const userId = parseInt(request.user?.id);
        if (!userId) {
            return response.status(401).json({ error: "Usuário não autenticado" });
        }
        const projects = await ProjectService.findBy({
            visibility: ProjectService.ProjectVisibilityEnum.public,
            situation: ProjectService.ProjectSituationEnum.testing
        });
        return response.status(200).json(projects);
    } catch (error) {
        console.error("Erro ao buscar projetos públicos:", error);
        return response.status(500).json({ message: "Erro interno do servidor" });
    }
});

projectRouter.get("/:id", async (request: Request, response: Response) => {
    const id: number = parseInt(request.params.id);
    try {
        const project = await ProjectService.find(id);
        if (project) {
            return response.status(200).json(project);
        }
        return response.status(404).json("Projeto não encontrado");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

projectRouter.post("/", token.authMiddleware, body("name").isString(), body("description").isString(), async (request: Request, response: Response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const userId = request.user?.id;
        if (!userId) {
            return response.status(401).json({ error: "Usuário não autenticado" });
        }
        const projectData = { ...request.body, creatorId: userId };
        const newProject = await ProjectService.create(projectData);
        return response.status(201).json(newProject);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

projectRouter.put("/:id", token.authMiddleware, async (request: Request, response: Response) => {
    const id: number = parseInt(request.params.id);
    try {
        const userId = request.user?.id;
        if (!userId) {
            return response.status(401).json({ error: "Usuário não autenticado" });
        }
        const project = await ProjectService.find(id);
        if (!project) {
            return response.status(404).json("Projeto não encontrado");
        }
        if (project.creatorId !== userId) {
            return response.status(403).json({ error: "Você não tem permissão para alterar este projeto" });
        }
        const updatedProject = await ProjectService.update(id, request.body);
        return response.status(200).json(updatedProject);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});
