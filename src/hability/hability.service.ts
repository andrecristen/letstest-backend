import { db } from "../utils/db.server";
import { PaginationParams } from "../utils/pagination";

export type Hability = {
    id: number;
    type: number;
    value: string;
    userId: number;
};

export enum HabilityType {
    experience = 1,
    certification = 2,
    course = 3,
    language = 4,
    softSkill = 5,
}

export const create = async (hability: Omit<Hability, "id">): Promise<Hability> => {
    return db.hability.create({
        data: hability,
    });
};

export const remove = async (id: number): Promise<Hability> => {
    return db.hability.delete({
        where: { id }
    });
};

export const find = async (id: number): Promise<Hability | null> => {
    return db.hability.findUnique({
        where: {
            id: id,
        },
    });
};

export const findBy = async (params: any): Promise<Hability[] | null> => {
    return db.hability.findMany({
        where: params
    });
};

export const findByPaged = async (
    params: any,
    pagination: PaginationParams
): Promise<{ data: Hability[]; total: number }> => {
    const [total, data] = await Promise.all([
        db.hability.count({ where: params }),
        db.hability.findMany({
            where: params,
            skip: pagination.skip,
            take: pagination.take,
            orderBy: { id: "desc" },
        }),
    ]);
    return { data, total };
};
