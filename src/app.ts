import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";

import { errorHandler, notFoundHandler } from "./middleware/error";
import { adminRouter } from "./routes/admin.routes";
import { authRouter } from "./routes/auth.routes";
import { moviesRouter } from "./routes/movies.routes";
import { reservationsRouter } from "./routes/reservations.routes";

export const app = express();
const publicDir = path.join(process.cwd(), "public");

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(express.static(publicDir));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use("/api/auth", authRouter);
app.use("/api/movies", moviesRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/admin", adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);
