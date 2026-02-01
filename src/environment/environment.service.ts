import { db } from "../utils/db.server";
import { PaginationParams } from "../utils/pagination";

export type Environment = {
    id: number;
    name: string;
    description: string;
    situation: number;
    projectId: number;
};

export enum EnvironmentSituation {
    operative = 1,
    dead = 2,
}

export const create = async (environment: Omit<Environment, "id">): Promise<Environment> => {
    return db.environment.create({
        data: environment,
    });
};


export const update = async (id: number, environment: Partial<Environment>): Promise<Environment> => {
    return db.environment.update({
        where: { id },
        data: environment,
    });
};

export const find = async (id: number): Promise<Environment | null> => {
    return db.environment.findUnique({
        where: {
            id: id,
        },
    });
};

export const findOneBy = async (params: any): Promise<Environment | null> => {
    return db.environment.findUnique({
        where: params,
    });
};

export const findBy = async (params: any): Promise<Environment[] | null> => {
    return db.environment.findMany({
        where: params,
    });
};

export const findByPaged = async (
    params: any,
    pagination: PaginationParams
): Promise<{ data: Environment[]; total: number }> => {
    const [total, data] = await Promise.all([
        db.environment.count({ where: params }),
        db.environment.findMany({
            where: params,
            skip: pagination.skip,
            take: pagination.take,
            orderBy: { id: "desc" },
        }),
    ]);
    return { data, total };
};
