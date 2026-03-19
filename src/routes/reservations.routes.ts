import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { authRequired } from "../middleware/auth";

const createReservationSchema = z.object({
  showtimeId: z.string().uuid(),
  seatIds: z.array(z.string().uuid()).min(1),
});

const reservationParams = z.object({
  reservationId: z.string().uuid(),
});

export const reservationsRouter = Router();

reservationsRouter.use(authRequired);

reservationsRouter.post("/", async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const body = createReservationSchema.parse(req.body);

    const showtime = await prisma.showtime.findUnique({
      where: { id: body.showtimeId },
      include: {
        auditorium: {
          include: {
            seats: true,
          },
        },
      },
    });

    if (!showtime) {
      res.status(404).json({ message: "Showtime not found" });
      return;
    }

    if (showtime.startsAt <= new Date()) {
      res.status(400).json({ message: "Cannot reserve past showtime" });
      return;
    }

    const seatSet = new Set(body.seatIds);
    if (seatSet.size !== body.seatIds.length) {
      res.status(400).json({ message: "Duplicate seat ids are not allowed" });
      return;
    }

    const validSeatIds = new Set(showtime.auditorium.seats.map((s) => s.id));
    const invalidSeat = body.seatIds.find((seatId) => !validSeatIds.has(seatId));
    if (invalidSeat) {
      res.status(400).json({ message: "Some seats do not belong to the showtime auditorium" });
      return;
    }

    const reservation = await prisma.$transaction(async (tx) => {
      const createdReservation = await tx.reservation.create({
        data: {
          userId,
          showtimeId: body.showtimeId,
          totalPrice: showtime.basePrice * body.seatIds.length,
        },
      });

      try {
        await tx.reservedSeat.createMany({
          data: body.seatIds.map((seatId) => ({
            reservationId: createdReservation.id,
            showtimeId: body.showtimeId,
            seatId,
          })),
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new Error("One or more selected seats are already reserved");
        }
        throw err;
      }

      return tx.reservation.findUnique({
        where: { id: createdReservation.id },
        include: {
          showtime: {
            include: {
              movie: true,
              auditorium: true,
            },
          },
          reservedSeat: {
            include: {
              seat: true,
            },
          },
        },
      });
    });

    res.status(201).json(reservation);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.get("/my", async (req, res, next) => {
  try {
    const reservations = await prisma.reservation.findMany({
      where: { userId: req.user!.id },
      include: {
        showtime: {
          include: {
            movie: true,
            auditorium: true,
          },
        },
        reservedSeat: {
          include: {
            seat: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(reservations);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.delete("/:reservationId", async (req, res, next) => {
  try {
    const { reservationId } = reservationParams.parse(req.params);

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { showtime: true },
    });

    if (!reservation || reservation.userId !== req.user!.id) {
      res.status(404).json({ message: "Reservation not found" });
      return;
    }

    if (reservation.showtime.startsAt <= new Date()) {
      res.status(400).json({ message: "Cannot cancel past or ongoing showtime reservation" });
      return;
    }

    if (reservation.status === "CANCELLED") {
      res.status(400).json({ message: "Reservation is already cancelled" });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.reservedSeat.deleteMany({ where: { reservationId } });
      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      });
    });

    res.json({ message: "Reservation cancelled" });
  } catch (err) {
    next(err);
  }
});
