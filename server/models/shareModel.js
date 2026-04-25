import { model, Schema } from "mongoose";

const shareSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetType: {
      type: String,
      enum: ["file", "directory"],
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    tokenCiphertext: {
      type: String,
      default: null,
    },
    tokenIv: {
      type: String,
      default: null,
    },
    tokenAuthTag: {
      type: String,
      default: null,
    },
    permission: {
      type: String,
      enum: ["view", "download"],
      default: "view",
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    strict: "throw",
    timestamps: true,
  }
);

const Share = model("Share", shareSchema);

export default Share;
