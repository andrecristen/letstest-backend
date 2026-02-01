import { db } from "../utils/db.server";
import { PaginationParams } from "../utils/pagination";
import { JsonValue } from "@prisma/client/runtime/library";

export type TestScenario = {
    id: number;
    data: JsonValue;
    name: string;
    projectId: number;
};

export const create = async (testScenario: Omit<TestScenario, "id">): Promise<TestScenario> => {
    return db.testScenario.create({
        data: {
            ...testScenario,
            data: testScenario.data as { value: JsonValue },
        },
    });
};


export const update = async (id: number, testScenario: Partial<TestScenario>): Promise<TestScenario> => {
    return db.testScenario.update({
        where: { id },
        data: {
            ...testScenario,
            data: testScenario.data as { value: JsonValue },
        },
    });
};

export const find = async (id: number): Promise<TestScenario | null> => {
    return db.testScenario.findUnique({
        where: {
            id: id,
        },
    });
};

export const findOneBy = async (params: any): Promise<TestScenario | null> => {
    return db.testScenario.findUnique({
        where: params,
    });
};

export const findBy = async (params: any): Promise<TestScenario[] | null> => {
    return db.testScenario.findMany({
        where: params,
    });
};

export const findByPaged = async (
    params: any,
    pagination: PaginationParams
): Promise<{ data: TestScenario[]; total: number }> => {
    const [total, data] = await Promise.all([
        db.testScenario.count({ where: params }),
        db.testScenario.findMany({
            where: params,
            skip: pagination.skip,
            take: pagination.take,
            orderBy: { id: "desc" },
        }),
    ]);
    return { data, total };
};
