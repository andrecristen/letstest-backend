import { db } from "../utils/db.server";

export type Device = {
    id: number;
    type: number;
    brand: string;
    model: string;
    system: string;
    userId: number;
};

export enum DeviceType {
    smartphone = 1,
    notebook = 2,
    desktop = 3,
    tablet = 4,
    smartwatch = 4,
}

export const create = async (device: Omit<Device, "id">): Promise<Device> => {
    return db.device.create({
        data: device,
    });
};

export const remove = async (id: number): Promise<Device> => {
    return db.device.delete({
        where: { id }
    });
};

export const find = async (id: number): Promise<Device | null> => {
    return db.device.findUnique({
        where: {
            id: id,
        },
    });
};

export const findBy = async (params: any): Promise<Device[] | null> => {
    return db.device.findMany({
        where: params
    });
};
