import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return `${PUBLIC_URL}/${key}`;
}

export async function deleteFile(key: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  );
}

export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 600
): Promise<string> {
  return getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn }
  );
}

export async function headObject(
  key: string
): Promise<{ sizeBytes: number; contentType: string } | null> {
  try {
    const res = await r2.send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: key })
    );
    return {
      sizeBytes: Number(res.ContentLength ?? 0),
      contentType: res.ContentType ?? "application/octet-stream",
    };
  } catch {
    return null;
  }
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 3600,
  responseContentDisposition?: string
): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ...(responseContentDisposition
        ? { ResponseContentDisposition: responseContentDisposition }
        : {}),
    }),
    { expiresIn }
  );
}

export function getPublicUrl(key: string): string {
  return `${PUBLIC_URL}/${key}`;
}

export function getKeyFromUrl(url: string): string | null {
  if (!url.startsWith(PUBLIC_URL)) return null;
  return url.slice(PUBLIC_URL.length + 1);
}
