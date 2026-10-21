import { z } from "zod";
export const reviewSchema = z.object({
  authorId: z.string().min(1).max(100),
  targetId: z.string().min(1).max(100),
  rating: z.coerce.number().int().min(1, "Choose a rating from 1 to 5.").max(5, "Choose a rating from 1 to 5."),
  body: z.string().trim().min(10, "Describe your experience in at least 10 characters.").max(2000, "Keep your review to 2,000 characters or fewer."),
});
export function reviewPairAllowed(author: { id: string; ownerId: string | null }, target: { id: string; ownerId: string | null }, userId: string) {
  return author.ownerId === userId && !!target.ownerId && author.id !== target.id && author.ownerId !== target.ownerId;
}
