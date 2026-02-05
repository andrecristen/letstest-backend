import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import { tenantMiddleware } from "../utils/tenant.middleware";
import { sendInviteEmail } from "../utils/email.server";

import * as OrganizationService from "./organization.service";
import { dispatchEvent } from "../webhook/webhook.service";

export const organizationRouter = express.Router();

// ============================================================================
// Routes WITHOUT :id parameter MUST come FIRST (before any /:id routes)
// ============================================================================

// GET / - List user's organizations
organizationRouter.get("/", token.authMiddleware, async (req: Request, res: Response) => {
    // #swagger.tags = ['Organizations']
    // #swagger.description = 'Lista organizacoes do usuario autenticado.'
    try {
        const userId = req.user?.id;
        const organizations = await OrganizationService.findByUserId(userId);
        return res.status(200).json(organizations);
    } catch (error: any) {
        return res.status(500).json(error.message);
    }
});

// POST / - Create a new organization
organizationRouter.post("/", token.authMiddleware, body("name").isString(), async (req: Request, res: Response) => {
    // #swagger.tags = ['Organizations']
    // #swagger.description = 'Cria uma organizacao.'
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const userId = req.user?.id;
        const { name } = req.body;

        // Check organization limit
        const canCreate = await OrganizationService.canCreateOrganization(userId);
        if (!canCreate.allowed) {
            return res.status(403).json({ error: canCreate.reason });
        }

        const slug = OrganizationService.generateSlug(name);
        const org = await OrganizationService.create({ name, slug, creatorId: userId });

        return res.status(201).json(org);
    } catch (error: any) {
        return res.status(500).json(error.message);
    }
});

// GET /my-invites - Get current user's pending invites
organizationRouter.get("/my-invites", token.authMiddleware, async (req: Request, res: Response) => {
    // #swagger.tags = ['Organizations']
    // #swagger.description = 'Lista convites pendentes para o usuario.'
    try {
        const userEmail = req.user?.email;
        if (!userEmail) {
            return res.status(400).json({ error: "Email do usuário não encontrado" });
        }
        const invites = await OrganizationService.getPendingInvitesByEmail(userEmail);
        return res.status(200).json(invites);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

// POST /invite/accept - Accept an organization invite (public, only needs auth)
organizationRouter.post("/invite/accept", token.authMiddleware, body("token").isString(), async (req: Request, res: Response) => {
    // #swagger.tags = ['Organizations']
    // #swagger.description = 'Aceita um convite de organizacao.'
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        const userId = req.user?.id;
        const userEmail = req.user?.email;
        const { token: inviteToken } = req.body;

        // Verify the invite belongs to this user's email
        const invite = await OrganizationService.findInviteByToken(inviteToken);
        if (!invite) {
            return res.status(404).json({ error: "Convite não encontrado" });
        }
        if (invite.email.toLowerCase() !== userEmail?.toLowerCase()) {
            return res.status(403).json({ error: "Este convite não pertence a este usuário" });
        }

        const org = await OrganizationService.acceptInvite(inviteToken, userId);

        dispatchEvent(org.id, "involvement.accepted", {
            organizationId: org.id,
            userId,
            email: userEmail,
            role: invite.role,
        }).catch(console.error);

        return res.status(200).json(org);
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

// ============================================================================
// Routes WITH :id parameter come AFTER static routes
// ============================================================================

// GET /:id - Get organization details
organizationRouter.get("/:id", token.authMiddleware, tenantMiddleware, async (req: Request, res: Response) => {
    // #swagger.tags = ['Organizations']
    // #swagger.description = 'Busca detalhes da organizacao ativa.'
    try {
        const org = await OrganizationService.find(req.organizationId!);
        if (!org) {
            return res.status(404).json("Organização não encontrada");
        }
        return res.status(200).json(org);
    } catch (error: any) {
        return res.status(500).json(error.message);
    }
});

// PUT /:id - Update organization
organizationRouter.put("/:id", token.authMiddleware, tenantMiddleware, body("name").isString(), async (req: Request, res: Response) => {
    // #swagger.tags = ['Organizations']
    // #swagger.description = 'Atualiza dados da organizacao.'
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        if (req.organizationRole !== "owner" && req.organizationRole !== "admin") {
            return res.status(403).json({ error: "Apenas owners e admins podem editar a organização" });
        }
        const { name, slug, logo } = req.body;
        const updated = await OrganizationService.update(req.organizationId!, { name, slug, logo });
        return res.status(200).json(updated);
    } catch (error: any) {
        return res.status(500).json(error.message);
    }
});

// GET /:id/members - List organization members and pending invites
organizationRouter.get("/:id/members", token.authMiddleware, tenantMiddleware, async (req: Request, res: Response) => {
    // #swagger.tags = ['Organizations']
    // #swagger.description = 'Lista membros e convites pendentes da organizacao.'
    try {
        if (req.organizationRole !== "owner" && req.organizationRole !== "admin") {
            return res.status(403).json({ error: "Apenas owners e admins podem ver membros" });
        }
        const [members, pendingInvites] = await Promise.all([
            OrganizationService.getMembers(req.organizationId!),
            OrganizationService.getPendingInvites(req.organizationId!),
        ]);
        return res.status(200).json({ members, pendingInvites });
    } catch (error: any) {
        return res.status(500).json(error.message);
    }
});

// GET /:id/invites - List pending invites only
organizationRouter.get("/:id/invites", token.authMiddleware, tenantMiddleware, async (req: Request, res: Response) => {
    // #swagger.tags = ['Organizations']
    // #swagger.description = 'Lista apenas convites pendentes da organizacao.'
    try {
        if (req.organizationRole !== "owner" && req.organizationRole !== "admin") {
            return res.status(403).json({ error: "Apenas owners e admins podem ver convites" });
        }
        const pendingInvites = await OrganizationService.getPendingInvites(req.organizationId!);
        return res.status(200).json(pendingInvites);
    } catch (error: any) {
        return res.status(500).json(error.message);
    }
});

// POST /:id/members/invite - Invite a member
organizationRouter.post("/:id/members/invite", token.authMiddleware, tenantMiddleware, body("email").isEmail(), async (req: Request, res: Response) => {
    // #swagger.tags = ['Organizations']
    // #swagger.description = 'Cria convite para membro na organizacao.'
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        if (req.organizationRole !== "owner" && req.organizationRole !== "admin") {
            return res.status(403).json({ error: "Apenas owners e admins podem convidar membros" });
        }
        const { email, role } = req.body;
        const result = await OrganizationService.createInvite(req.organizationId!, email, role || "member");

        // Send email if user doesn't exist in the system
        if (!result.userExists) {
            await sendInviteEmail({
                to: email,
                organizationName: result.invite.organization.name,
                role: result.invite.role,
                token: result.token,
                expiresAt: result.invite.expiresAt,
            });
        }

        return res.status(201).json({
            invite: result.invite,
            userExists: result.userExists,
            message: result.userExists
                ? "Convite criado. O usuário pode aceitar pelo sistema."
                : "Convite criado e email enviado.",
        });
    } catch (error: any) {
        if (error.message.includes("já é membro") || error.message.includes("convite pendente")) {
            return res.status(409).json({ error: error.message });
        }
        return res.status(500).json({ error: error.message });
    }
});

// DELETE /:id/invites/:inviteId - Cancel a pending invite
organizationRouter.delete("/:id/invites/:inviteId", token.authMiddleware, tenantMiddleware, async (req: Request, res: Response) => {
    // #swagger.tags = ['Organizations']
    // #swagger.description = 'Cancela um convite pendente.'
    try {
        if (req.organizationRole !== "owner" && req.organizationRole !== "admin") {
            return res.status(403).json({ error: "Apenas owners e admins podem cancelar convites" });
        }
        const inviteId = parseInt(req.params.inviteId);
        await OrganizationService.cancelInvite(req.organizationId!, inviteId);
        return res.status(200).json({ message: "Convite cancelado com sucesso" });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

// POST /:id/invites/:inviteId/resend - Resend an invite
organizationRouter.post("/:id/invites/:inviteId/resend", token.authMiddleware, tenantMiddleware, async (req: Request, res: Response) => {
    // #swagger.tags = ['Organizations']
    // #swagger.description = 'Reenvia um convite pendente.'
    try {
        if (req.organizationRole !== "owner" && req.organizationRole !== "admin") {
            return res.status(403).json({ error: "Apenas owners e admins podem reenviar convites" });
        }
        const inviteId = parseInt(req.params.inviteId);
        const result = await OrganizationService.resendInvite(req.organizationId!, inviteId);

        // Send email if user doesn't exist
        if (!result.userExists) {
            await sendInviteEmail({
                to: result.invite.email,
                organizationName: result.invite.organization.name,
                role: result.invite.role,
                token: result.token,
                expiresAt: result.invite.expiresAt,
            });
        }

        return res.status(200).json({
            invite: result.invite,
            userExists: result.userExists,
            message: result.userExists
                ? "Convite atualizado. O usuário pode aceitar pelo sistema."
                : "Convite reenviado por email.",
        });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

// PUT /:id/members/:userId/role - Update member role
organizationRouter.put("/:id/members/:userId/role", token.authMiddleware, tenantMiddleware, body("role").isString(), async (req: Request, res: Response) => {
    // #swagger.tags = ['Organizations']
    // #swagger.description = 'Atualiza o papel (role) de um membro.'
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    try {
        if (req.organizationRole !== "owner") {
            return res.status(403).json({ error: "Apenas o owner pode alterar roles" });
        }
        const targetUserId = parseInt(req.params.userId);
        const { role } = req.body;

        // Cannot assign "owner" role through this endpoint
        if (role === "owner") {
            return res.status(400).json({ error: "O role 'owner' não pode ser atribuído desta forma" });
        }

        // Check if target user is an owner - cannot change owner's role
        const targetMember = await OrganizationService.getMember(req.organizationId!, targetUserId);
        if (targetMember?.role === "owner") {
            return res.status(400).json({ error: "Não é possível alterar o role do proprietário" });
        }

        const updated = await OrganizationService.updateMemberRole(req.organizationId!, targetUserId, role);
        return res.status(200).json(updated);
    } catch (error: any) {
        return res.status(500).json(error.message);
    }
});

// DELETE /:id/members/:userId - Remove a member
organizationRouter.delete("/:id/members/:userId", token.authMiddleware, tenantMiddleware, async (req: Request, res: Response) => {
    // #swagger.tags = ['Organizations']
    // #swagger.description = 'Remove um membro da organizacao.'
    try {
        if (req.organizationRole !== "owner" && req.organizationRole !== "admin") {
            return res.status(403).json({ error: "Apenas owners e admins podem remover membros" });
        }
        const targetUserId = parseInt(req.params.userId);
        if (targetUserId === req.user?.id) {
            return res.status(400).json({ error: "Você não pode se remover da organização" });
        }

        // Check if target user is an owner - cannot remove owner
        const targetMember = await OrganizationService.getMember(req.organizationId!, targetUserId);
        if (targetMember?.role === "owner") {
            return res.status(400).json({ error: "Não é possível remover o proprietário da organização" });
        }

        // Admins cannot remove other admins, only owners can
        if (req.organizationRole === "admin" && targetMember?.role === "admin") {
            return res.status(403).json({ error: "Admins não podem remover outros admins" });
        }

        await OrganizationService.removeMember(req.organizationId!, targetUserId);
        return res.status(200).json("Membro removido com sucesso");
    } catch (error: any) {
        return res.status(500).json(error.message);
    }
});
