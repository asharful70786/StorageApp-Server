import path from "path";
import { Types } from "mongoose";
import Directory from "../models/directoryModel.js";
import File from "../models/fileModel.js";
import User from "../models/userModel.js";
import { 
  createUploadSignedUrl,
  deleteS3File,
  getS3FileMetaData,
} from "../services/s3.js";
import { createCloudFrontGetSignedUrl } from "../services/cloudfront.js";

export async function updateDirectoriesSize(parentId, deltaSize) {
  while (parentId) {
    const dir = await Directory.findById(parentId);
    dir.size += deltaSize;
    await dir.save();
    parentId = dir.parentDirId;
  }
}

async function getPendingUploadSize(userId) {
  const [pendingUpload] = await File.aggregate([
    {
      $match: {
        userId: new Types.ObjectId(userId),
        isUploading: true,
      },
    },
    {
      $group: {
        _id: null,
        totalSize: { $sum: "$size" },
      },
    },
  ]);

  return pendingUpload?.totalSize || 0;
}

export const getFile = async (req, res) => {
  const { id } = req.params;
  const fileData = await File.findOne({
    _id: id,
    userId: req.user._id,
  }).lean();

  if (!fileData) {
    return res.status(404).json({ error: "File not found!" });
  }

  if (req.query.action === "download") {
    const fileUrl = createCloudFrontGetSignedUrl({
      key: `${id}${fileData.extension}`,
      download: true,
      filename: fileData.name,
    });
    return res.redirect(fileUrl);
  }

  // Send file
  const fileUrl = createCloudFrontGetSignedUrl({
    key: `${id}${fileData.extension}`,
    filename: fileData.name,
  });

  return res.redirect(fileUrl);
};

export const renameFile = async (req, res, next) => {
  const { id } = req.params;
  const file = await File.findOne({
    _id: id,
    userId: req.user._id,
  });


  if (!file) {
    return res.status(404).json({ error: "File not found!" });
  }

  try {
    file.name = req.body.newFilename;
    await file.save();
    return res.status(200).json({ message: "Renamed" });
  } catch (err) {
    console.log(err);
    err.status = 500;
    next(err);
  }
};

export const deleteFile = async (req, res, next) => {
  const { id } = req.params;
  const file = await File.findOne({
    _id: id,
    userId: req.user._id,
  });

  if (!file) {
    return res.status(404).json({ error: "File not found!" });
  }

  try {
    await file.deleteOne();
    await updateDirectoriesSize(file.parentDirId, -file.size);
    await deleteS3File(`${file.id}${file.extension}`);
    return res.status(200).json({ message: "File Deleted Successfully" });
  } catch (err) {
    next(err);
  }
};

/**
 * Creates a file record and returns a signed upload URL for S3.
 *
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @returns {Promise<import("express").Response>}
 */
export const uploadInitiate = async (req, res) => {
  // console.log(`req of body from file upload init ${JSON.stringify(req.body)}`);
  const parentDirId = req.body.parentDirId || req.user.rootDirId;
  try {
    const parentDirData = await Directory.findOne({
      _id: parentDirId,
      userId: req.user._id,
    });

    if (!parentDirData) {
      return res.status(404).json({ error: "Parent directory not found!" });
    }

    const filename = req.body.filename || req.body.name;
    const filesize = Number(req.body.filesize ?? req.body.size ?? 0);
    const extension = path.extname(filename || "");

    if (
      !filename ||
      !extension ||
      !Number.isFinite(filesize) ||
      filesize <= 0
    ) {
      return res.status(400).json({
        error: "Please upload a file with a valid extension.",
      });
    }

    const user = await User.findById(req.user._id);
    const rootDir = await Directory.findById(req.user.rootDirId);
    const pendingUploadSize = await getPendingUploadSize(req.user._id);

    const remainingSpace =
      user.maxStorageInBytes - rootDir.size - pendingUploadSize;

    if (filesize > remainingSpace) {
      console.log("File too large");
      return res.status(507).json({ error: "Not enough storage." });
    }

    const insertedFile = await File.insertOne({
      extension,
      name: filename,
      size: filesize,
      parentDirId: parentDirData._id,
      userId: req.user._id,
      isUploading: true,
    });
    const uploadSignedUrl = await createUploadSignedUrl({
      key: `${insertedFile.id}${extension}`,
      contentType: req.body.contentType,
    });
   return  res.json({ uploadSignedUrl, fileId: insertedFile.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
    console.log(err);
  }
};

/**
 * Verifies a direct S3 upload and marks the file as available.
 *
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Express next callback.
 * @returns {Promise<import("express").Response|void>}
 */
export const uploadComplete = async (req, res, next) => {
  const file = await File.findOne({
    _id: req.body.fileId,
    userId: req.user._id,
  });
  if (!file) {
    return res.status(404).json({ error: "File not found in our records" });
  }

  try {
    const fileData = await getS3FileMetaData(`${file.id}${file.extension}`);
    if (fileData.ContentLength !== file.size) {
      await file.deleteOne();
      return res.status(400).json({ error: "File size does not match." });
    }
    file.isUploading = false;
    await file.save();
    await updateDirectoriesSize(file.parentDirId, file.size);
    res.json({ message: "Upload completed" });
  } catch (err) {
    await file.deleteOne();
    return res
      .status(404)
      .json({ error: "File was could not be uploaded properly." });
  }
};

/**
 * Cancels a pending upload and removes its file record.
 *
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @returns {Promise<import("express").Response>}
 */
export const uploadCancel = async (req, res) => {
  const file = await File.findOne({
    _id: req.params.id,
    userId: req.user._id,
    isUploading: true,
  });

  if (!file) {
    return res.status(404).json({ error: "Pending upload not found." });
  }

  await file.deleteOne();

  try {
    await deleteS3File(`${file.id}${file.extension}`);
  } catch {
    // The object may not exist yet when a user cancels before the PUT starts.
  }

  return res.json({ message: "Upload cancelled" });
};
