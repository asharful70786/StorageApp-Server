import express from "express";
import validateIdMiddleware from "../middlewares/validateIdMiddleware.js";
import {
  createShare,
  getMyShares,
  getSharesForItem,
  revokeShare,
} from "../controllers/shareController.js";

const router = express.Router();

router.param("targetId", validateIdMiddleware);
router.param("id", validateIdMiddleware);

router.post("/", createShare);
router.get("/", getMyShares);
router.get("/:targetType/:targetId", getSharesForItem);
router.delete("/:id", revokeShare);

export default router;
