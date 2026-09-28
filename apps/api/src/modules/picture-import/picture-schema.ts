import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import type { PictureFile } from "./types/picture.type";

const pictureDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });

export const pictureDraftSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(160).nullable(),
            quantity: z.number().int().min(0).max(100000).nullable(),
            unitPriceNaira: z.number().min(0).max(20000000).nullable(),
            unit: z.string().trim().min(1).max(40).nullable(),
          })
          .strict(),
      )
      .max(50),
    warnings: z.array(z.string().max(500)).max(10),
  })
  .strict();

export const expensePictureDraftSchema = z
  .object({
    expense: z
      .object({
        description: z.string().trim().min(1).max(500).nullable(),
        amountNaira: z.number().positive().max(20000000).nullable(),
        date: pictureDateSchema.nullable(),
        category: z.string().trim().min(1).max(100).nullable(),
        paymentMethod: z.enum(["cash", "transfer", "card"]).nullable(),
      })
      .strict()
      .nullable(),
    warnings: z.array(z.string().max(500)).max(10),
  })
  .strict();

export const invoicePictureDraftSchema = pictureDraftSchema
  .extend({
    invoice: z
      .object({
        customerName: z.string().trim().min(1).max(160).nullable(),
        dueDate: pictureDateSchema.nullable(),
        taxNaira: z.number().min(0).max(20000000).nullable(),
        discountNaira: z.number().min(0).max(20000000).nullable(),
        totalNaira: z.number().min(0).max(20000000).nullable(),
        notes: z.string().max(2000).nullable(),
      })
      .strict(),
  })
  .strict();

export function validatePicture(file?: PictureFile): PictureFile {
  if (!file?.buffer.length || file.buffer.length > 10 * 1024 * 1024)
    throw new BadRequestException("Choose a JPEG, PNG or WebP picture of at most 10 MB.");
  const bytes = file.buffer;
  const signatures: Record<string, boolean> = {
    "image/jpeg": bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
    "image/png": bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/webp":
      bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP",
  };
  if (!Object.hasOwn(signatures, file.mimetype) || !signatures[file.mimetype])
    throw new BadRequestException("This file is not a supported picture. Use JPEG, PNG or WebP.");
  return file;
}
