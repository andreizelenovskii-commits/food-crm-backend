import { createReadStream, existsSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";
import sharp from "sharp";
import { ValidationError } from "@backend/shared/errors/app-error";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const OPTIMIZED_IMAGE_WIDTH = 1400;
const OPTIMIZED_IMAGE_HEIGHT = 1100;
const OPTIMIZED_IMAGE_QUALITY = 82;
const cwd = process.cwd();

function getProductionAppRoot() {
  if (path.basename(cwd) === "current") {
    return path.dirname(cwd);
  }

  const parentDir = path.dirname(cwd);

  return path.basename(parentDir) === "releases" ? path.dirname(parentDir) : cwd;
}

function getDefaultUploadRoot() {
  if (process.env.NODE_ENV !== "production") {
    return path.resolve(cwd, "uploads/catalog");
  }

  return path.resolve(getProductionAppRoot(), "shared/uploads/catalog");
}

const UPLOAD_ROOT =
  process.env.CATALOG_UPLOAD_DIR?.trim() ||
  getDefaultUploadRoot();
const LEGACY_UPLOAD_ROOTS = Array.from(new Set([
  UPLOAD_ROOT,
  path.resolve(cwd, "uploads/catalog"),
  path.resolve(cwd, "../shared/uploads/catalog"),
  path.resolve(cwd, "../../shared/uploads/catalog"),
]));
const OPTIMIZED_UPLOAD_ROOT = path.join(UPLOAD_ROOT, "_optimized");
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

type MultipartFile = {
  filename: string;
  contentType: string;
  content: Buffer;
};

function getBoundary(contentType: string | undefined) {
  const match = contentType?.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return match?.[1] ?? match?.[2] ?? "";
}

function getHeaderValue(headers: string, name: string) {
  const pattern = new RegExp(`^${name}:\\s*(.+)$`, "im");
  return headers.match(pattern)?.[1]?.trim() ?? "";
}

function getDispositionValue(disposition: string, name: string) {
  const match = disposition.match(new RegExp(`${name}="([^"]+)"`, "i"));
  return match?.[1] ?? "";
}

function parseMultipartFile(body: Buffer, contentType: string | undefined): MultipartFile {
  const boundaryValue = getBoundary(contentType);

  if (!boundaryValue) {
    throw new ValidationError("Не удалось прочитать файл: отсутствует multipart boundary");
  }

  const boundary = Buffer.from(`--${boundaryValue}`);
  let cursor = body.indexOf(boundary);

  while (cursor >= 0) {
    let partStart = cursor + boundary.length;

    if (body.subarray(partStart, partStart + 2).toString("latin1") === "--") {
      break;
    }

    if (body.subarray(partStart, partStart + 2).toString("latin1") === "\r\n") {
      partStart += 2;
    }

    const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), partStart);

    if (headerEnd < 0) {
      break;
    }

    const nextBoundary = body.indexOf(boundary, headerEnd + 4);

    if (nextBoundary < 0) {
      break;
    }

    const headers = body.subarray(partStart, headerEnd).toString("latin1");
    const disposition = getHeaderValue(headers, "content-disposition");
    const filename = getDispositionValue(disposition, "filename");
    const contentStart = headerEnd + 4;
    const contentEnd =
      body.subarray(nextBoundary - 2, nextBoundary).toString("latin1") === "\r\n"
        ? nextBoundary - 2
        : nextBoundary;
    const content = body.subarray(contentStart, contentEnd);

    if (filename && content.length > 0) {
      return {
        filename,
        contentType: getHeaderValue(headers, "content-type").toLowerCase(),
        content,
      };
    }

    cursor = nextBoundary;
  }

  throw new ValidationError("Выберите фото товара для загрузки");
}

function buildPublicUrl(request: FastifyRequest, filename: string) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const host = request.headers["x-forwarded-host"] ?? request.headers.host;

  return `${protocol || "http"}://${host}/uploads/catalog/${filename}`;
}

export async function saveCatalogUpload(request: FastifyRequest) {
  const body = request.body;

  if (!Buffer.isBuffer(body)) {
    throw new ValidationError("Отправьте фото товара multipart/form-data");
  }

  const file = parseMultipartFile(body, request.headers["content-type"]);
  const extension = IMAGE_TYPES[file.contentType];

  if (!extension) {
    throw new ValidationError("Загрузите фото в формате JPG, PNG, WEBP или GIF");
  }

  if (file.content.length > MAX_IMAGE_BYTES) {
    throw new ValidationError("Фото товара должно быть не больше 5 МБ");
  }

  const optimized = await optimizeCatalogImage(file);

  await mkdir(UPLOAD_ROOT, { recursive: true });

  const filename = `${randomUUID()}${optimized.extension}`;
  await writeFile(path.join(UPLOAD_ROOT, filename), optimized.content, { flag: "wx" });

  return {
    filename,
    originalFilename: file.filename,
    imageUrl: buildPublicUrl(request, filename),
  };
}

export async function getCatalogUpload(filename: string) {
  if (!/^[a-f0-9-]+\.(jpg|png|webp|gif)$/i.test(filename)) {
    throw new ValidationError("Некорректное имя файла");
  }

  const extension = path.extname(filename).toLowerCase();
  const contentType = getImageContentType(extension);
  const uploadPath = getCandidateUploadRoots()
    .map((uploadRoot) => path.join(uploadRoot, filename))
    .find((candidatePath) => existsSync(candidatePath));

  if (!uploadPath) {
    throw new ValidationError("Фото товара не найдено");
  }

  const optimizedPath = await getOptimizedUploadPath(filename);

  if (optimizedPath) {
    return {
      contentType: "image/webp",
      stream: createReadStream(optimizedPath),
    };
  }

  return { contentType, stream: createReadStream(uploadPath) };
}

async function optimizeCatalogImage(file: MultipartFile) {
  if (file.contentType === "image/gif") {
    return {
      content: file.content,
      extension: IMAGE_TYPES[file.contentType],
    };
  }

  try {
    const content = await sharp(file.content, { failOn: "none" })
      .rotate()
      .resize({
        width: OPTIMIZED_IMAGE_WIDTH,
        height: OPTIMIZED_IMAGE_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: OPTIMIZED_IMAGE_QUALITY, effort: 4 })
      .toBuffer();

    return { content, extension: ".webp" };
  } catch {
    return {
      content: file.content,
      extension: IMAGE_TYPES[file.contentType],
    };
  }
}

function getImageContentType(extension: string) {
  return Object.entries(IMAGE_TYPES).find(([, typeExtension]) => typeExtension === extension)?.[0] ??
    "application/octet-stream";
}

async function getOptimizedUploadPath(filename: string) {
  const extension = path.extname(filename).toLowerCase();

  if (extension === ".webp" || extension === ".gif") {
    return null;
  }

  const originalPath = getCandidateUploadRoots()
    .map((uploadRoot) => path.join(uploadRoot, filename))
    .find((candidatePath) => existsSync(candidatePath));

  if (!originalPath) {
    return null;
  }

  const optimizedFilename = `${path.basename(filename, extension)}.webp`;
  const optimizedPath = path.join(OPTIMIZED_UPLOAD_ROOT, optimizedFilename);

  if (existsSync(optimizedPath)) {
    return optimizedPath;
  }

  try {
    await mkdir(OPTIMIZED_UPLOAD_ROOT, { recursive: true });
    await sharp(originalPath, { failOn: "none" })
      .rotate()
      .resize({
        width: OPTIMIZED_IMAGE_WIDTH,
        height: OPTIMIZED_IMAGE_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: OPTIMIZED_IMAGE_QUALITY, effort: 4 })
      .toFile(optimizedPath);

    return optimizedPath;
  } catch {
    return null;
  }
}

function getCandidateUploadRoots() {
  const appRoot = getProductionAppRoot();
  const releaseUploadRoots =
    process.env.NODE_ENV === "production" ? getReleaseUploadRoots(appRoot) : [];

  return Array.from(new Set([...LEGACY_UPLOAD_ROOTS, ...releaseUploadRoots]));
}

function getReleaseUploadRoots(appRoot: string) {
  const releasesRoot = path.join(appRoot, "releases");

  try {
    return readdirSync(releasesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(releasesRoot, entry.name, "uploads/catalog"));
  } catch {
    return [];
  }
}
