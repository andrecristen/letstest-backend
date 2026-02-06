import { db } from "../utils/db.server";
import { PaginationParams } from "../utils/pagination";

export type Tag = {
    id: number;
    name: string;
    situation: number;
    commentary?: string | null;
    projectId?: number | null;
    organizationId?: number | null;
};

export enum TagSituationEnum {
    use = 1,
    dontUse = 2,
}

export const create = async (tag: Omit<Tag, "id">): Promise<Tag> => {
    return db.tag.create({
        data: tag,
    });
};

export const update = async (id: number, data: Partial<Tag>): Promise<Tag> => {
    return db.tag.update({
        where: { id },
        data,
    });
};

export const find = async (id: number): Promise<Tag | null> => {
    return db.tag.findUnique({
        where: {
            id: id,
        },
        include: {
            tagValues: {
                select: {
                    id: true,
                    name: true,
                    situation: true,
                    commentary: true,
                    data: true,
                },
            }
        }
    });
};

export const findOneBy = async (params: any): Promise<Tag | null> => {
    return db.tag.findUnique({
        where: params,
        include: {
            tagValues: {
                select: {
                    id: true,
                    name: true,
                    situation: true,
                    commentary: true,
                    data: true,
                },
            }
        }
    });
};

export const findBy = async (params: any): Promise<Tag[] | null> => {
    return db.tag.findMany({
        where: params,
        include: {
            tagValues: {
                select: {
                    id: true,
                    name: true,
                    situation: true,
                    commentary: true,
                    data: true,
                },
            }
        }
    });
};

export const findByPaged = async (
    params: any,
    pagination: PaginationParams
): Promise<{ data: Tag[]; total: number }> => {
    const [total, data] = await Promise.all([
        db.tag.count({ where: params }),
        db.tag.findMany({
            where: params,
            skip: pagination.skip,
            take: pagination.take,
            orderBy: { id: "desc" },
            include: {
                tagValues: {
                    select: {
                        id: true,
                        name: true,
                        situation: true,
                        commentary: true,
                        data: true,
                    },
                }
            }
        }),
    ]);
    return { data, total };
};
