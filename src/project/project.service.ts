import { db } from "../utils/db.server";

export type Project = {
    id: number;
    name: string;
    description: string;
    visibility: number;
    situation: number;
    creatorId: number;
};

export enum ProjectVisibilityEnum {
    public = 1,
    private = 2,
}

export enum ProjectSituationEnum {
    testing = 1,
    finalized = 2,
    canceled = 3,
}

export const create = async (project: Omit<Project, "id">): Promise<Project> => {
    return db.project.create({
        data: project,
    });
};

export const update = async (id: number, data: Partial<Project>): Promise<Project> => {
    return db.project.update({
        where: { id },
        data,
    });
};

export const find = async (id: number): Promise<Project | null> => {
    return db.project.findUnique({
        where: {
            id: id,
        },
        include: {
            creator: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            }
        }
    });
};

export const findOverview = async (id: number): Promise<Project | null> => {
    return db.project.findUnique({
        where: {
            id: id,
        },
        include: {
            creator: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            testScenarios: {
                select: {
                    id: true,
                    name: true,
                    data: true,
                    testCases: {
                        select: {
                            id: true,
                            name: true,
                            data: true,
                            environment: {
                                select: {
                                    id: true,
                                    name: true,
                                    description: true
                                }
                            },
                            testExecutions: {
                                select: {
                                    id: true,
                                    data: true,
                                    reported: true,
                                    testTime: true,
                                    user: {
                                        select: {
                                            id: true,
                                            name: true,
                                            email: true,
                                        }
                                    },
                                    device: {
                                        select: {
                                            id: true,
                                            type: true,
                                            brand: true,
                                            model: true,
                                            system: true,
                                        }
                                    },
                                    reports: {
                                        select: {
                                            id: true,
                                            type: true,
                                            score: true,
                                            commentary: true,
                                            user: {
                                                select: {
                                                    id: true,
                                                    name: true,
                                                    email: true,
                                                }
                                            },
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });
};

export const findOneBy = async (params: any): Promise<Project | null> => {
    return db.project.findUnique({
        where: params,
        include: {
            creator: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            }
        }
    });
};

export const findBy = async (params: any): Promise<Project[] | null> => {
    return db.project.findMany({
        where: params,
        include: {
            creator: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            }
        }
    });
};
