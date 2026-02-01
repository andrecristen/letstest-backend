import { Server } from "socket.io";

let io: Server | null = null;

export const setSocketServer = (server: Server) => {
  io = server;
};

export const getSocketServer = () => io;
