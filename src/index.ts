import * as dotenv from "dotenv";
import express from "express";
import cors from "cors";

import { userRouter } from "./user/user.router";

dotenv.config();

const PORT = process.env.PORT ?? 4000

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/users", userRouter);

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});