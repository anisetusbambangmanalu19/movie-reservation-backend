# Movie Reservation Backend

Backend REST API untuk sistem reservasi film.

## Stack

- Node.js + TypeScript
- Express
- PostgreSQL
- Prisma ORM
- JWT Auth + Role-based access (ADMIN/USER)

Alasan stack ini:
- TypeScript/Node.js sangat populer di market kerja backend modern.
- Cocok untuk API cepat, maintainable, dan scalable.
- Kombinasi PostgreSQL + Prisma kuat untuk relasi kompleks (showtime, kursi, reservasi).

## Fitur

- Register dan login user
- Role pengguna: USER dan ADMIN
- Promote user menjadi admin (hanya ADMIN)
- CRUD film (hanya ADMIN)
- Kelola studio/auditorium + kursi (hanya ADMIN)
- Kelola jadwal tayang (hanya ADMIN)
- Daftar film + jadwal (filter tanggal)
- Lihat kursi tersedia per jadwal
- Reservasi kursi dengan proteksi anti overbooking
- Lihat reservasi user sendiri
- Batalkan reservasi yang akan datang
- Laporan reservasi, kapasitas, dan revenue (hanya ADMIN)

## Struktur API

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/promote-admin` (ADMIN)
- `GET /api/movies?date=YYYY-MM-DD`
- `GET /api/movies/showtimes/:showtimeId/seats`
- `POST /api/reservations` (USER/ADMIN login)
- `GET /api/reservations/my` (USER/ADMIN login)
- `DELETE /api/reservations/:reservationId` (owner reservasi)
- `POST /api/admin/auditoriums` (ADMIN)
- `POST /api/admin/movies` (ADMIN)
- `PUT /api/admin/movies/:id` (ADMIN)
- `DELETE /api/admin/movies/:id` (ADMIN)
- `POST /api/admin/showtimes` (ADMIN)
- `GET /api/admin/reports/reservations` (ADMIN)

## Menjalankan Proyek

1. Install dependency

```bash
npm install
```

2. Siapkan database PostgreSQL dan ubah `.env`

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/movie_reservation"
JWT_SECRET="super-secret-change-me"
PORT="3000"
ADMIN_EMAIL="admin@movie.local"
ADMIN_PASSWORD="Admin12345"
ADMIN_NAME="System Admin"
```

3. Generate Prisma client dan jalankan migrasi

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
```

4. Jalankan seed data (membuat admin awal + data sample)

```bash
npm run prisma:seed
```

5. Jalankan server development

```bash
npm run dev
```

Server akan jalan di `http://localhost:3000`.

## Publish ke GitHub (Repository Baru)

1. Buat repo public baru di GitHub, misalnya: `movie-reservation-backend`
2. Jalankan perintah berikut di folder project:

```bash
git add .
git commit -m "feat: initial movie reservation backend"
git branch -M main
git remote add origin https://github.com/<username>/movie-reservation-backend.git
git push -u origin main
```

3. Tambahkan URL repo ke bagian ini setelah upload:

- Project page URL: `https://github.com/<username>/movie-reservation-backend`
