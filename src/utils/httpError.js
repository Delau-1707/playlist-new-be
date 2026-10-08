const isProduction = process.env.NODE_ENV === "production";

// Pesan yang aman ditampilkan ke pengguna. Detail error asli (termasuk pesan
// Postgres seperti nama kolom/tabel) hanya dikirim saat development supaya
// memudahkan debugging, dan disembunyikan di production agar tidak membocorkan
// struktur database.
export function sendServerError(
  res,
  error,
  fallbackMessage = "Terjadi kesalahan pada server",
) {
  console.error(error);

  if (res.headersSent) {
    // Respons sudah mulai dikirim (misal saat streaming), tidak bisa diganti
    // lagi dengan JSON. Putuskan koneksi saja.
    res.destroy(error);
    return;
  }

  const payload = {
    message: isProduction ? fallbackMessage : error?.message || fallbackMessage,
  };

  // Saat development, sertakan nama error agar lebih mudah ditelusuri.
  if (!isProduction && error?.name) {
    payload.error = error.name;
  }

  res.status(error?.status || 500).json(payload);
}
