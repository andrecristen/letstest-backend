import { db } from "../utils/db.server";
import { JsonValue } from "@prisma/client/runtime/library";

export type TestCase = {
    id: number;
    data: JsonValue;
    name: string;
    projectId: number;
};

export const create = async (testCase: Omit<TestCase, "id">): Promise<TestCase> => {
    return db.testCase.create({
        data: {
            ...testCase,
            data: testCase.data as { value: JsonValue },
        },
    });
};


export const update = async (id: number, testCase: Partial<TestCase>): Promise<TestCase> => {
    return db.testCase.update({
        where: { id },
        data: {
            ...testCase,
            data: testCase.data as { value: JsonValue },
        },
    });
};

export const find = async (id: number): Promise<TestCase | null> => {
    return db.testCase.findUnique({
        where: {
            id: id,
        },
    });
};

export const findOneBy = async (params: any): Promise<TestCase | null> => {
    return db.testCase.findUnique({
        where: params,
    });
};

export const findBy = async (params: any): Promise<TestCase[] | null> => {
    return db.testCase.findMany({
        where: params,
    });
};
