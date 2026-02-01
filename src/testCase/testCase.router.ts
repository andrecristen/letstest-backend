import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";

import * as TestCaseService from "./testCase.service";

export const testCaseRouter = express.Router();

testCaseRouter.get("/project/:projectId", token.authMiddleware, async (request: Request, response: Response) => {
    try {
        //@todo adiconar validações para ver se usuário está no projeto (gerente ou testador)
        const projectId: number = parseInt(request.params.projectId);
        if (!projectId) {
            return response.status(401).json({ error: "Projeto não identificado" });
        }
        const pagination = getPaginationParams(request.query);
        const result = await TestCaseService.findByPaged({ projectId: projectId }, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testCaseRouter.get("/:id", token.authMiddleware, async (request: Request, response: Response) => {
    const id: number = parseInt(request.params.id);
    try {
        //@todo adiconar validações para ver se usuário está no projeto (gerente ou testador)
        //se for testador deve validar se está atribuido a ele esse teste
        const testCase = await TestCaseService.find(id);
        if (testCase) {
            return response.status(200).json(testCase);
        }
        return response.status(404).json("Caso de Teste não encontrado");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testCaseRouter.post("/:projectId", token.authMiddleware, body("name").isString(), body("data").isObject(), async (request: Request, response: Response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const projectId: number = parseInt(request.params.projectId);
        //@todo adiconar validações para ver se usuário está no projeto (gerente apenas)
        const testCaseData: any = { ...request.body, projectId: projectId };
        if (testCaseData.dueDate) {
            testCaseData.dueDate = new Date(testCaseData.dueDate);
        }
        const newTestCase = await TestCaseService.create(testCaseData);
        return response.status(201).json(newTestCase);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testCaseRouter.put("/:id", token.authMiddleware, body("name").isString(), body("data").isObject(), async (request: Request, response: Response) => {
    const id: number = parseInt(request.params.id);
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const testCase = await TestCaseService.find(id);
        if (!testCase) {
            return response.status(404).json("Caso de Teste não encontrado");
        }
        //@todo adiconar validações para ver se usuário está no projeto (gerente apenas)
        //@todo adiconar validações se esse caso de teste nao tem execucoes já
        const updatePayload: any = { ...request.body };
        if (updatePayload.dueDate) {
            updatePayload.dueDate = new Date(updatePayload.dueDate);
        }
        const updateTestCase = await TestCaseService.update(id, updatePayload);
        return response.status(200).json(updateTestCase);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});
