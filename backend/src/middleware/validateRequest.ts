import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export const validateRequest = <T>(schema: ZodSchema<T>, property: "body" | "query" | "params" = "body") => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[property]);

    if (!result.success) {
      res.status(400).json({
        success: false,
        data: null,
        message: "Validation error",
      });
      return;
    }

    (req as any)[property] = result.data;
    next();
  };
};

