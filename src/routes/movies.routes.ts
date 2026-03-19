import { Router } from "express";
import { z } from "zod";

import { prisma } from "../lib/prisma";

export const moviesRouter = Router();

moviesRouter.get("/", async (req, res, next) => {
  try {
    const date = typeof req.query.date === "string" ? req.query.date : undefined;

    const movies = await prisma.movie.findMany({
      ...(date
        ? {
            where: {
              showtimes: {
                some: {
                  startsAt: {
                    gte: new Date(`${date}T00:00:00.000Z`),
                    lt: new Date(`${date}T23:59:59.999Z`),
                  },
                },
              },
            },
          }
        : {}),
      include: {
        genres: { include: { genre: true } },
        showtimes: {
          orderBy: { startsAt: "asc" },
          include: { auditorium: true },
        },
      },
      orderBy: { title: "asc" },
    });

    res.json(
      movies.map((movie) => ({
        id: movie.id,
        title: movie.title,
        description: movie.description,
        posterUrl: movie.posterUrl,
        durationMin: movie.durationMin,
        genres: movie.genres.map((g) => g.genre.name),
        showtimes: movie.showtimes.map((s) => ({
          id: s.id,
          startsAt: s.startsAt,
          basePrice: s.basePrice,
          auditorium: {
            id: s.auditorium.id,
            name: s.auditorium.name,
            capacity: s.auditorium.capacity,
          },
        })),
      }))
    );
  } catch (err) {
    next(err);
  }
});

const showtimeParams = z.object({
  showtimeId: z.string().uuid(),
});

moviesRouter.get("/showtimes/:showtimeId/seats", async (req, res, next) => {
  try {
    const { showtimeId } = showtimeParams.parse(req.params);

    const showtime = await prisma.showtime.findUnique({
      where: { id: showtimeId },
      include: {
        auditorium: {
          include: {
            seats: {
              orderBy: [{ rowLabel: "asc" }, { seatNumber: "asc" }],
            },
          },
        },
        reservedSeats: {
          include: {
            reservation: {
              select: { status: true },
            },
            seat: true,
          },
        },
      },
    });

    if (!showtime) {
      res.status(404).json({ message: "Showtime not found" });
      return;
    }

    const occupiedSeatIds = new Set(
      showtime.reservedSeats
        .filter((rs) => rs.reservation.status === "ACTIVE")
        .map((rs) => rs.seatId)
    );

    const seats = showtime.auditorium.seats.map((seat) => ({
      id: seat.id,
      code: seat.code,
      rowLabel: seat.rowLabel,
      seatNumber: seat.seatNumber,
      available: !occupiedSeatIds.has(seat.id),
    }));

    res.json({
      showtime: {
        id: showtime.id,
        startsAt: showtime.startsAt,
        auditorium: {
          id: showtime.auditorium.id,
          name: showtime.auditorium.name,
          capacity: showtime.auditorium.capacity,
        },
      },
      seats,
    });
  } catch (err) {
    next(err);
  }
});
