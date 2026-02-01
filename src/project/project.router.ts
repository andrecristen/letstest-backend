import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";

import * as ProjectService from "./project.service";
import * as InvolvementService from "../involvement/involvement.service";

export const projectRouter = express.Router();

projectRouter.get("/me", token.authMiddleware, async (request: Request, response: Response) => {
    try {
        const userId = parseInt(request.user?.id);
        const pagination = getPaginationParams(request.query);
        const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
        const situation = request.query.situation ? parseInt(String(request.query.situation), 10) : null;
        const visibility = request.query.visibility ? parseInt(String(request.query.visibility), 10) : null;
        const involvements = await InvolvementService.findBy({
            situation: InvolvementService.InvolvementSituation.accepted,
            type: InvolvementService.InvolvementType.manager,
            userId,
        });
        const projectIds = involvements?.map((involvement) => involvement.projectId) ?? [];
        const baseWhere = projectIds.length
            ? { OR: [{ creatorId: userId }, { id: { in: projectIds } }] }
            : { creatorId: userId };
        const filterWhere: any = {};
        if (search) {
            filterWhere.name = { contains: search, mode: "insensitive" };
        }
        if (situation && !Number.isNaN(situation)) {
            filterWhere.situation = situation;
        }
        if (visibility && !Number.isNaN(visibility)) {
            filterWhere.visibility = visibility;
        }
        const where = Object.keys(filterWhere).length
            ? { AND: [baseWhere, filterWhere] }
            : baseWhere;
        const result = await ProjectService.findByPaged(where, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

projectRouter.get("/test", token.authMiddleware, async (request: Request, response: Response) => {
    try {
        const userId = parseInt(request.user?.id);
        const pagination = getPaginationParams(request.query);
        const result = await ProjectService.findByPaged({
            involvements: {
                some: {
                    userId: userId,
                    situation: InvolvementService.InvolvementSituation.accepted,
                },
            },
        }, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

projectRouter.get("/public", token.authMiddleware, async (request: Request, response: Response) => {
    try {
        const userId = parseInt(request.user?.id);
        const pagination = getPaginationParams(request.query);
        const result = await ProjectService.findByPaged({
            visibility: ProjectService.ProjectVisibilityEnum.public,
            situation: ProjectService.ProjectSituationEnum.testing,
            involvements: {
                none: {
                    userId: userId,
                }
            },
            creatorId: {
                not: userId
            }
        }, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error) {
        console.error("Erro ao buscar projetos públicos:", error);
        return response.status(500).json({ message: "Erro interno do servidor" });
    }
});

projectRouter.get("/:id", token.authMiddleware, async (request: Request, response: Response) => {
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

projectRouter.get("/:id/overview", token.authMiddleware, async (request: Request, response: Response) => {
    const id: number = parseInt(request.params.id);
    try {
        const project = await ProjectService.findOverview(id);
        if (project) {
            return response.status(200).json(project);
        }
        return response.status(404).json("Projeto não encontrado");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});
