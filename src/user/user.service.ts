import { db } from "../utils/db.server";
import { buildPaginatedResponse, PaginationParams } from "../utils/pagination";

export type User = {
    id: number;
    email: string;
    name: string;
    bio?: string|null;
    password: string;
    access: number;
};

export const create = async (user: Omit<User, "id">): Promise<User> => {
    let { email, name, password, access = 1} = user;
    return db.user.create({
        data: {
            email,
            name,
            password,
            access
        },
        select: {
            id: true,
            email: true,
            name: true,
            password: true,
            access: true,
        },
    });
};

export const update = async (id: number, data: Partial<User>): Promise<User> => {
    return db.user.update({
        where: { id },
        data,
    });
};


export const list = async (): Promise<Omit<User, "password">[]> => {
    return db.user.findMany({
        select: {
            id: true,
            email: true,
            name: true,
            access: true,
        },
    });
};


export const find = async (id: number): Promise<Omit<User, "password"> | null> => {
    return db.user.findUnique({
        select: {
            id: true,
            email: true,
            name: true,
            bio: true,
            access: true,
        },
        where: {
            id,
        },
    });
};

export const findOneBy = async (params: any): Promise<User | null> => {
    return db.user.findUnique({
        where: params,
    });
};

type UserSearchFilters = {
    search?: string;
    hability?: string;
    habilityType?: number;
    deviceType?: number;
    deviceBrand?: string;
    deviceModel?: string;
    deviceSystem?: string;
    excludeProjectId?: number;
    excludeInvolvementType?: number;
    excludeUserId?: number;
};

export const findByPaged = async (filters: UserSearchFilters, pagination: PaginationParams) => {
    const andFilters: any[] = [];

    if (filters.search) {
        andFilters.push({
            OR: [
                { name: { contains: filters.search, mode: "insensitive" } },
                { email: { contains: filters.search, mode: "insensitive" } },
            ],
        });
    }

    if (filters.hability || filters.habilityType) {
        const habilityWhere: any = {};
        if (filters.hability) {
            habilityWhere.value = { contains: filters.hability, mode: "insensitive" };
        }
        if (filters.habilityType) {
            habilityWhere.type = filters.habilityType;
        }
        andFilters.push({ habilities: { some: habilityWhere } });
    }

    if (filters.deviceType || filters.deviceBrand || filters.deviceModel || filters.deviceSystem) {
        const deviceWhere: any = {};
        if (filters.deviceType) {
            deviceWhere.type = filters.deviceType;
        }
        if (filters.deviceBrand) {
            deviceWhere.brand = { contains: filters.deviceBrand, mode: "insensitive" };
        }
        if (filters.deviceModel) {
            deviceWhere.model = { contains: filters.deviceModel, mode: "insensitive" };
        }
        if (filters.deviceSystem) {
            deviceWhere.system = { contains: filters.deviceSystem, mode: "insensitive" };
        }
        andFilters.push({ devices: { some: deviceWhere } });
    }

    if (filters.excludeProjectId) {
        const involvementWhere: any = { projectId: filters.excludeProjectId };
        if (filters.excludeInvolvementType) {
            involvementWhere.type = filters.excludeInvolvementType;
        }
        andFilters.push({ NOT: { involvements: { some: involvementWhere } } });
    }

    if (filters.excludeUserId) {
        andFilters.push({ NOT: { id: filters.excludeUserId } });
    }

    const where = andFilters.length > 0 ? { AND: andFilters } : {};

    const [total, users] = await Promise.all([
        db.user.count({ where }),
        db.user.findMany({
            where,
            skip: pagination.skip,
            take: pagination.take,
            orderBy: { name: "asc" },
            select: {
                id: true,
                email: true,
                name: true,
                bio: true,
                access: true,
                habilities: {
                    select: {
                        id: true,
                        type: true,
                        value: true,
                    },
                },
                devices: {
                    select: {
                        id: true,
                        type: true,
                        brand: true,
                        model: true,
                        system: true,
                    },
                },
            },
        }),
    ]);

    return buildPaginatedResponse(users, total, pagination.page, pagination.limit);
};
