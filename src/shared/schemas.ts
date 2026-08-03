import { z } from "zod";

export const DragonReplySchema = z.object({
  dialogue: z.string().max(700),
  choices: z.array(z.object({ id: z.string(), label: z.string() })).max(4),
  hint: z.string().max(300).optional(),
  nextAction: z.enum([
    "NONE",
    "OPEN_POSTCARD",
    "OPEN_FOOD_SEARCH",
    "OPEN_ITINERARY",
  ]),
  citedPlaceIds: z.array(z.string()).default([]),
});

export const DragonChatRequestSchema = z.object({
  language: z.enum(["vi", "en"]).default("vi"),
  questId: z.string().max(80).optional(),
  message: z.string().trim().min(1).max(500),
  unlockedPostcards: z.array(z.string().max(80)).max(4).default([]),
});

export const PlaceSearchSchema = z.object({
  language: z.enum(["vi", "en"]).default("vi"),
  query: z.string().min(1),
  center: z.object({ lat: z.number(), lng: z.number() }).optional(),
  radiusMeters: z.number().positive().default(5000),
  budgetVnd: z.number().optional(),
  dietary: z.enum(["any", "vegetarian"]).optional(),
});

export const RecommendationRequestSchema = z.object({
  language: z.enum(["vi", "en"]).default("vi"),
  landmarkKey: z.string().max(80).optional(),
  budgetVnd: z.number().positive().max(10_000_000).optional(),
  dietary: z.enum(["any", "vegetarian"]).default("any"),
});

export const ItineraryRequestSchema = z.object({
  language: z.enum(["vi", "en"]).default("vi"),
  unlockedPostcards: z.array(z.string()),
  preferences: z.object({
    budgetVnd: z.number().optional(),
    dietary: z.enum(["any", "vegetarian"]).optional(),
    interests: z.array(z.string()).default([]),
  }),
});

export const ItineraryResponseSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(600),
  stops: z
    .array(
      z.object({
        placeKey: z.string().max(80),
        name: z.string().min(1).max(120),
        description: z.string().min(1).max(300),
        googleMapsUri: z.string().url().optional(),
      }),
    )
    .max(4),
  notes: z.array(z.string().max(240)).max(4),
});

export const CuratedPlaceCardSchema = z.object({
  placeId: z.string().nullable(),
  placeIdStatus: z.enum(["verified", "unverified"]),
  landmarkKey: z.string().max(80),
  name: z.string().min(1).max(160),
  description: z.string().min(1).max(500),
  address: z.string().min(1).max(300),
  priceRange: z.string().min(1).max(80),
  dietary: z.enum(["any", "vegetarian"]),
  googleMapsUri: z.string().url(),
  sourceIds: z.array(z.string().min(1)).min(1),
});

export const RecommendationResponseSchema = z.object({
  source: z.literal("curated"),
  places: z.array(CuratedPlaceCardSchema).max(5),
  notice: z.string().nullable(),
});

export const DragonChatResponseSchema = z.object({
  reply: DragonReplySchema,
  source: z.enum(["gemini", "fallback"]),
  retries: z.number().int().min(0).max(1),
  fallback: z.boolean(),
});

export const ItineraryApiResponseSchema = z.object({
  itinerary: ItineraryResponseSchema,
  source: z.enum(["gemini", "fallback"]),
  retries: z.number().int().min(0).max(1),
  fallback: z.boolean(),
});

export type DragonReply = z.infer<typeof DragonReplySchema>;
export type DragonChatRequest = z.infer<typeof DragonChatRequestSchema>;
export type RecommendationRequest = z.infer<typeof RecommendationRequestSchema>;
export type ItineraryRequest = z.infer<typeof ItineraryRequestSchema>;
export type ItineraryResponse = z.infer<typeof ItineraryResponseSchema>;
export type RecommendationResponse = z.infer<
  typeof RecommendationResponseSchema
>;
export type DragonChatResponse = z.infer<typeof DragonChatResponseSchema>;
export type ItineraryApiResponse = z.infer<typeof ItineraryApiResponseSchema>;
