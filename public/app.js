const state = {
  token: localStorage.getItem("token") || "",
  user: (() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  })(),
  movies: [],
  adminMovies: [],
  auditoriums: [],
  showtimes: [],
  activeShowtime: null,
  seats: [],
  selectedSeatIds: new Set(),
};

const els = {
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  showLogin: document.getElementById("showLogin"),
  showRegister: document.getElementById("showRegister"),
  authStatus: document.getElementById("authStatus"),
  logoutBtn: document.getElementById("logoutBtn"),
  movieList: document.getElementById("movieList"),
  seatGrid: document.getElementById("seatGrid"),
  selectedShowtimeLabel: document.getElementById("selectedShowtimeLabel"),
  bookBtn: document.getElementById("bookBtn"),
  reservationList: document.getElementById("reservationList"),
  refreshReservations: document.getElementById("refreshReservations"),
  dateFilter: document.getElementById("dateFilter"),
  adminPanel: document.getElementById("adminPanel"),
  refreshAdminData: document.getElementById("refreshAdminData"),
  createAuditoriumForm: document.getElementById("createAuditoriumForm"),
  createMovieForm: document.getElementById("createMovieForm"),
  updateMovieForm: document.getElementById("updateMovieForm"),
  deleteMovieForm: document.getElementById("deleteMovieForm"),
  createShowtimeForm: document.getElementById("createShowtimeForm"),
  refreshShowtimeTableBtn: document.getElementById("refreshShowtimeTableBtn"),
  showtimeTableBody: document.getElementById("showtimeTableBody"),
  adminTabButtons: document.querySelectorAll("[data-admin-tab]"),
  adminPanes: document.querySelectorAll("[data-admin-pane]"),
  editMovieId: document.getElementById("editMovieId"),
  deleteMovieId: document.getElementById("deleteMovieId"),
  showtimeMovieId: document.getElementById("showtimeMovieId"),
  showtimeAuditoriumId: document.getElementById("showtimeAuditoriumId"),
  loadReportBtn: document.getElementById("loadReportBtn"),
  reportSummary: document.getElementById("reportSummary"),
  reportList: document.getElementById("reportList"),
  toast: document.getElementById("toast"),
};

const toDateInputValue = (date) => {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
};

const showToast = (message, isError = false) => {
  els.toast.hidden = false;
  els.toast.textContent = message;
  els.toast.classList.toggle("error", isError);
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    els.toast.hidden = true;
  }, 2600);
};

const parseGenres = (value) =>
  String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const toIsoFromLocalInput = (dateTimeLocal) => {
  const parsed = new Date(dateTimeLocal);
  return parsed.toISOString();
};

const buildAuditoriumRows = (rowCount, seatsPerRow) => {
  const rows = [];
  for (let idx = 0; idx < rowCount; idx += 1) {
    rows.push({
      rowLabel: String.fromCharCode(65 + idx),
      seatCount: seatsPerRow,
    });
  }
  return rows;
};

const apiFetch = async (path, options = {}) => {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new Error(payload?.message || "Request gagal");
  }

  return payload;
};

const setAuthState = (authData) => {
  if (authData) {
    state.token = authData.token;
    state.user = authData.user;
    localStorage.setItem("token", state.token);
    localStorage.setItem("user", JSON.stringify(state.user));
  } else {
    state.token = "";
    state.user = null;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }
  renderAuthStatus();
  renderAdminVisibility();
};

const renderAuthStatus = () => {
  if (state.user) {
    els.authStatus.textContent = `${state.user.fullName} (${state.user.role})`;
    els.logoutBtn.hidden = false;
  } else {
    els.authStatus.textContent = "Belum login";
    els.logoutBtn.hidden = true;
  }
};

const renderAdminVisibility = () => {
  const isAdmin = state.user?.role === "ADMIN";
  els.adminPanel.hidden = !isAdmin;
};

const activateAdminTab = (tabName) => {
  els.adminTabButtons.forEach((button) => {
    button.classList.toggle("active", button.getAttribute("data-admin-tab") === tabName);
  });

  els.adminPanes.forEach((pane) => {
    pane.classList.toggle("active", pane.getAttribute("data-admin-pane") === tabName);
  });
};

const fillSelect = (element, options, placeholder = "Pilih") => {
  const html = [`<option value="">${placeholder}</option>`]
    .concat(options.map((option) => `<option value="${option.value}">${option.label}</option>`))
    .join("");
  element.innerHTML = html;
};

const syncAdminSelects = () => {
  fillSelect(
    els.editMovieId,
    state.adminMovies.map((movie) => ({ value: movie.id, label: movie.title })),
    "Pilih film"
  );
  fillSelect(
    els.deleteMovieId,
    state.adminMovies.map((movie) => ({ value: movie.id, label: movie.title })),
    "Pilih film"
  );
  fillSelect(
    els.showtimeMovieId,
    state.adminMovies.map((movie) => ({ value: movie.id, label: movie.title })),
    "Pilih film"
  );
  fillSelect(
    els.showtimeAuditoriumId,
    state.auditoriums.map((aud) => ({ value: aud.id, label: `${aud.name} (${aud.capacity} kursi)` })),
    "Pilih auditorium"
  );
};

const renderMovies = () => {
  if (!state.movies.length) {
    els.movieList.innerHTML = '<p class="muted">Belum ada film untuk tanggal ini.</p>';
    return;
  }

  els.movieList.innerHTML = state.movies
    .map((movie) => {
      const showtimes = movie.showtimes
        .map((showtime) => {
          const active = state.activeShowtime?.id === showtime.id ? "active" : "";
          return `<button class="showtime-btn ${active}" data-showtime-id="${showtime.id}">${new Date(showtime.startsAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</button>`;
        })
        .join("");

      return `
        <article class="card">
          <h3>${movie.title}</h3>
          <p>Durasi: ${movie.durationMin} menit</p>
          <p>${movie.description}</p>
          <p>Genre: ${movie.genres.join(", ") || "-"}</p>
          <div class="showtime-row">${showtimes || '<span class="muted">Tidak ada jadwal</span>'}</div>
        </article>
      `;
    })
    .join("");

  els.movieList.querySelectorAll("[data-showtime-id]").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      const showtimeId = event.currentTarget.getAttribute("data-showtime-id");
      await selectShowtime(showtimeId);
    });
  });
};

const renderSeats = () => {
  if (!state.activeShowtime) {
    els.seatGrid.innerHTML = "";
    els.bookBtn.disabled = true;
    return;
  }

  els.selectedShowtimeLabel.textContent = `Showtime: ${new Date(state.activeShowtime.startsAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} - Studio ${state.activeShowtime.auditorium.name}`;

  els.seatGrid.innerHTML = state.seats
    .map((seat) => {
      const classes = ["seat"];
      if (!seat.available) classes.push("taken");
      if (state.selectedSeatIds.has(seat.id)) classes.push("selected");
      return `<button class="${classes.join(" ")}" data-seat-id="${seat.id}" ${seat.available ? "" : "disabled"}>${seat.code}</button>`;
    })
    .join("");

  els.seatGrid.querySelectorAll("[data-seat-id]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      const seatId = event.currentTarget.getAttribute("data-seat-id");
      if (state.selectedSeatIds.has(seatId)) {
        state.selectedSeatIds.delete(seatId);
      } else {
        state.selectedSeatIds.add(seatId);
      }
      renderSeats();
      els.bookBtn.disabled = !state.user || state.selectedSeatIds.size === 0;
    });
  });

  els.bookBtn.disabled = !state.user || state.selectedSeatIds.size === 0;
};

const renderReservations = (reservations) => {
  if (!state.user) {
    els.reservationList.innerHTML = '<p class="muted">Login untuk melihat reservasi.</p>';
    return;
  }

  if (!reservations.length) {
    els.reservationList.innerHTML = '<p class="muted">Belum ada reservasi.</p>';
    return;
  }

  els.reservationList.innerHTML = reservations
    .map((item) => {
      const startsAt = new Date(item.showtime.startsAt);
      const canCancel = item.status === "ACTIVE" && startsAt > new Date();
      const seats = item.reservedSeat.map((s) => s.seat.code).join(", ");
      return `
        <article class="card">
          <h3>${item.showtime.movie.title}</h3>
          <p>${startsAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>
          <p>Kursi: ${seats}</p>
          <p>Status: ${item.status}</p>
          <p>Total: Rp ${Number(item.totalPrice).toLocaleString("id-ID")}</p>
          <div class="resv-actions">
            ${canCancel ? `<button class="btn ghost" data-cancel-id="${item.id}">Batalkan</button>` : ""}
          </div>
        </article>
      `;
    })
    .join("");

  els.reservationList.querySelectorAll("[data-cancel-id]").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      const reservationId = event.currentTarget.getAttribute("data-cancel-id");
      try {
        await apiFetch(`/api/reservations/${reservationId}`, { method: "DELETE" });
        showToast("Reservasi dibatalkan");
        await loadReservations();
      } catch (error) {
        showToast(error.message, true);
      }
    });
  });
};

const renderReport = (report) => {
  if (!report) {
    els.reportSummary.textContent = "Belum ada data laporan.";
    els.reportList.innerHTML = "";
    return;
  }

  const summary = report.summary;
  els.reportSummary.textContent = `Total ${summary.totalReservations} reservasi | Active ${summary.activeReservations} | Cancelled ${summary.cancelledReservations} | Revenue Rp ${Number(summary.totalRevenue).toLocaleString("id-ID")}`;

  if (!report.reservations.length) {
    els.reportList.innerHTML = '<p class="muted">Belum ada reservasi untuk dilaporkan.</p>';
    return;
  }

  els.reportList.innerHTML = report.reservations
    .map((item) => {
      const seats = item.reservedSeat.map((s) => s.seat.code).join(", ");
      return `
        <article class="card">
          <h3>${item.showtime.movie.title}</h3>
          <p>User: ${item.user.fullName} (${item.user.email})</p>
          <p>Studio: ${item.showtime.auditorium.name}</p>
          <p>Waktu: ${new Date(item.showtime.startsAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>
          <p>Kursi: ${seats || "-"}</p>
          <p>Status: ${item.status}</p>
          <p>Total: Rp ${Number(item.totalPrice).toLocaleString("id-ID")}</p>
        </article>
      `;
    })
    .join("");
};

const renderShowtimeTable = () => {
  if (!state.showtimes.length) {
    els.showtimeTableBody.innerHTML = '<tr><td colspan="5" class="muted">Belum ada showtime.</td></tr>';
    return;
  }

  els.showtimeTableBody.innerHTML = state.showtimes
    .map((showtime) => {
      const startsAt = new Date(showtime.startsAt).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      });

      return `
        <tr>
          <td>${showtime.movie.title}</td>
          <td>${showtime.auditorium.name}</td>
          <td>${startsAt}</td>
          <td>Rp ${Number(showtime.basePrice).toLocaleString("id-ID")}</td>
          <td>
            <div class="table-actions">
              <button class="btn ghost" data-edit-showtime-id="${showtime.id}">Edit</button>
              <button class="btn danger" data-delete-showtime-id="${showtime.id}">Hapus</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  els.showtimeTableBody.querySelectorAll("[data-delete-showtime-id]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const showtimeId = event.currentTarget.getAttribute("data-delete-showtime-id");
      const confirmed = window.confirm("Hapus showtime ini?");
      if (!confirmed) {
        return;
      }

      try {
        await apiFetch(`/api/admin/showtimes/${showtimeId}`, { method: "DELETE" });
        showToast("Showtime berhasil dihapus");
        await loadMovies();
        await loadAdminData();
      } catch (error) {
        showToast(error.message, true);
      }
    });
  });

  els.showtimeTableBody.querySelectorAll("[data-edit-showtime-id]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const showtimeId = event.currentTarget.getAttribute("data-edit-showtime-id");
      const target = state.showtimes.find((item) => item.id === showtimeId);
      if (!target) {
        showToast("Showtime tidak ditemukan", true);
        return;
      }

      const startsAtInput = window.prompt(
        "Waktu baru (format: YYYY-MM-DDTHH:mm). Contoh 2026-03-20T19:30",
        new Date(target.startsAt).toISOString().slice(0, 16)
      );
      if (!startsAtInput) {
        return;
      }

      const basePriceInput = window.prompt("Harga baru", String(target.basePrice));
      if (!basePriceInput) {
        return;
      }

      const movieIdInput = window.prompt("Movie ID baru (kosongkan untuk tetap)", target.movieId || "");
      const auditoriumIdInput = window.prompt(
        "Auditorium ID baru (kosongkan untuk tetap)",
        target.auditoriumId || ""
      );

      const payload = {
        startsAt: toIsoFromLocalInput(startsAtInput),
        basePrice: Number(basePriceInput),
      };
      if (movieIdInput && movieIdInput.trim()) payload.movieId = movieIdInput.trim();
      if (auditoriumIdInput && auditoriumIdInput.trim()) payload.auditoriumId = auditoriumIdInput.trim();

      try {
        await apiFetch(`/api/admin/showtimes/${showtimeId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        showToast("Showtime berhasil diupdate");
        await loadMovies();
        await loadAdminData();
      } catch (error) {
        showToast(error.message, true);
      }
    });
  });
};

const loadMovies = async () => {
  try {
    const date = els.dateFilter.value;
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    state.movies = await apiFetch(`/api/movies${query}`, { method: "GET" });
    renderMovies();
  } catch (error) {
    showToast(error.message, true);
  }
};

const selectShowtime = async (showtimeId) => {
  try {
    state.selectedSeatIds.clear();
    const payload = await apiFetch(`/api/movies/showtimes/${showtimeId}/seats`, { method: "GET" });
    state.activeShowtime = payload.showtime;
    state.seats = payload.seats;
    renderMovies();
    renderSeats();
  } catch (error) {
    showToast(error.message, true);
  }
};

const loadReservations = async () => {
  if (!state.user) {
    renderReservations([]);
    return;
  }

  try {
    const reservations = await apiFetch("/api/reservations/my", { method: "GET" });
    renderReservations(reservations);
  } catch (error) {
    showToast(error.message, true);
  }
};

const loadAdminData = async () => {
  if (!state.user || state.user.role !== "ADMIN") {
    return;
  }

  try {
    const [movies, auditoriums, showtimes] = await Promise.all([
      apiFetch("/api/admin/movies", { method: "GET" }),
      apiFetch("/api/admin/auditoriums", { method: "GET" }),
      apiFetch("/api/admin/showtimes", { method: "GET" }),
    ]);

    state.adminMovies = movies;
    state.auditoriums = auditoriums;
    state.showtimes = showtimes;
    syncAdminSelects();
    renderShowtimeTable();
  } catch (error) {
    showToast(error.message, true);
  }
};

const loadReport = async () => {
  if (!state.user || state.user.role !== "ADMIN") {
    return;
  }

  try {
    const report = await apiFetch("/api/admin/reports/reservations", { method: "GET" });
    renderReport(report);
  } catch (error) {
    showToast(error.message, true);
  }
};

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(els.loginForm);

  try {
    const payload = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });

    setAuthState(payload);
    showToast("Login berhasil");
    await loadReservations();
    await loadAdminData();
    await loadReport();
    renderSeats();
  } catch (error) {
    showToast(error.message, true);
  }
});

els.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(els.registerForm);

  try {
    await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName: formData.get("fullName"),
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });

    showToast("Registrasi berhasil, silakan login");
    els.showLogin.click();
    els.loginForm.querySelector("input[name='email']").value = String(formData.get("email"));
  } catch (error) {
    showToast(error.message, true);
  }
});

els.showLogin.addEventListener("click", () => {
  els.showLogin.classList.add("active");
  els.showRegister.classList.remove("active");
  els.loginForm.hidden = false;
  els.registerForm.hidden = true;
});

els.showRegister.addEventListener("click", () => {
  els.showRegister.classList.add("active");
  els.showLogin.classList.remove("active");
  els.registerForm.hidden = false;
  els.loginForm.hidden = true;
});

els.logoutBtn.addEventListener("click", async () => {
  setAuthState(null);
  state.adminMovies = [];
  state.auditoriums = [];
  state.showtimes = [];
  syncAdminSelects();
  renderShowtimeTable();
  renderReport(null);
  showToast("Logout berhasil");
  await loadReservations();
  renderSeats();
});

els.bookBtn.addEventListener("click", async () => {
  if (!state.activeShowtime) {
    showToast("Pilih showtime terlebih dahulu", true);
    return;
  }

  if (!state.user) {
    showToast("Silakan login dulu", true);
    return;
  }

  try {
    await apiFetch("/api/reservations", {
      method: "POST",
      body: JSON.stringify({
        showtimeId: state.activeShowtime.id,
        seatIds: Array.from(state.selectedSeatIds),
      }),
    });

    showToast("Reservasi berhasil dibuat");
    await selectShowtime(state.activeShowtime.id);
    await loadReservations();
  } catch (error) {
    showToast(error.message, true);
  }
});

els.refreshReservations.addEventListener("click", loadReservations);
els.dateFilter.addEventListener("change", loadMovies);
els.refreshAdminData.addEventListener("click", async () => {
  await loadAdminData();
  showToast("Data admin diperbarui");
});

els.createAuditoriumForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(els.createAuditoriumForm);

  const rowCount = Number(formData.get("rowCount"));
  const seatsPerRow = Number(formData.get("seatsPerRow"));

  if (!Number.isInteger(rowCount) || !Number.isInteger(seatsPerRow) || rowCount <= 0 || seatsPerRow <= 0) {
    showToast("Jumlah baris dan kursi harus angka positif", true);
    return;
  }

  if (rowCount > 26) {
    showToast("Maksimal 26 baris (A-Z)", true);
    return;
  }

  try {
    await apiFetch("/api/admin/auditoriums", {
      method: "POST",
      body: JSON.stringify({
        name: String(formData.get("name") || "").trim(),
        rows: buildAuditoriumRows(rowCount, seatsPerRow),
      }),
    });

    els.createAuditoriumForm.reset();
    showToast("Auditorium berhasil dibuat");
    await loadAdminData();
  } catch (error) {
    showToast(error.message, true);
  }
});

els.createMovieForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(els.createMovieForm);

  try {
    await apiFetch("/api/admin/movies", {
      method: "POST",
      body: JSON.stringify({
        title: String(formData.get("title") || "").trim(),
        description: String(formData.get("description") || "").trim(),
        posterUrl: String(formData.get("posterUrl") || "").trim(),
        durationMin: Number(formData.get("durationMin")),
        genres: parseGenres(formData.get("genres")),
      }),
    });

    els.createMovieForm.reset();
    showToast("Film berhasil ditambahkan");
    await loadMovies();
    await loadAdminData();
  } catch (error) {
    showToast(error.message, true);
  }
});

els.updateMovieForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(els.updateMovieForm);
  const movieId = String(formData.get("id") || "").trim();
  if (!movieId) {
    showToast("Pilih film dulu", true);
    return;
  }

  const payload = {};
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const posterUrl = String(formData.get("posterUrl") || "").trim();
  const durationRaw = String(formData.get("durationMin") || "").trim();
  const genresRaw = String(formData.get("genres") || "").trim();

  if (title) payload.title = title;
  if (description) payload.description = description;
  if (posterUrl) payload.posterUrl = posterUrl;
  if (durationRaw) payload.durationMin = Number(durationRaw);
  if (genresRaw) payload.genres = parseGenres(genresRaw);

  if (Object.keys(payload).length === 0) {
    showToast("Isi minimal satu field untuk diupdate", true);
    return;
  }

  try {
    await apiFetch(`/api/admin/movies/${movieId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    els.updateMovieForm.reset();
    showToast("Film berhasil diupdate");
    await loadMovies();
    await loadAdminData();
  } catch (error) {
    showToast(error.message, true);
  }
});

els.deleteMovieForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(els.deleteMovieForm);
  const movieId = String(formData.get("id") || "").trim();
  if (!movieId) {
    showToast("Pilih film yang ingin dihapus", true);
    return;
  }

  const confirmed = window.confirm("Hapus film ini? Semua showtime terkait akan ikut terhapus.");
  if (!confirmed) {
    return;
  }

  try {
    await apiFetch(`/api/admin/movies/${movieId}`, { method: "DELETE" });
    els.deleteMovieForm.reset();
    showToast("Film berhasil dihapus");
    await loadMovies();
    await loadAdminData();
  } catch (error) {
    showToast(error.message, true);
  }
});

els.createShowtimeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(els.createShowtimeForm);

  const startsAtInput = String(formData.get("startsAt") || "").trim();
  if (!startsAtInput) {
    showToast("Waktu showtime wajib diisi", true);
    return;
  }

  try {
    await apiFetch("/api/admin/showtimes", {
      method: "POST",
      body: JSON.stringify({
        movieId: String(formData.get("movieId") || "").trim(),
        auditoriumId: String(formData.get("auditoriumId") || "").trim(),
        startsAt: toIsoFromLocalInput(startsAtInput),
        basePrice: Number(formData.get("basePrice")),
      }),
    });

    els.createShowtimeForm.reset();
    showToast("Showtime berhasil dibuat");
    await loadMovies();
    await loadAdminData();
  } catch (error) {
    showToast(error.message, true);
  }
});

els.refreshShowtimeTableBtn.addEventListener("click", async () => {
  await loadAdminData();
  showToast("Showtime diperbarui");
});

els.adminTabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const tabName = button.getAttribute("data-admin-tab");
    activateAdminTab(tabName);
  });
});

els.loadReportBtn.addEventListener("click", loadReport);

const init = async () => {
  els.dateFilter.value = toDateInputValue(new Date());
  renderAuthStatus();
  renderAdminVisibility();
  activateAdminTab("master");
  syncAdminSelects();
  renderShowtimeTable();
  renderReport(null);
  await loadMovies();
  await loadReservations();
  await loadAdminData();
  renderSeats();
};

init();
