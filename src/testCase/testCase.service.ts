import { db } from "../utils/db.server";
import { JsonValue } from "@prisma/client/runtime/library";
import { PaginationParams } from "../utils/pagination";

export type TestCase = {
    id: number;
    data: JsonValue;
    name: string;
    projectId: number;
    environmentId?: number | null;
    testScenarioId?: number | null;
    dueDate?: Date | null;
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
                    data: true,
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
                    data: true,
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
                    data: true,
                }
            }
        }
    });
};

export const findByPaged = async (
    params: any,
    pagination: PaginationParams
): Promise<{ data: TestCase[]; total: number }> => {
    const [total, data] = await Promise.all([
        db.testCase.count({ where: params }),
        db.testCase.findMany({
            where: params,
            skip: pagination.skip,
            take: pagination.take,
            orderBy: { id: "desc" },
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
                        data: true,
                    }
                }
            }
        }),
    ]);
    return { data, total };
};
