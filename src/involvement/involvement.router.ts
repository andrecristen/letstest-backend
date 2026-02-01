import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";

import * as InvolvementService from "./involvement.service";
import * as UserService from "../user/user.service";
import * as NotificationService from "../notification/notification.service";

export const involvementRouter = express.Router();

involvementRouter.get("/:projectId/:situation", token.authMiddleware, async (request: Request, response: Response) => {
    const projectId: number = parseInt(request.params.projectId);
    const situation: number = parseInt(request.params.situation);
    try {
        //@todo adiconar validações para ver se usuário está no projeto (gerente ou testador)
        const pagination = getPaginationParams(request.query);
        const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
        const where: any = { projectId, situation };
        if (search) {
            where.AND = [
                { projectId, situation },
                {
                    user: {
                        OR: [
                            { name: { contains: search, mode: "insensitive" } },
                            { email: { contains: search, mode: "insensitive" } },
                        ],
                    },
                },
            ];
        }
        const result = await InvolvementService.findByPaged(where, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

involvementRouter.get("/invitations", token.authMiddleware, async (request: Request, response: Response) => {
    try {
        const userId = request.user?.id;
        const pagination = getPaginationParams(request.query);
        const result = await InvolvementService.findByPaged(
            { situation: InvolvementService.InvolvementSituation.invited, userId },
            pagination
        );
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

involvementRouter.get("/applied", token.authMiddleware, async (request: Request, response: Response) => {
    try {
        const userId = request.user?.id;
        const pagination = getPaginationParams(request.query);
        const result = await InvolvementService.findByPaged(
            { situation: InvolvementService.InvolvementSituation.applied, userId },
            pagination
        );
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

involvementRouter.post("/apply", token.authMiddleware, body("project").isNumeric(), async (request: Request, response: Response) => {
    try {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            return response.status(400).json({ errors: errors.array() });
        }
        const userId = request.user?.id;
        //@todo validar se o usuário já não está nesse projeto
        const projectId = parseInt(request.body.project);
        const involvement = {
            situation: InvolvementService.InvolvementSituation.applied,
            type: InvolvementService.InvolvementType.tester,
            userId: userId,
            projectId: projectId,
        };
        const newProject = await InvolvementService.create(involvement);
        return response.status(201).json(newProject);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

involvementRouter.post("/invite", token.authMiddleware, body("project").isNumeric(), body("email").isString(), body("type").isNumeric(), async (request: Request, response: Response) => {
    try {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            return response.status(400).json({ errors: errors.array() });
        }
        //@todo validar se o usuário já não está nesse projeto
        //@todo validar se o usuário que convidou é um gerente ou dono
        const userFound = await UserService.findOneBy({ email: request.body.email });
        if (!userFound) {
            return response.status(404).json("Usuário não encontrado para o e-mail fornecido");
        }
        const projectId = parseInt(request.body.project);
        const userId = userFound.id;
        const type = parseInt(request.body.type);
        const involvement = {
            situation: InvolvementService.InvolvementSituation.invited,
            type: type,
            userId: userId,
            projectId: projectId,
        };
        const newProject = await InvolvementService.create(involvement);
        return response.status(201).json(newProject);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

involvementRouter.put("/accept/:id", token.authMiddleware, async (request: Request, response: Response) => {
    return await updateSituation(request, response, InvolvementService.InvolvementSituation.accepted);
});

involvementRouter.put("/reject/:id", token.authMiddleware, async (request: Request, response: Response) => {
    return await updateSituation(request, response, InvolvementService.InvolvementSituation.rejected);
});

involvementRouter.delete("/:id", token.authMiddleware, async (request: Request, response: Response) => {
    const id: number = parseInt(request.params.id);
    try {
        //@todo validar se o usuario é o dono ou gerente do projeto
        const involvement = await InvolvementService.find(id);
        if (!involvement) {
            return response.status(404).json("Convite não encontrado");
        }
        const updatedInvolvement = await InvolvementService.remove(id);
        return response.status(200).json(updatedInvolvement);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

const updateSituation = async (request: Request, response: Response, situation: number) => {
    const id: number = parseInt(request.params.id);
    try {
        //@todo validar se o usuario é o dono ou gerente do projeto
        //@todo validar se a situação já não é aceita ou rejeitada
        const involvement = await InvolvementService.find(id);
        if (!involvement) {
            return response.status(404).json("Convite não encontrado");
        }
        const updatedInvolvement = await InvolvementService.update(id, { situation: situation });
        if (situation === InvolvementService.InvolvementSituation.accepted) {
            await NotificationService.notifyInviteAccepted(updatedInvolvement.id);
        }
        return response.status(200).json(updatedInvolvement);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
}
