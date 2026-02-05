import { db } from "../utils/db.server";
import crypto from "crypto";
import { features } from "../utils/features";

export type Organization = {
    id: number;
    name: string;
    slug: string;
    plan: string;
    logo?: string | null;
};

export const create = async (data: { name: string; slug: string; creatorId: number }): Promise<Organization> => {
    const org = await db.organization.create({
        data: {
            name: data.name,
            slug: data.slug,
            memberships: {
                create: {
                    userId: data.creatorId,
                    role: "owner",
                },
            },
        },
        select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            logo: true,
        },
    });

    await db.user.update({
        where: { id: data.creatorId },
        data: { defaultOrgId: org.id },
    });

    return org;
};

export const find = async (id: number): Promise<Organization | null> => {
    return db.organization.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            logo: true,
        },
    });
};

export const update = async (id: number, data: Partial<Pick<Organization, "name" | "slug" | "logo">>): Promise<Organization> => {
    return db.organization.update({
        where: { id },
        data,
        select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            logo: true,
        },
    });
};

export const findByUserId = async (userId: number) => {
    const memberships = await db.organizationMember.findMany({
        where: { userId },
        include: {
            organization: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    plan: true,
                    logo: true,
                },
            },
        },
    });

    return memberships.map((m) => ({
        ...m.organization,
        role: m.role,
    }));
};

export const getMembers = async (organizationId: number) => {
    return db.organizationMember.findMany({
        where: { organizationId },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });
};

export const getMember = async (organizationId: number, userId: number) => {
    return db.organizationMember.findUnique({
        where: {
            organizationId_userId: { organizationId, userId },
        },
    });
};

export const addMember = async (organizationId: number, userId: number, role: string = "member") => {
    return db.organizationMember.create({
        data: { organizationId, userId, role },
    });
};

export const removeMember = async (organizationId: number, userId: number) => {
    return db.organizationMember.delete({
        where: {
            organizationId_userId: { organizationId, userId },
        },
    });
};

export const updateMemberRole = async (organizationId: number, userId: number, role: string) => {
    return db.organizationMember.update({
        where: {
            organizationId_userId: { organizationId, userId },
        },
        data: { role },
    });
};

export const getPendingInvites = async (organizationId: number) => {
    return db.organizationInvite.findMany({
        where: {
            organizationId,
            acceptedAt: null,
            expiresAt: { gt: new Date() },
        },
        select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            expiresAt: true,
        },
        orderBy: { createdAt: "desc" },
    });
};

export const createInvite = async (organizationId: number, email: string, role: string = "member") => {
    // Check if user already exists
    const existingUser = await db.user.findUnique({ where: { email } });

    // Check if already a member
    if (existingUser) {
        const existingMember = await db.organizationMember.findUnique({
            where: {
                organizationId_userId: { organizationId, userId: existingUser.id },
            },
        });
        if (existingMember) {
            throw new Error("Este usuário já é membro desta organização");
        }
    }

    // Check if there's already a pending invite for this email
    const existingInvite = await db.organizationInvite.findFirst({
        where: {
            organizationId,
            email,
            acceptedAt: null,
            expiresAt: { gt: new Date() },
        },
    });
    if (existingInvite) {
        throw new Error("Já existe um convite pendente para este email");
    }

    const inviteToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await db.organizationInvite.create({
        data: {
            organizationId,
            email,
            role,
            token: inviteToken,
            expiresAt,
        },
        include: {
            organization: {
                select: { name: true, slug: true },
            },
        },
    });

    return {
        invite,
        userExists: !!existingUser,
        token: inviteToken,
    };
};

export const cancelInvite = async (organizationId: number, inviteId: number) => {
    const invite = await db.organizationInvite.findFirst({
        where: { id: inviteId, organizationId },
    });
    if (!invite) throw new Error("Convite não encontrado");
    if (invite.acceptedAt) throw new Error("Convite já foi aceito");

    return db.organizationInvite.delete({ where: { id: inviteId } });
};

export const resendInvite = async (organizationId: number, inviteId: number) => {
    const invite = await db.organizationInvite.findFirst({
        where: { id: inviteId, organizationId, acceptedAt: null },
        include: {
            organization: {
                select: { name: true, slug: true },
            },
        },
    });
    if (!invite) throw new Error("Convite não encontrado");

    // Generate new token and extend expiration
    const newToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const updatedInvite = await db.organizationInvite.update({
        where: { id: inviteId },
        data: { token: newToken, expiresAt },
        include: {
            organization: {
                select: { name: true, slug: true },
            },
        },
    });

    const existingUser = await db.user.findUnique({ where: { email: invite.email } });

    return {
        invite: updatedInvite,
        userExists: !!existingUser,
        token: newToken,
    };
};

export const getPendingInvitesByEmail = async (email: string) => {
    return db.organizationInvite.findMany({
        where: {
            email,
            acceptedAt: null,
            expiresAt: { gt: new Date() },
        },
        include: {
            organization: {
                select: { id: true, name: true, slug: true, logo: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });
};

export const findInviteByToken = async (inviteToken: string) => {
    return db.organizationInvite.findUnique({
        where: { token: inviteToken },
        include: {
            organization: {
                select: { id: true, name: true, slug: true },
            },
        },
    });
};

export const acceptInvite = async (inviteToken: string, userId: number) => {
    const invite = await findInviteByToken(inviteToken);
    if (!invite) throw new Error("Convite não encontrado");
    if (invite.acceptedAt) throw new Error("Convite já utilizado");
    if (invite.expiresAt < new Date()) throw new Error("Convite expirado");

    await db.$transaction([
        db.organizationInvite.update({
            where: { id: invite.id },
            data: { acceptedAt: new Date() },
        }),
        db.organizationMember.create({
            data: {
                organizationId: invite.organizationId,
                userId,
                role: invite.role,
            },
        }),
    ]);

    return invite.organization;
};

export const generateSlug = (name: string): string => {
    const base = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    const suffix = crypto.randomBytes(3).toString("hex");
    return `${base}-${suffix}`;
};

export const countByUserId = async (userId: number): Promise<number> => {
    return db.organizationMember.count({
        where: { userId, role: "owner" },
    });
};

export const canCreateOrganization = async (userId: number): Promise<{ allowed: boolean; reason?: string }> => {
    if (features.maxOrganizations === undefined) {
        return { allowed: true };
    }

    const currentCount = await countByUserId(userId);
    if (currentCount >= features.maxOrganizations) {
        return {
            allowed: false,
            reason: `Limite de ${features.maxOrganizations} organização(ões) atingido`,
        };
    }
    return { allowed: true };
};
