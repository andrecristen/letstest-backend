import { db } from "../utils/db.server";
import { JsonValue } from "@prisma/client/runtime/library";

export type TestCase = {
    id: number;
    data: JsonValue;
    name: string;
    projectId: number;
    environmentId?: number | null;
    testScenarioId?: number | null;
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
        include: {
            environment: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    situation: true,
                }
            },
            testScenario: {
                select: {
                    id: true,
                    name: true,
                }
            }
        }
    });
};

export const findOneBy = async (params: any): Promise<TestCase | null> => {
    return db.testCase.findUnique({
        where: params,
        include: {
            environment: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    situation: true,
                }
            },
            testScenario: {
                select: {
                    id: true,
                    name: true,
                }
            }
        }
    });
};

export const findBy = async (params: any): Promise<TestCase[] | null> => {
    return db.testCase.findMany({
        where: params,
        include: {
            environment: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    situation: true,
                }
            },
            testScenario: {
                select: {
                    id: true,
                    name: true,
                }
            }
        }
    });
};
