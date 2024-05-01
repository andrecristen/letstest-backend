import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";

import * as TemplateService from "./template.service";

export const templateRouter = express.Router();

templateRouter.get("/defaults/:type", async (request: Request, response: Response) => {
    const type: number = parseInt(request.params.type);
    try {
        const templates = await TemplateService.findBy({ projectId: null, type });
        if (templates) {
            return response.status(200).json(templates);
        }
        return response.status(404).json("Templates padrões não encontrados");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

templateRouter.get("/:projectId/all", async (request: Request, response: Response) => {
    const projectId: number = parseInt(request.params.projectId);
    try {
        //@todo adiconar validações para ver se usuário está no projeto (gerente ou testador)
        const templates = await TemplateService.findBy({ projectId });
        const defaults = await TemplateService.findBy({ projectId: null });
        const finalTemplates = [...templates || [], ...defaults || []];
        if (finalTemplates) {
            return response.status(200).json(finalTemplates);
        }
        return response.status(404).json("Templates para projeto não encontrados");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

templateRouter.get("/:projectId/:type", async (request: Request, response: Response) => {
    const projectId: number = parseInt(request.params.projectId);
    const type: number = parseInt(request.params.type);
    try {
        if (!projectId) {
            return response.status(400).json("Parâemtro 'Projeto' não encontrado.");
        }
        if (!type) {
            return response.status(400).json("Parâmetro 'Tipo' não encontrado.");
        }
        //@todo adiconar validações para ver se usuário está no projeto (gerente ou testador)
        const templates = await TemplateService.findBy({ projectId, type });
        const defaults = await TemplateService.findBy({ projectId: null });
        const finalTemplates = [...templates || [], ...defaults || []];
        if (finalTemplates) {
            return response.status(200).json(finalTemplates);
        }
        return response.status(404).json("Templates para projeto não encontrados");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

templateRouter.get("/:templateId", async (request: Request, response: Response) => {
    const id: number = parseInt(request.params.templateId);
    try {
        //@todo adiconar validações para ver se usuário está no projeto (gerente ou testador) ou se o template é público
        const templates = await TemplateService.find(id);
        if (templates) {
            return response.status(200).json(templates);
        }
        return response.status(404).json("Template não encontrado");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

templateRouter.post("/:projectId", token.authMiddleware, body("name").isString(), body("description").isString(), body("type").isNumeric(), body("data").isObject(), async (request: Request, response: Response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const userId = request.user?.id;
        if (!userId) {
            return response.status(401).json({ error: "Usuário não autenticado" });
        }
        const projectId: number = parseInt(request.params.projectId);
        if (!projectId) {
            return response.status(404).json({ error: "Projeto não definido" });
        }
        //@todo adiconar validações para ver se usuário está no projeto (gerente apenas)
        const projectData = { ...request.body, projectId: projectId };
        const newTemplate = await TemplateService.create(projectData);
        return response.status(201).json(newTemplate);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});