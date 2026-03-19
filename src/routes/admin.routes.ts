import { Router } from "express";
import { ReservationStatus } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { authRequired, requireRole } from "../middleware/auth";

const movieSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  posterUrl: z.string().url(),
  durationMin: z.number().int().positive(),
  genres: z.array(z.string().min(1)).min(1),
});

const movieUpdateSchema = movieSchema.partial();

const showtimeSchema = z.object({
  movieId: z.string().uuid(),
  auditoriumId: z.string().uuid(),
  startsAt: z.string().datetime(),
  basePrice: z.number().int().positive(),
});

const auditoriumSchema = z.object({
  name: z.string().min(1),
  rows: z.array(z.object({ rowLabel: z.string().min(1), seatCount: z.number().int().positive() })).min(1),
});

export const adminRouter = Router();

adminRouter.use(authRequired, requireRole("ADMIN"));

adminRouter.post("/auditoriums", async (req, res, next) => {
  try {
    const body = auditoriumSchema.parse(req.body);
    const seats = body.rows.flatMap((row) =>
      Array.from({ length: row.seatCount }).map((_, idx) => {
        const seatNumber = idx + 1;
        return {
          rowLabel: row.rowLabel,
          seatNumber,
          code: `${row.rowLabel}${seatNumber}`,
        };
      })
    );

    const auditorium = await prisma.auditorium.create({
      data: {
        name: body.name,
        capacity: seats.length,
        seats: {
          createMany: {
            data: seats,
          },
        },
      },
      include: {
        seats: true,
      },
    });

    res.status(201).json(auditorium);
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/movies", async (req, res, next) => {
  try {
    const body = movieSchema.parse(req.body);

    const genres = await Promise.all(
      body.genres.map((name) =>
        prisma.genre.upsert({
          where: { name },
          update: {},
          create: { name },
        })
      )
    );

    const movie = await prisma.movie.create({
      data: {
        title: body.title,
        description: body.description,
        posterUrl: body.posterUrl,
        durationMin: body.durationMin,
        genres: {
          create: genres.map((genre) => ({ genreId: genre.id })),
        },
      },
      include: {
        genres: { include: { genre: true } },
      },
    });

    res.status(201).json(movie);
  } catch (err) {
    next(err);
  }
});

adminRouter.put("/movies/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const body = movieUpdateSchema.parse(req.body);

    if (body.genres) {
      const genres = await Promise.all(
        body.genres.map((name) =>
          prisma.genre.upsert({
            where: { name },
            update: {},
            create: { name },
          })
        )
      );

      await prisma.movieGenre.deleteMany({ where: { movieId: id } });
      await prisma.movieGenre.createMany({
        data: genres.map((g) => ({ movieId: id, genreId: g.id })),
      });
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.posterUrl !== undefined) updateData.posterUrl = body.posterUrl;
    if (body.durationMin !== undefined) updateData.durationMin = body.durationMin;

    const movie = await prisma.movie.update({
      where: { id },
      data: updateData,
      include: {
        genres: { include: { genre: true } },
      },
    });

    res.json(movie);
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/movies/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    await prisma.movie.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/showtimes", async (req, res, next) => {
  try {
    const body = showtimeSchema.parse(req.body);

    const startsAt = new Date(body.startsAt);
    const overlap = await prisma.showtime.findFirst({
      where: {
        auditoriumId: body.auditoriumId,
        startsAt: {
          gte: new Date(startsAt.getTime() - 3 * 60 * 60 * 1000),
          lte: new Date(startsAt.getTime() + 3 * 60 * 60 * 1000),
        },
      },
    });

    if (overlap) {
      res.status(409).json({ message: "Potential showtime overlap in the same auditorium" });
      return;
    }

    const showtime = await prisma.showtime.create({
      data: {
        movieId: body.movieId,
        auditoriumId: body.auditoriumId,
        startsAt,
        basePrice: body.basePrice,
      },
      include: { movie: true, auditorium: true },
    });

    res.status(201).json(showtime);
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/reports/reservations", async (_req, res, next) => {
  try {
    const [reservations, activeCount, cancelledCount] = await Promise.all([
      prisma.reservation.findMany({
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          showtime: {
            include: {
              movie: true,
              auditorium: true,
            },
          },
          reservedSeat: {
            include: { seat: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.reservation.count({ where: { status: ReservationStatus.ACTIVE } }),
      prisma.reservation.count({ where: { status: ReservationStatus.CANCELLED } }),
    ]);

    const totalRevenue = reservations
      .filter((r) => r.status === ReservationStatus.ACTIVE)
      .reduce((acc, item) => acc + item.totalPrice, 0);

    res.json({
      summary: {
        totalReservations: reservations.length,
        activeReservations: activeCount,
        cancelledReservations: cancelledCount,
        totalRevenue,
      },
      reservations,
    });
  } catch (err) {
    next(err);
  }
});
