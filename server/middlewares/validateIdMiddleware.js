import mongoose from "mongoose";

export default function (req, res, next, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: `Invalid ID: ${id}` });
  }
  next();
}

//change mongodb to mongoose 