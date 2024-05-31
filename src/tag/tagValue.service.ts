import { JsonValue } from "@prisma/client/runtime/library";
import { db } from "../utils/db.server";

export type TagValue = {
    id: number;
    name: string;
    situation: number;
    tagId: number;
    commentary?: string | null;
    data?: JsonValue | null;
    projectId?: number | null;
};

export const create = async (tagValue: Omit<TagValue, "id">): Promise<TagValue> => {
    return db.tagValue.create({
        data: {
            ...tagValue,
            data: tagValue.data as { value: JsonValue },
        },
    });
};

export const update = async (id: number, tagValue: Partial<TagValue>): Promise<TagValue> => {
    return db.tagValue.update({
        where: { id },
        data: {
            ...tagValue,
            data: tagValue.data as { value: JsonValue },
        },
    });
};

export const find = async (id: number): Promise<TagValue | null> => {
    return db.tagValue.findUnique({
        where: {
            id: id,
        },
    });
};

export const findOneBy = async (params: any): Promise<TagValue | null> => {
    return db.tagValue.findUnique({
        where: params,
    });
};

export const findBy = async (params: any): Promise<TagValue[] | null> => {
    return db.tagValue.findMany({
        where: params,
    });
};