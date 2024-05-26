import { db } from "../utils/db.server";

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
