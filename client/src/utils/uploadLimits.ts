/*
Maximum upload size for the client, read from VITE_MAX_UPLOAD_MB and defaulting
to 50 MB. Used to reject oversized files before upload.
*/


const configuredMaxMb = Number(import.meta.env.VITE_MAX_UPLOAD_MB);

export const MAX_UPLOAD_MB =
  Number.isFinite(configuredMaxMb) && configuredMaxMb > 0 ? configuredMaxMb : 50;

export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
