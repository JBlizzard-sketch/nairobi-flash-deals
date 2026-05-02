import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import venuesRouter from "./venues";
import dealsRouter from "./deals";
import bookingsRouter from "./bookings";
import ratingsRouter from "./ratings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(venuesRouter);
router.use(dealsRouter);
router.use(bookingsRouter);
router.use(ratingsRouter);

export default router;
