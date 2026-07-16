import { Router, type Request, type Response } from "express";
import type { Router as RouterType } from "express";
import { getSelectableModels } from "../models/catalog.js";

export const modelsRouter: RouterType = Router();

/** Returns the normalized selectable OpenRouter model catalog. */
async function getModelsHandler(_req: Request, res: Response) {
  try {
    return res.json({ models: await getSelectableModels() });
  } catch (error) {
    console.error("Unable to load OpenRouter models:", error);
    return res.status(502).json({ error: "Unable to load models" });
  }
}

modelsRouter.get("/", getModelsHandler);
