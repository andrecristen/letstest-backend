import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { crypt } from "../utils/crypt.server";
import { token, TokenPayload } from "../utils/token.server";
import { getPaginationParams } from "../utils/pagination";

import * as UserService from "./user.service";
import * as OrganizationService from "../organization/organization.service";

export const userRouter = express.Router();

userRouter.post("/register", body("email").isString(), body("name").isString(), body("password").isString(), body("organizationName").isString(), async (request: Request, response: Response) => {
    // #swagger.tags = ['Users']
    // #swagger.description = 'Cria usuario e organizacao inicial.'
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const { organizationName, ...userData } = request.body;
        userData.password = await crypt.encrypt(userData.password);
        const newUser = await UserService.create(userData);

        // Check organization limit before creating
        const canCreate = await OrganizationService.canCreateOrganization(newUser.id);
        if (!canCreate.allowed) {
            return response.status(403).json({ error: canCreate.reason });
        }

        // Auto-create organization for new user
        const orgName = organizationName || newUser.name;
        const orgSlug = OrganizationService.generateSlug(orgName);
        const org = await OrganizationService.create({
            name: orgName,
            slug: orgSlug,
            creatorId: newUser.id,
        });

        const payload: TokenPayload = {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            access: newUser.access,
            organizationId: org.id,
            organizationRole: "owner",
        };

        return response.status(200).json({
            userId: newUser.id,
            userName: newUser.name,
            token: token.sign(payload),
            organizations: [{ ...org, role: "owner" }],
        });
    } catch (error: any) {
        if (error.code === "P2002") {
            return response.status(409).json("Email já cadastrado");
        }
        return response.status(500).json(error.message);
    }
});

userRouter.put("/:id", token.authMiddleware, body("email").isString(), body("name").isString(), async (request: Request, response: Response) => {
    // #swagger.tags = ['Users']
    // #swagger.description = 'Atualiza dados do usuario autenticado.'
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    const id: number = parseInt(request.params.id);
    const userId = request.user?.id;
    if (userId != id) {
        return response.status(400).json("Você não pode alterar esse usuário");
    }
    try {
        await UserService.update(id, request.body);
        return response.status(200).json("Usuário alterado com sucesso");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

userRouter.get("/", token.authMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Users']
    // #swagger.description = 'Lista usuarios.'
    try {
        const users = await UserService.list();
        return response.status(200).json(users);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

userRouter.get("/search", token.authMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Users']
    // #swagger.description = 'Busca usuarios com filtros e paginacao.'
    try {
        const pagination = getPaginationParams(request.query);
        const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
        const hability = typeof request.query.hability === "string" ? request.query.hability.trim() : "";
        const habilityTypeValue = parseInt(String(request.query.habilityType ?? ""), 10);
        const deviceTypeValue = parseInt(String(request.query.deviceType ?? ""), 10);
        const deviceBrand = typeof request.query.deviceBrand === "string" ? request.query.deviceBrand.trim() : "";
        const deviceModel = typeof request.query.deviceModel === "string" ? request.query.deviceModel.trim() : "";
        const deviceSystem = typeof request.query.deviceSystem === "string" ? request.query.deviceSystem.trim() : "";
        const excludeProjectIdValue = parseInt(String(request.query.excludeProjectId ?? ""), 10);
        const excludeInvolvementTypeValue = parseInt(String(request.query.excludeInvolvementType ?? ""), 10);

        const filters = {
            search: search || undefined,
            hability: hability || undefined,
            habilityType: Number.isFinite(habilityTypeValue) ? habilityTypeValue : undefined,
            deviceType: Number.isFinite(deviceTypeValue) ? deviceTypeValue : undefined,
            deviceBrand: deviceBrand || undefined,
            deviceModel: deviceModel || undefined,
            deviceSystem: deviceSystem || undefined,
            excludeProjectId: Number.isFinite(excludeProjectIdValue) ? excludeProjectIdValue : undefined,
            excludeInvolvementType: Number.isFinite(excludeInvolvementTypeValue) ? excludeInvolvementTypeValue : undefined,
            excludeUserId: request.user?.id,
        };

        const result = await UserService.findByPaged(filters, pagination);
        return response.status(200).json(result);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

userRouter.get("/:id", token.authMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Users']
    // #swagger.description = 'Busca usuario por id.'
    const id: number = parseInt(request.params.id);
    try {
        const user = await UserService.find(id);
        if (user) {
            return response.status(200).json(user);
        }
        return response.status(404).json("Usuário não encontrado");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

userRouter.post('/auth', async (req: Request, res: Response) => {
    // #swagger.tags = ['Users']
    // #swagger.description = 'Autentica usuario e retorna token.'
    const { email, password } = req.body;

    const user = await UserService.findOneBy({
        email: email,
    });

    if (user && await crypt.compare(password, user.password)) {
        const organizations = await OrganizationService.findByUserId(user.id);
        const defaultOrg = organizations.find((o) => o.id === user.defaultOrgId) || organizations[0];

        const payload: TokenPayload = {
            id: user.id,
            email: user.email,
            name: user.name,
            access: user.access,
            organizationId: defaultOrg?.id,
            organizationRole: defaultOrg?.role,
        };

        res.json({
            userId: user.id,
            userName: user.name,
            token: token.sign(payload),
            organizations,
        });
    } else {
        return res.status(401).json({ error: 'Usuário não encontrado' });
    }
});

// POST /auth/switch-org - Switch active organization
userRouter.post('/auth/switch-org', token.authMiddleware, body("organizationId").isNumeric(), async (req: Request, res: Response) => {
    // #swagger.tags = ['Users']
    // #swagger.description = 'Troca a organizacao ativa do usuario.'
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const userId = req.user?.id;
        const { organizationId } = req.body;

        const organizations = await OrganizationService.findByUserId(userId);
        const targetOrg = organizations.find((o) => o.id === organizationId);

        if (!targetOrg) {
            return res.status(403).json({ error: "Você não é membro desta organização" });
        }

        await UserService.update(userId, { defaultOrgId: organizationId });

        const payload: TokenPayload = {
            id: userId,
            email: req.user.email,
            name: req.user.name,
            access: req.user.access,
            organizationId: targetOrg.id,
            organizationRole: targetOrg.role,
        };

        res.json({
            token: token.sign(payload),
            organization: targetOrg,
        });
    } catch (error: any) {
        return res.status(500).json(error.message);
    }
});
