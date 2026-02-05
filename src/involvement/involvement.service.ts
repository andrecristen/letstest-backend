import { db } from "../utils/db.server";
import { PaginationParams } from "../utils/pagination";

export type Involvement = {
    id: number;
    type: number;
    userId: number;
    projectId: number;
};

export enum InvolvementType {
    tester = 1,
    manager = 2,
}

export const create = async (involvement: Omit<Involvement, "id">): Promise<Involvement> => {
    return db.involvement.create({
        data: involvement,
    });
};


export const update = async (id: number, involvement: Partial<Involvement>): Promise<Involvement> => {
    return db.involvement.update({
        where: { id },
        data: involvement,
    });
};

export const remove = async (id: number): Promise<Involvement> => {
    return db.involvement.delete({
        where: { id }
    });
};

export const find = async (id: number): Promise<Involvement | null> => {
    return db.involvement.findUnique({
        where: {
            id: id,
        },
    });
};

export const findOneBy = async (params: any): Promise<Involvement | null> => {
    return db.involvement.findUnique({
        where: params,
    });
};

export const findBy = async (params: any): Promise<Involvement[] | null> => {
    return db.involvement.findMany({
        where: params,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            project: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    visibility: true,
                    situation: true,
                    creator: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    }
                }
            }
        }
    });
};

export const findByPaged = async (
    params: any,
    pagination: PaginationParams
): Promise<{ data: Involvement[]; total: number }> => {
    const [total, data] = await Promise.all([
        db.involvement.count({ where: params }),
        db.involvement.findMany({
            where: params,
            skip: pagination.skip,
            take: pagination.take,
            orderBy: { id: "desc" },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                project: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        visibility: true,
                        situation: true,
                        creator: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    }
                }
            }
        }),
    ]);
    return { data, total };
};
