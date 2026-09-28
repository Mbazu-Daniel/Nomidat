import type { z } from "zod";
import type {
  pictureDraftSchema,
  invoicePictureDraftSchema,
  expensePictureDraftSchema,
} from "../picture-schema";

export type PictureDraft =
  | z.infer<typeof pictureDraftSchema>
  | z.infer<typeof expensePictureDraftSchema>
  | z.infer<typeof invoicePictureDraftSchema>;
export type PictureFile = { buffer: Buffer; mimetype: string };
