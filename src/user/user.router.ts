import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { crypt } from "../utils/crypt.server";
import { token, TokenPayload } from "../utils/token.server";
import { getPaginationParams } from "../utils/pagination";
import { requireSystemAccess, USER_ACCESS_LEVEL } from "../utils/permissions";

import * as UserService from "./user.service";
import * as OrganizationService from "../organization/organization.service";
import * as RefreshTokenService from "../auth/refreshToken.service";
import { sendPasswordResetEmail } from "../utils/email.server";
import { recordAuditLog } from "../utils/audit.middleware";

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

        const refreshToken = await RefreshTokenService.createRefreshToken(newUser.id);

        await recordAuditLog(request, {
            organizationId: org.id,
            userId: newUser.id,
            action: "auth.register",
            resourceType: "user",
            resourceId: newUser.id,
            metadata: { email: newUser.email },
        });

        return response.status(200).json({
            userId: newUser.id,
            userName: newUser.name,
            token: token.sign(payload),
            refreshToken: refreshToken.token,
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
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
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
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
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
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
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
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
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

        const refreshToken = await RefreshTokenService.createRefreshToken(user.id);

        if (defaultOrg?.id) {
            await recordAuditLog(req, {
                organizationId: defaultOrg.id,
                userId: user.id,
                action: "auth.login",
                resourceType: "user",
                resourceId: user.id,
            });
        }

        res.json({
            userId: user.id,
            userName: user.name,
            token: token.sign(payload),
            refreshToken: refreshToken.token,
            organizations,
        });
    } else {
        return res.status(401).json({ error: 'Usuário não encontrado' });
    }
});

// POST /auth/refresh - Refresh access token
userRouter.post('/auth/refresh', body("refreshToken").isString(), body("organizationId").optional().isNumeric(), async (req: Request, res: Response) => {
    // #swagger.tags = ['Users']
    // #swagger.description = 'Atualiza o access token usando refresh token.'
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { refreshToken, organizationId } = req.body;
        const storedToken = await RefreshTokenService.findRefreshToken(refreshToken);
        if (!storedToken) {
            return res.status(401).json({ error: "Refresh token inválido" });
        }
        if (storedToken.revokedAt) {
            await RefreshTokenService.revokeFamily(storedToken.family);
            return res.status(401).json({ error: "Refresh token reutilizado" });
        }
        if (storedToken.expiresAt.getTime() < Date.now()) {
            return res.status(401).json({ error: "Refresh token expirado" });
        }

        await RefreshTokenService.revokeToken(storedToken.id);
        const newRefreshToken = await RefreshTokenService.createRefreshToken(storedToken.userId, storedToken.family);

        const user = await UserService.findOneBy({ id: storedToken.userId });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const organizations = await OrganizationService.findByUserId(user.id);
        const requestedOrg = Number.isFinite(Number(organizationId))
            ? organizations.find((o) => o.id === Number(organizationId))
            : undefined;
        const defaultOrg = requestedOrg || organizations.find((o) => o.id === user.defaultOrgId) || organizations[0];

        const payload: TokenPayload = {
            id: user.id,
            email: user.email,
            name: user.name,
            access: user.access,
            organizationId: defaultOrg?.id,
            organizationRole: defaultOrg?.role,
        };

        return res.json({
            token: token.sign(payload),
            refreshToken: newRefreshToken.token,
            organizations,
        });
    } catch (error: any) {
        return res.status(500).json(error.message);
    }
});

// POST /auth/switch-org - Switch active organization
userRouter.post('/auth/switch-org', token.authMiddleware, body("organizationId").isNumeric(), async (req: Request, res: Response) => {
    // #swagger.tags = ['Users']
    // #swagger.description = 'Troca a organizacao ativa do usuario.'
    if (!requireSystemAccess(req, res, USER_ACCESS_LEVEL)) return;
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

        await recordAuditLog(req, {
            organizationId: targetOrg.id,
            userId,
            action: "auth.switch_org",
            resourceType: "organization",
            resourceId: targetOrg.id,
        });

        res.json({
            token: token.sign(payload),
            organization: targetOrg,
        });
    } catch (error: any) {
        return res.status(500).json(error.message);
    }
});

// POST /auth/forgot-password - Send password reset email
userRouter.post('/auth/forgot-password', body("email").isEmail(), async (req: Request, res: Response) => {
    // #swagger.tags = ['Users']
    // #swagger.description = 'Envia email de redefinição de senha.'
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { email } = req.body;
        const user = await UserService.findOneBy({ email });
        if (user) {
            const resetToken = token.signPasswordReset({ id: user.id, email: user.email });
            await sendPasswordResetEmail({ to: user.email, token: resetToken });
        }
        return res.status(200).json({ message: "Se o email existir, enviaremos um link de redefinição." });
    } catch (error: any) {
        return res.status(500).json(error.message);
    }
});

// POST /auth/reset-password - Reset password with token
userRouter.post('/auth/reset-password', body("token").isString(), body("password").isString(), async (req: Request, res: Response) => {
    // #swagger.tags = ['Users']
    // #swagger.description = 'Redefine a senha do usuário.'
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const { token: resetToken, password } = req.body;
        const decoded = token.verifyPasswordReset(resetToken);
        const userId = decoded.id;
        const user = await UserService.findOneBy({ id: userId });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        const hashedPassword = await crypt.encrypt(password);
        await UserService.update(userId, { password: hashedPassword });
        await RefreshTokenService.revokeAllForUser(userId);

        const organizations = await OrganizationService.findByUserId(userId);
        if (organizations.length > 0) {
            await recordAuditLog(req, {
                organizationId: organizations[0].id,
                userId,
                action: "auth.reset_password",
                resourceType: "user",
                resourceId: userId,
            });
        }

        return res.status(200).json({ message: "Senha redefinida com sucesso" });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});
