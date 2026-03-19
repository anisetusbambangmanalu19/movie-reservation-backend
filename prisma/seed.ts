import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

import { env } from "../src/lib/env";

const prisma = new PrismaClient();

const buildSeats = (rows: Array<{ rowLabel: string; seatCount: number }>) => {
  return rows.flatMap((row) =>
    Array.from({ length: row.seatCount }).map((_, idx) => {
      const seatNumber = idx + 1;
      return {
        rowLabel: row.rowLabel,
        seatNumber,
        code: `${row.rowLabel}${seatNumber}`,
      };
    })
  );
};

async function main() {
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: env.ADMIN_EMAIL },
    update: {
      fullName: env.ADMIN_NAME,
      passwordHash,
      role: "ADMIN",
    },
    create: {
      email: env.ADMIN_EMAIL,
      fullName: env.ADMIN_NAME,
      passwordHash,
      role: "ADMIN",
    },
  });

  const genreNames = ["Action", "Sci-Fi", "Drama", "Comedy"];
  const genres = await Promise.all(
    genreNames.map((name) =>
      prisma.genre.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  );

  const auditorium = await prisma.auditorium.upsert({
    where: { name: "Studio A" },
    update: {},
    create: {
      name: "Studio A",
      capacity: 40,
      seats: {
        createMany: {
          data: buildSeats([
            { rowLabel: "A", seatCount: 10 },
            { rowLabel: "B", seatCount: 10 },
            { rowLabel: "C", seatCount: 10 },
            { rowLabel: "D", seatCount: 10 },
          ]),
        },
      },
    },
  });

  const movie = await prisma.movie.upsert({
    where: { id: "b185af3e-3579-4ea0-b6e2-c45653e6a8be" },
    update: {},
    create: {
      id: "b185af3e-3579-4ea0-b6e2-c45653e6a8be",
      title: "Galactic Echo",
      description: "A rescue mission in deep space with impossible odds.",
      posterUrl: "https://example.com/poster/galactic-echo.jpg",
      durationMin: 132,
    },
  });

  await prisma.movieGenre.deleteMany({ where: { movieId: movie.id } });
  await prisma.movieGenre.createMany({
    data: [genres[0], genres[1]].map((genre) => ({
      movieId: movie.id,
      genreId: genre!.id,
    })),
  });

  const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.showtime.upsert({
    where: { id: "6ac744ce-e6f1-4ed3-9878-61ce16d0f907" },
    update: {
      startsAt,
      basePrice: 50000,
      movieId: movie.id,
      auditoriumId: auditorium.id,
    },
    create: {
      id: "6ac744ce-e6f1-4ed3-9878-61ce16d0f907",
      movieId: movie.id,
      auditoriumId: auditorium.id,
      startsAt,
      basePrice: 50000,
    },
  });

  console.log(`Seed complete. Admin: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
