import { z } from "zod";

const optionalUrl = z.union([
  z.literal(""),
  z.url({ protocol: /^https?$/, error: "Enter a full http:// or https:// URL." }).max(2048),
]);

export const businessSchema = z.object({
  name: z.string().trim().min(2, "Enter a business name of at least 2 characters.").max(120),
  description: z.string().trim().min(10, "Describe your business in at least 10 characters.").max(2000),
  discoveryArea: z.string().trim().min(2, "Enter a discovery area, such as Pretoria, Centurion & Johannesburg.").max(160).transform(value => value.replace(/\s+/g, " ")),
  location: z.string().trim().min(2, "Enter your town or city.").max(160),
  industry: z.string().trim().max(80, "Keep the industry to 80 characters or fewer.").default(""),
  categories: z.string().trim().min(1, "Enter at least one service category.").max(500)
    .transform(value => [...new Set(value.split(",").map(item => item.trim()).filter(Boolean))])
    .refine(value => value.length > 0 && value.length <= 10 && value.every(item => item.length <= 80),
      "Enter 1 to 10 categories, each no longer than 80 characters."),
  email: z.email("Enter a valid email address.").max(254),
  phone: z.string().trim().min(7, "Enter a contact phone number.").max(30)
    .regex(/^[+()\d\s-]+$/, "Use digits, spaces, +, parentheses or hyphens."),
  website: optionalUrl.transform(value => value || null),
  portfolio: optionalUrl.transform(value => value || null),
});

export const workCaptionSchema = z.string().trim().max(500, "Keep work picture captions to 500 characters or fewer.");

export type ProfileState = {
  values?: Record<string, string>;
  error?: string;
  errors?: Record<string, string[] | undefined>;
};
