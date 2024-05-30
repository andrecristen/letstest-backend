import { db } from "../utils/db.server";
import { JsonValue } from "@prisma/client/runtime/library";

export type Report = {
    id: number;
    type: number;
    score: number;
    commentary: string;
    testExecutionId: number;
    userId: number;
};

export enum ReportType {
    approved = 1,
    rejected = 2,
}

export const create = async (report: Omit<Report, "id">): Promise<Report> => {
    return db.report.create({
        data: report,
    });
};

export const update = async (id: number, report: Partial<Report>): Promise<Report> => {
    return db.report.update({
        where: { id },
        data: report,
    });
};

export const find = async (id: number): Promise<Report | null> => {
    return db.report.findUnique({
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
            }
        }
    });
};

export const findOneBy = async (params: any): Promise<Report | null> => {
    return db.report.findUnique({
        where: params,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            }
        }
    });
};

export const findBy = async (params: any): Promise<Report[] | null> => {
    return db.report.findMany({
        where: params,
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            }
        }
    });
};
