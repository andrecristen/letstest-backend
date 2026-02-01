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
    approvalStatus?: number;
    reviewedAt?: Date | null;
    reviewedById?: number | null;
    approvedAt?: Date | null;
    approvedById?: number | null;
    assignments?: any[];
};

export const create = async (testCase: Omit<TestCase, "id">): Promise<TestCase> => {
    const { assignments, ...payload } = testCase;
    return db.testCase.create({
        data: {
            ...payload,
            data: testCase.data as { value: JsonValue },
        },
    });
};


export const update = async (id: number, testCase: Partial<TestCase>): Promise<TestCase> => {
    const { assignments, id: ignoredId, ...payload } = testCase;
    return db.testCase.update({
        where: { id },
        data: {
            ...payload,
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
            testExecutions: {
                select: { id: true },
            },
            assignments: {
                include: {
                    user: { select: { id: true, name: true, email: true } },
                },
            },
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
            testExecutions: {
                select: { id: true },
            },
            assignments: {
                include: {
                    user: { select: { id: true, name: true, email: true } },
                },
            },
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
            assignments: {
                include: {
                    user: { select: { id: true, name: true, email: true } },
                },
            },
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
                assignments: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                    },
                },
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
