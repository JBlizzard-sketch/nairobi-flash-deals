import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import venuesRouter from "./venues";
import dealsRouter from "./deals";
import bookingsRouter from "./bookings";
import paymentsRouter from "./payments";
import ratingsRouter from "./ratings";
import whatsappRouter from "./whatsapp";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(venuesRouter);
router.use(dealsRouter);
router.use(bookingsRouter);
router.use(paymentsRouter);
router.use(ratingsRouter);
router.use(whatsappRouter);
router.use(notificationsRouter);

export default router;
