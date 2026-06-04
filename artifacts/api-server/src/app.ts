import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { startTrendingCron } from "./lib/trending";
import { startStandingDealsCron } from "./lib/standing-deals";
import { startPriceDropCron } from "./lib/price-drops";

const app: Express = express();

// ── Security headers ─────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" }, contentSecurityPolicy: false }));

// ── Rate limiting ────────────────────────────────────────────
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false, message: { message: "Too many requests — try again in 15 minutes." } });
const authLimiter    = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  standardHeaders: true, legacyHeaders: false, message: { message: "Too many auth attempts — try again later." } });
app.use("/api", generalLimiter);
app.use("/api/auth/login",    authLimiter);
app.use("/api/auth/verify",   authLimiter);
app.use("/api/auth/register", authLimiter);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// ── Background crons ─────────────────────────────────────────
startTrendingCron();
startStandingDealsCron();
startPriceDropCron();

// ── Graceful shutdown ────────────────────────────────────────
process.on("SIGTERM", () => { logger.info("SIGTERM — shutting down"); process.exit(0); });
process.on("SIGINT",  () => { logger.info("SIGINT  — shutting down"); process.exit(0); });

export default app;
