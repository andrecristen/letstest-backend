import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";

import * as TestScenarioService from "./testScenario.service";

export const testScenarioRouter = express.Router();

testScenarioRouter.get("/project/:projectId", token.authMiddleware, async (request: Request, response: Response) => {
    try {
        //@todo adiconar validações para ver se usuário está no projeto (gerente ou testador)
        const projectId: number = parseInt(request.params.projectId);
        if (!projectId) {
            return response.status(401).json({ error: "Projeto não identificado" });
        }
        const testScenarios = await TestScenarioService.findBy({ projectId: projectId });
        return response.status(200).json(testScenarios);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testScenarioRouter.get("/:id", token.authMiddleware, async (request: Request, response: Response) => {
    const id: number = parseInt(request.params.id);
    try {
        //@todo adiconar validações para ver se usuário está no projeto (gerente ou testador)
        //se for testador deve validar se está atribuido a ele esse teste
        const testScenario = await TestScenarioService.find(id);
        if (testScenario) {
            return response.status(200).json(testScenario);
        }
        return response.status(404).json("Caso de Teste não encontrado");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testScenarioRouter.post("/:projectId", token.authMiddleware, body("name").isString(), body("data").isObject(), async (request: Request, response: Response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const projectId: number = parseInt(request.params.projectId);
        //@todo adiconar validações para ver se usuário está no projeto (gerente apenas)
        const testScenarioData = { ...request.body, projectId: projectId };
        const newTestScenario = await TestScenarioService.create(testScenarioData);
        return response.status(201).json(newTestScenario);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testScenarioRouter.put("/:id", token.authMiddleware, body("name").isString(), body("data").isObject(), async (request: Request, response: Response) => {
    const id: number = parseInt(request.params.id);
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const testScenario = await TestScenarioService.find(id);
        if (!testScenario) {
            return response.status(404).json("Caso de Teste não encontrado");
        }
        //@todo adiconar validações para ver se usuário está no projeto (gerente apenas)
        //@todo adiconar validações se esse caso de teste nao tem execucoes já
        const updateTestScenario = await TestScenarioService.update(id, request.body);
        return response.status(200).json(updateTestScenario);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});
