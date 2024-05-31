import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";

import * as TagService from "./tag.service";
import * as TagValueService from "./tagValue.service";

export const tagRouter = express.Router();

tagRouter.get("/project/:projectId", token.authMiddleware, async (request: Request, response: Response) => {
    const projectId: number = parseInt(request.params.projectId);
    try {
        //@todo adiconar validações para ver se usuário está no projeto (gerente ou testador)
        const tags = await TagService.findBy({ projectId });
        const defaults = await TagService.findBy({ projectId: null });
        const finalTags = [...tags || [], ...defaults || []];
        if (finalTags) {
            return response.status(200).json(finalTags);
        }
        return response.status(404).json("Tags para projeto não encontradas");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

tagRouter.get("/:id", token.authMiddleware, async (request: Request, response: Response) => {
    const id: number = parseInt(request.params.id);
    try {
        //@todo adiconar validações para ver se usuário está no projeto (gerente ou testador) ou se o tags é pública
        const tag = await TagService.find(id);
        if (tag) {
            return response.status(200).json(tag);
        }
        return response.status(404).json("Tag não encontrada");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

tagRouter.post("/:projectId", token.authMiddleware, body("name").isString(), async (request: Request, response: Response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const projectId: number = parseInt(request.params.projectId);
        if (!projectId) {
            return response.status(404).json({ error: "Projeto não definido" });
        }
        //@todo adiconar validações para ver se usuário está no projeto (gerente apenas)
        const tagData = { ...request.body, situation: TagService.TagSituationEnum.use, projectId: projectId };
        const newTag = await TagService.create(tagData);
        return response.status(201).json(newTag);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

tagRouter.put("/:id", token.authMiddleware, body("name").isString(), body("situation").isNumeric(), async (request: Request, response: Response) => {
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
        //@todo adiconar validações para ver se usuário está no projeto (gerente apenas)
        const updatedTag = await TagService.update(id, request.body);
        return response.status(200).json(updatedTag);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

tagRouter.post("/value/:tagId", token.authMiddleware, body("name").isString(), async (request: Request, response: Response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const tagId: number = parseInt(request.params.tagId);
        if (!tagId) {
            return response.status(404).json({ error: "Tag não definida" });
        }
        //@todo adiconar validações para ver se usuário está no projeto (gerente apenas)
        const tagValueData = { ...request.body, situation: TagService.TagSituationEnum.use, tagId: tagId };
        const newTagValue = await TagValueService.create(tagValueData);
        return response.status(201).json(newTagValue);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

tagRouter.put("/value/:tagValueid", token.authMiddleware, body("name").isString(), body("situation").isNumeric(), async (request: Request, response: Response) => {
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
        //@todo adiconar validações para ver se usuário está no projeto (gerente apenas)
        const updatedTagValue = await TagValueService.update(id, request.body);
        return response.status(200).json(updatedTagValue);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});