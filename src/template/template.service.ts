import { db } from "../utils/db.server";
import { JsonValue } from "@prisma/client/runtime/library";
import { PaginationParams } from "../utils/pagination";

export type Template = {
    id: number;
    name: string;
    description: string;
    data: JsonValue;
    type: number;
    projectId: number | null;
};

export enum TemplateType {
    definitionTestCase = 1,
    executionTestCase = 2,
    executionTestScenario = 3,
}

export const create = async (template: Omit<Template, "id">): Promise<Template> => {
    return db.template.create({
        data: {
            ...template,
            data: template.data as { value: JsonValue },
        },
    });
};

export const update = async (id: number, template: Partial<Template>): Promise<Template> => {
    return db.template.update({
        where: { id },
        data: {
            ...template,
            data: template.data as { value: JsonValue },
        },
    });
};

export const find = async (id: number): Promise<Template | null> => {
    return db.template.findUnique({
        where: {
            id: id,
        },
    });
};

export const findOneBy = async (params: any): Promise<Template | null> => {
    return db.template.findUnique({
        where: params,
    });
};

export const findBy = async (params: any): Promise<Template[] | null> => {
    return db.template.findMany({
        where: params,
    });
};

export const findByPaged = async (
    params: any,
    pagination: PaginationParams
): Promise<{ data: Template[]; total: number }> => {
    const [total, data] = await Promise.all([
        db.template.count({ where: params }),
        db.template.findMany({
            where: params,
            skip: pagination.skip,
            take: pagination.take,
            orderBy: { id: "desc" },
        }),
    ]);
    return { data, total };
};
