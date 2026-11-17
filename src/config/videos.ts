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
  satu: "/https://github.com/NOVABOTV1F/ONV2/intro.mp4",
  dua: "https://github.com/NOVABOTV1F/ONV2/login.mp4",
  tiga: "https://github.com/NOVABOTV1F/ONV2/generete.mp4",
} as const;

export type VideoKey = keyof typeof VIDEO_LINKS;
export type VideoLinks = Record<VideoKey, string>;
