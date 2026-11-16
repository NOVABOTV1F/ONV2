/**
 * FILE KHUSUS LINK VIDEO
 * Ganti ketiga URL ini dengan video kamu (mp4 / webm yang bisa diputar browser).
 * Boleh link penuh (https://...) atau file di folder public, misalnya /videos/satu.mp4
 *
 * satu  — layar penuh di halaman utama (intro + registrasi)
 * dua   — layar kecil di atas form login
 * tiga  — di atas tulisan GENERETE GMAIL
 *
 * Klik bebas di halaman utama menyalakan suara.
 * Video lain ikut bunyi karena klik pertama sudah membuka audio.
 *
 * Bisa juga ditimpa dari TOLS ADMIN tanpa mengubah file ini.
 */
export const VIDEO_LINKS = {
  satu: "/videos/satu.mp4",
  dua: "/videos/dua.mp4",
  tiga: "/videos/tiga.mp4",
} as const;

export type VideoKey = keyof typeof VIDEO_LINKS;
export type VideoLinks = Record<VideoKey, string>;
