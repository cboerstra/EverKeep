import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export function openBucket({ bucket, region, endpoint, accessKeyId, secretAccessKey }) {
  const client = new S3Client({
    region, ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    credentials: { accessKeyId, secretAccessKey },
  });
  return {
    async put(key, data, { httpMetadata } = {}) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.from(data), ContentType: httpMetadata?.contentType }));
    },
    async get(key) {
      try {
        const file = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return {
          get body() { return file.Body.transformToWebStream(); },
          size: file.ContentLength,
          async arrayBuffer() {
            const bytes = await file.Body.transformToByteArray();
            return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
          },
        };
      } catch (error) {
        if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) return null;
        throw error;
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
