import { db } from "../utils/db.server";
import { JsonValue } from "@prisma/client/runtime/library";
import { PaginationParams } from "../utils/pagination";

export type TestExecution = {
    id: number;
    data: JsonValue;
    reported: Date;
    testTime: number;
    testCaseId: number;
    userId: number;
    deviceId?: number | null;
};

export const create = async (testExecution: Omit<TestExecution, "id">): Promise<TestExecution> => {
    const currentDate = new Date();
    testExecution.reported = currentDate;
    return db.testExecution.create({
        data: {
            ...testExecution,
            data: testExecution.data as { value: JsonValue },
        },
    });
};

export const update = async (id: number, testExecution: Partial<TestExecution>): Promise<TestExecution> => {
    return db.testExecution.update({
        where: { id },
        data: {
            ...testExecution,
            data: testExecution.data as { value: JsonValue },
        },
    });
};

export const find = async (id: number): Promise<TestExecution | null> => {
    return db.testExecution.findUnique({
        where: {
            id: id,
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            device: {
                select: {
                    id: true,
                    model: true,
                    system: true,
                    brand: true,
                }
            }
        }
    });
};

export const findOneBy = async (params: any): Promise<TestExecution | null> => {
    return db.testExecution.findUnique({
        where: params,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            device: {
                select: {
                    id: true,
                    model: true,
                    system: true,
                    brand: true,
                }
            }
        }
    });
};

export const findBy = async (params: any): Promise<TestExecution[] | null> => {
    return db.testExecution.findMany({
        where: params,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            device: {
                select: {
                    id: true,
                    model: true,
                    system: true,
                    brand: true,
                }
            }
        }
    });
};

export const findByPaged = async (
    params: any,
    pagination: PaginationParams
): Promise<{ data: TestExecution[]; total: number }> => {
    const [total, data] = await Promise.all([
        db.testExecution.count({ where: params }),
        db.testExecution.findMany({
            where: params,
            skip: pagination.skip,
            take: pagination.take,
            orderBy: { id: "desc" },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                device: {
                    select: {
                        id: true,
                        model: true,
                        system: true,
                        brand: true,
                    }
                }
            }
        }),
    ]);
    return { data, total };
};
