import crypto from "crypto";
import { Types } from "mongoose";
import Directory from "../models/directoryModel.js";
import File from "../models/fileModel.js";
import Share from "../models/shareModel.js";
import { createCloudFrontGetSignedUrl } from "../services/cloudfront.js";

const PUBLIC_SHARE_BASE_PATH = "/share";
const tokenCipherAlgorithm = "aes-256-gcm";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getTokenCipherKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;

  return crypto.scryptSync(secret, "share-link-token", 32);
}

function encryptToken(token) {
  const key = getTokenCipherKey();
  if (!key) return {};

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(tokenCipherAlgorithm, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  return {
    tokenCiphertext: ciphertext.toString("base64"),
    tokenIv: iv.toString("base64"),
    tokenAuthTag: cipher.getAuthTag().toString("base64"),
  };
}

function decryptToken(share) {
  const key = getTokenCipherKey();
  if (!key || !share.tokenCiphertext || !share.tokenIv || !share.tokenAuthTag) {
    return null;
  }

  try {
    const decipher = crypto.createDecipheriv(
      tokenCipherAlgorithm,
      key,
      Buffer.from(share.tokenIv, "base64")
    );

    decipher.setAuthTag(Buffer.from(share.tokenAuthTag, "base64"));

    return Buffer.concat([
      decipher.update(Buffer.from(share.tokenCiphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function getClientUrl() {
  return process.env.CLIENT_URL?.replace(/\/$/, "") || "";
}

function getShareUrl(token) {
  const clientUrl = getClientUrl();
  return clientUrl ? `${clientUrl}${PUBLIC_SHARE_BASE_PATH}/${token}` : token;
}

function serializeShare(share, token = null) {
  const shareToken = token || decryptToken(share);

  return {
    id: share._id,
    targetType: share.targetType,
    targetId: share.targetId,
    permission: share.permission,
    expiresAt: share.expiresAt,
    revokedAt: share.revokedAt,
    createdAt: share.createdAt,
    shareUrl: shareToken ? getShareUrl(shareToken) : null,
    canCopyLink: Boolean(shareToken),
  };
}

function serializeTarget(target, targetType) {
  if (!target) {
    return {
      id: null,
      name: "Deleted item",
      size: 0,
      exists: false,
    };
  }

  return {
    id: target._id,
    name: target.name,
    size: target.size,
    targetType,
    exists: true,
    createdAt: target.createdAt,
    updatedAt: target.updatedAt,
  };
}

async function findOwnedTarget({ targetType, targetId, userId }) {
  if (targetType === "file") {
    return File.findOne({
      _id: targetId,
      userId,
      isUploading: { $ne: true },
    });
  }

  if (targetType === "directory") {
    return Directory.findOne({
      _id: targetId,
      userId,
    });
  }

  return null;
}

async function findActiveShareByToken(token) {
  const share = await Share.findOne({
    tokenHash: hashToken(token),
    revokedAt: null,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  }).lean();

  return share;
}

async function isDirectoryInsideDirectory({ directoryId, rootDirectoryId }) {
  let currentDirectoryId = directoryId?.toString();
  const rootId = rootDirectoryId.toString();

  while (currentDirectoryId) {
    if (currentDirectoryId === rootId) return true;

    const directory = await Directory.findById(currentDirectoryId)
      .select("parentDirId")
      .lean();

    currentDirectoryId = directory?.parentDirId?.toString() || null;
  }

  return false;
}

async function isFileInsideDirectory({ fileId, rootDirectoryId }) {
  const file = await File.findById(fileId).select("parentDirId").lean();
  if (!file) return false;

  return isDirectoryInsideDirectory({
    directoryId: file.parentDirId,
    rootDirectoryId,
  });
}

function getSignedFileUrl({ file, download }) {
  return createCloudFrontGetSignedUrl({
    key: `${file._id}${file.extension}`,
    download,
    filename: file.name,
  });
}

/**
 * Creates a share link for a file or directory owned by the active user.
 *
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @returns {Promise<import("express").Response>}
 */
export const createShare = async (req, res) => {
  const { targetType, targetId, permission = "view", expiresAt = null } = req.body;

  if (!Types.ObjectId.isValid(targetId)) {
    return res.status(400).json({ error: "Invalid item ID." });
  }

  if (!["file", "directory"].includes(targetType)) {
    return res.status(400).json({ error: "Invalid share target type." });
  }

  if (!["view", "download"].includes(permission)) {
    return res.status(400).json({ error: "Invalid share permission." });
  }

  const target = await findOwnedTarget({
    targetType,
    targetId,
    userId: req.user._id,
  });

  if (!target) {
    return res.status(404).json({ error: "Item not found." });
  }

  const expiryDate = expiresAt ? new Date(expiresAt) : null;

  if (expiryDate && expiryDate <= new Date()) {
    return res.status(400).json({ error: "Expiry date must be in the future." });
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const share = await Share.create({
    ownerId: req.user._id,
    targetType,
    targetId,
    tokenHash: hashToken(token),
    ...encryptToken(token),
    permission,
    expiresAt: expiryDate,
  });

  return res.status(201).json(serializeShare(share, token));
};

/**
 * Returns share links created by the active user.
 *
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @returns {Promise<import("express").Response>}
 */
export const getMyShares = async (req, res) => {
  const shares = await Share.find({ ownerId: req.user._id })
    .sort({ createdAt: -1 })
    .lean();

  const sharesWithTargets = await Promise.all(
    shares.map(async (share) => {
      const TargetModel = share.targetType === "file" ? File : Directory;
      const target = await TargetModel.findOne({
        _id: share.targetId,
        userId: req.user._id,
      }).lean();

      return {
        ...serializeShare(share),
        target: serializeTarget(target, share.targetType),
      };
    })
  );

  return res.json({ shares: sharesWithTargets });
};

/**
 * Returns active and revoked shares for a user-owned file or directory.
 *
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @returns {Promise<import("express").Response>}
 */
export const getSharesForItem = async (req, res) => {
  const { targetType, targetId } = req.params;

  const target = await findOwnedTarget({
    targetType,
    targetId,
    userId: req.user._id,
  });

  if (!target) {
    return res.status(404).json({ error: "Item not found." });
  }

  const shares = await Share.find({
    ownerId: req.user._id,
    targetType,
    targetId,
  })
    .sort({ createdAt: -1 })
    .lean();

  return res.json({ shares: shares.map((share) => serializeShare(share)) });
};

/**
 * Revokes a share link owned by the active user.
 *
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @returns {Promise<import("express").Response>}
 */
export const revokeShare = async (req, res) => {
  const share = await Share.findOne({
    _id: req.params.id,
    ownerId: req.user._id,
  });

  if (!share) {
    return res.status(404).json({ error: "Share link not found." });
  }

  share.revokedAt = new Date();
  await share.save();

  return res.json({ message: "Share link revoked." });
};

/**
 * Returns public metadata for a share token.
 *
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @returns {Promise<import("express").Response>}
 */
export const getPublicShare = async (req, res) => {
  const share = await findActiveShareByToken(req.params.token);

  if (!share) {
    return res.status(404).json({ error: "Share link is invalid or expired." });
  }

  if (share.targetType === "file") {
    const file = await File.findOne({
      _id: share.targetId,
      userId: share.ownerId,
      isUploading: { $ne: true },
    }).lean();

    if (!file) {
      return res.status(404).json({ error: "Shared file not found." });
    }

    return res.json({
      targetType: "file",
      permission: share.permission,
      expiresAt: share.expiresAt,
      file: {
        id: file._id,
        name: file.name,
        size: file.size,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        canDownload: share.permission === "download",
      },
    });
  }

  const requestedDirectoryId = req.query.dirId || share.targetId;
  const hasDirectoryAccess = await isDirectoryInsideDirectory({
    directoryId: requestedDirectoryId,
    rootDirectoryId: share.targetId,
  });

  if (!hasDirectoryAccess) {
    return res.status(403).json({ error: "You do not have access to this folder." });
  }

  const directory = await Directory.findOne({
    _id: requestedDirectoryId,
    userId: share.ownerId,
  }).lean();

  if (!directory) {
    return res.status(404).json({ error: "Shared folder not found." });
  }

  const [directories, files] = await Promise.all([
    Directory.find({
      parentDirId: directory._id,
      userId: share.ownerId,
    }).lean(),
    File.find({
      parentDirId: directory._id,
      userId: share.ownerId,
      isUploading: { $ne: true },
    }).lean(),
  ]);

  return res.json({
    targetType: "directory",
    permission: share.permission,
    expiresAt: share.expiresAt,
    directory: {
      id: directory._id,
      rootId: share.targetId,
      name: directory.name,
      size: directory.size,
      createdAt: directory.createdAt,
      updatedAt: directory.updatedAt,
    },
    directories: directories.map((item) => ({
      id: item._id,
      name: item.name,
      size: item.size,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    files: files.map((file) => ({
      id: file._id,
      name: file.name,
      size: file.size,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      canDownload: share.permission === "download",
    })),
  });
};

/**
 * Redirects a public share file request to a signed CloudFront URL.
 *
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @returns {Promise<import("express").Response|void>}
 */
export const openPublicSharedFile = async (req, res) => {
  const share = await findActiveShareByToken(req.params.token);

  if (!share) {
    return res.status(404).json({ error: "Share link is invalid or expired." });
  }

  const download = req.query.action === "download";

  if (download && share.permission !== "download") {
    return res.status(403).json({ error: "Download is disabled for this link." });
  }

  let file = null;

  if (share.targetType === "file") {
    if (share.targetId.toString() !== req.params.fileId) {
      return res.status(403).json({ error: "You do not have access to this file." });
    }

    file = await File.findOne({
      _id: req.params.fileId,
      userId: share.ownerId,
      isUploading: { $ne: true },
    }).lean();
  } else {
    const hasFileAccess = await isFileInsideDirectory({
      fileId: req.params.fileId,
      rootDirectoryId: share.targetId,
    });

    if (!hasFileAccess) {
      return res.status(403).json({ error: "You do not have access to this file." });
    }

    file = await File.findOne({
      _id: req.params.fileId,
      userId: share.ownerId,
      isUploading: { $ne: true },
    }).lean();
  }

  if (!file) {
    return res.status(404).json({ error: "Shared file not found." });
  }

  return res.redirect(getSignedFileUrl({ file, download }));
};
