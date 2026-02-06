import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import { tenantMiddleware } from "../utils/tenant.middleware";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";
import { ensureProjectAccess, requireOrgRole, requireSystemAccess, USER_ACCESS_LEVEL } from "../utils/permissions";

import * as TagService from "./tag.service";
import * as TagValueService from "./tagValue.service";
import { Tag, TagValue } from "@prisma/client";

export const tagRouter = express.Router();

tagRouter.get("/project/:projectId", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Tags']
    // #swagger.description = 'Lista tags de um projeto (inclui tags publicas da org).'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    const projectId: number = parseInt(request.params.projectId);
    try {
        const access = await ensureProjectAccess(request, response, projectId, {
            allowRoles: ["owner", "manager", "tester"],
        });
        if (!access) return;
        const pagination = getPaginationParams(request.query);
        const result = await TagService.findByPaged({
            OR: [
                { projectId },
                { projectId: null, organizationId: request.organizationId },
            ],
        }, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

tagRouter.get("/:id", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Tags']
    // #swagger.description = 'Busca uma tag por id.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    const id: number = parseInt(request.params.id);
    try {
        const tag = await TagService.find(id);
        if (tag) {
            if (tag.projectId) {
                const access = await ensureProjectAccess(request, response, tag.projectId, {
                    allowRoles: ["owner", "manager", "tester"],
                });
                if (!access) return;
            } else if (tag.organizationId && tag.organizationId !== request.organizationId) {
                return response.status(404).json("Tag não encontrada");
            }
            return response.status(200).json(tag);
        }
        return response.status(404).json("Tag não encontrada");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

tagRouter.post("/:projectId", token.authMiddleware, tenantMiddleware, body("name").isString(), async (request: Request, response: Response) => {
    // #swagger.tags = ['Tags']
    // #swagger.description = 'Cria uma tag para um projeto.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const projectId: number = parseInt(request.params.projectId);
        if (!projectId) {
            return response.status(404).json({ error: "Projeto não definido" });
        }
        const access = await ensureProjectAccess(request, response, projectId, {
            allowRoles: ["owner", "manager"],
        });
        if (!access) return;
        const body = request.body
        const tagValues = request.body.tagValues || [];
        delete body.tagValues;
        const tagData = { ...body, situation: TagService.TagSituationEnum.use, projectId: projectId, organizationId: request.organizationId };
        const newTag = await TagService.create(tagData);
        if (newTag) {
            processAddTagValues(tagValues, newTag.id);
        }
        return response.status(201).json(newTag);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

async function processAddTagValues(tagValues: TagValue[], newTagId: number) {
    for (const tagValue of tagValues) {
        tagValue.tagId = newTagId
        await TagValueService.create(tagValue);
    }
}

tagRouter.put("/:id", token.authMiddleware, tenantMiddleware, body("name").isString(), body("situation").isNumeric(), async (request: Request, response: Response) => {
    // #swagger.tags = ['Tags']
    // #swagger.description = 'Atualiza dados de uma tag.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    const id: number = parseInt(request.params.id);
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const tag = await TagService.find(id);
        if (!tag) {
            return response.status(404).json("Tag não encontrada");
        }
        if (tag.projectId) {
            const access = await ensureProjectAccess(request, response, tag.projectId, {
                allowRoles: ["owner", "manager"],
            });
            if (!access) return;
        } else {
            if (tag.organizationId && tag.organizationId !== request.organizationId) {
                return response.status(404).json("Tag não encontrada");
            }
            if (!requireOrgRole(request, response, ["owner", "admin"])) return;
        }
        const body = request.body
        const tagValues = request.body.tagValues || [];
        delete body.tagValues;
        const updatedTag = await TagService.update(id, body);
        processEditTagValues(tagValues, updatedTag.id);
        return response.status(200).json(updatedTag);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

async function processEditTagValues(tagValues: TagValue[],updatedTagId: number) {
    for (const tagValue of tagValues) {
        if (tagValue.id) {
            await TagValueService.update(tagValue.id, tagValue);
        } else {
            tagValue.tagId = updatedTagId;
            await TagValueService.create(tagValue);
        }
    }
}

tagRouter.post("/value/:tagId", token.authMiddleware, tenantMiddleware, body("name").isString(), async (request: Request, response: Response) => {
    // #swagger.tags = ['TagValues']
    // #swagger.description = 'Cria um valor para uma tag.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const tagId: number = parseInt(request.params.tagId);
        if (!tagId) {
            return response.status(404).json({ error: "Tag não definida" });
        }
        const tag = await TagService.find(tagId);
        if (!tag) {
            return response.status(404).json("Tag não encontrada");
        }
        if (tag.projectId) {
            const access = await ensureProjectAccess(request, response, tag.projectId, {
                allowRoles: ["owner", "manager"],
            });
            if (!access) return;
        } else {
            if (tag.organizationId && tag.organizationId !== request.organizationId) {
                return response.status(404).json("Tag não encontrada");
            }
            if (!requireOrgRole(request, response, ["owner", "admin"])) return;
        }
        const tagValueData = { ...request.body, situation: TagService.TagSituationEnum.use, tagId: tagId };
        const newTagValue = await TagValueService.create(tagValueData);
        return response.status(201).json(newTagValue);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

tagRouter.put("/value/:tagValueid", token.authMiddleware, tenantMiddleware, body("name").isString(), body("situation").isNumeric(), async (request: Request, response: Response) => {
    // #swagger.tags = ['TagValues']
    // #swagger.description = 'Atualiza um valor de tag.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    const id: number = parseInt(request.params.tagValueid);
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const tagValue = await TagValueService.find(id);
        if (!tagValue) {
            return response.status(404).json("Tag Valor não encontrado");
        }
        const tag = await TagService.find(tagValue.tagId);
        if (!tag) {
            return response.status(404).json("Tag não encontrada");
        }
        if (tag.projectId) {
            const access = await ensureProjectAccess(request, response, tag.projectId, {
                allowRoles: ["owner", "manager"],
            });
            if (!access) return;
        } else {
            if (tag.organizationId && tag.organizationId !== request.organizationId) {
                return response.status(404).json("Tag não encontrada");
            }
            if (!requireOrgRole(request, response, ["owner", "admin"])) return;
        }
        const updatedTagValue = await TagValueService.update(id, request.body);
        return response.status(200).json(updatedTagValue);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});
