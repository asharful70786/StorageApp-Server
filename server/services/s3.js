import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: 'ap-south-1',
  credentials: {
    accessKeyId: process.env.aws_access_key_id,
    secretAccessKey: process.env.aws_secret_access_key,
  },
});

export const createUploadSignedUrl = async ({ key, contentType }) => {
  const command = new PutObjectCommand({
    Bucket: "zenpixstorageapp",
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: 300,
    signableHeaders: new Set(["content-type"]),
  });

  return url;
};

export const createGetSignedUrl = async ({
  key,
  download = false,
  filename,
}) => {
  const command = new GetObjectCommand({
    Bucket: "zenpixstorageapp",
    Key: key,
    ResponseContentDisposition: `${download ? "attachment" : "inline"}; filename=${encodeURIComponent(filename)}`,
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: 300,
  });

  return url;
};

export const getS3FileMetaData = async (key) => {
  const command = new HeadObjectCommand({
    Bucket: "zenpixstorageapp",
    Key: key,
  });

  return await s3Client.send(command);
};

export const deleteS3File = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: "zenpixstorageapp",
    Key: key,
  });

  return await s3Client.send(command);
};

export const deleteS3Files = async (keys) => {
  const command = new DeleteObjectsCommand({
    Bucket: "zenpixstorageapp",
    Delete: {
      Objects: keys,
      Quiet: false, // set true to skip individual delete responses
    },
  });

  return await s3Client.send(command);
};
