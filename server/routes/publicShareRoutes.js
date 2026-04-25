import express from "express";
import validateIdMiddleware from "../middlewares/validateIdMiddleware.js";
import {
  getPublicShare,
  openPublicSharedFile,
} from "../controllers/shareController.js";

const router = express.Router();

router.param("fileId", validateIdMiddleware);

router.get("/:token", getPublicShare);
router.get("/:token/files/:fileId", openPublicSharedFile);

export default router;
