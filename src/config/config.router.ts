import express from "express";
import type { Request, Response } from "express";
import { features } from "../utils/features";

export const configRouter = express.Router();

// GET / - Get public system configuration
// #swagger.tags = ['Config']
// #swagger.description = 'Retorna configuracoes publicas do sistema.'
configRouter.get("/", (req: Request, res: Response) => {
    res.json({
        isSelfHosted: features.isSelfHosted,
        billingEnabled: features.billingEnabled,
        maxOrganizations: features.maxOrganizations ?? null,
    });
});
