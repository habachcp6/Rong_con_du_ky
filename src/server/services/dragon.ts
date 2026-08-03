import { GoogleGenAI } from "@google/genai";
import {
  DragonReplySchema,
  ItineraryResponseSchema,
  type DragonChatRequest,
  type DragonReply,
  type ItineraryRequest,
  type ItineraryResponse,
} from "../../shared/schemas.js";
import type { Language } from "../../shared/types.js";
import { ContentRepository, type DialogueNode } from "./content.js";

export type DragonResult = {
  reply: DragonReply;
  source: "gemini" | "fallback";
  retries: number;
};

export type ItineraryResult = {
  itinerary: ItineraryResponse;
  source: "gemini" | "fallback";
  retries: number;
};

export type DragonService = {
  chat(request: DragonChatRequest): Promise<DragonResult>;
  itinerary(request: ItineraryRequest): Promise<ItineraryResult>;
};

export type DragonServiceOptions = {
  apiKey: string;
  model: string;
  content: ContentRepository;
};

const NPC_BY_QUEST: Record<string, string> = {
  dragon_bridge_lights: "dragon_bridge_npc",
  my_khe_clean_wave: "my_khe_npc",
  marble_five_elements: "marble_npc",
  son_tra_traces: "son_tra_npc",
};

const DRAGON_REPLY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["dialogue", "choices", "nextAction", "citedPlaceIds"],
  properties: {
    dialogue: { type: "string", maxLength: 700 },
    choices: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label"],
        properties: { id: { type: "string" }, label: { type: "string" } },
      },
    },
    hint: { type: "string", maxLength: 300 },
    nextAction: {
      type: "string",
      enum: ["NONE", "OPEN_POSTCARD", "OPEN_FOOD_SEARCH", "OPEN_ITINERARY"],
    },
    citedPlaceIds: { type: "array", items: { type: "string" } },
  },
} as const;

const ITINERARY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "stops", "notes"],
  properties: {
    title: { type: "string", maxLength: 120 },
    summary: { type: "string", maxLength: 600 },
    stops: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["placeKey", "name", "description"],
        properties: {
          placeKey: { type: "string" },
          name: { type: "string", maxLength: 120 },
          description: { type: "string", maxLength: 300 },
          googleMapsUri: { type: "string" },
        },
      },
    },
    notes: {
      type: "array",
      maxItems: 4,
      items: { type: "string", maxLength: 240 },
    },
  },
} as const;

const languageLabel = (language: Language): string =>
  language === "vi" ? "Vietnamese" : "English";

const fallbackNode = (language: Language): DialogueNode =>
  language === "vi"
    ? {
        greeting: "Mình là Rồng Con. Hãy cùng khám phá Đà Nẵng từng bước nhé!",
        questPrompt:
          "Hãy đến gần một địa danh và nhấn E hoặc Space để bắt đầu thử thách.",
        successMessage: "Tuyệt vời, một Mảnh Ký Ức mới đã được ghi lại!",
        failureMessage: "Không sao, bạn có thể thử lại bất cứ lúc nào.",
        sourceIds: [],
      }
    : {
        greeting:
          "I am Little Dragon. Let us explore Da Nang one step at a time!",
        questPrompt:
          "Walk to a landmark and press E or Space to begin its challenge.",
        successMessage: "Wonderful, a new Memory Fragment has been recorded!",
        failureMessage: "That is okay; you can retry whenever you are ready.",
        sourceIds: [],
      };

const parseJson = (text: string): unknown => {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(trimmed);
};

function makeFallbackReply(
  repository: ContentRepository,
  request: DragonChatRequest,
): DragonReply {
  const node =
    repository.dialogue(request.language)[
      NPC_BY_QUEST[request.questId ?? ""]
    ] ?? fallbackNode(request.language);
  const asksForHint = /gợi|hint|help|giúp|khó/i.test(request.message);
  const dialogue = asksForHint
    ? `${node.greeting} ${node.questPrompt}`
    : node.questPrompt;
  return {
    dialogue,
    choices: [
      {
        id: "close",
        label:
          request.language === "vi" ? "Tiếp tục khám phá" : "Keep exploring",
      },
    ],
    ...(asksForHint ? { hint: node.questPrompt } : {}),
    nextAction: "NONE",
    citedPlaceIds: [],
  };
}

function makeFallbackItinerary(
  repository: ContentRepository,
  request: ItineraryRequest,
): ItineraryResponse {
  const locations = repository.locations(request.language);
  const unlocked = [...new Set(request.unlockedPostcards)]
    .filter((key) => locations[key])
    .slice(0, 4);
  const isVietnamese = request.language === "vi";
  const interests = request.preferences.interests.slice(0, 3).join(", ");

  return {
    title: isVietnamese ? "Lịch trình Dấu Ấn Đà Nẵng" : "Da Nang Memory Trail",
    summary:
      unlocked.length > 0
        ? isVietnamese
          ? `Một hành trình ngắn dựa trên ${unlocked.length} địa danh bạn đã mở khóa${interests ? ` và sở thích ${interests}` : ""}.`
          : `A short route based on the ${unlocked.length} landmarks you unlocked${interests ? ` and your interests: ${interests}` : ""}.`
        : isVietnamese
          ? "Hãy hoàn thành một thử thách để mở khóa các điểm dừng cho lịch trình của bạn."
          : "Complete a challenge to unlock itinerary stops.",
    stops: unlocked.map((placeKey) => {
      const location = locations[placeKey];
      return {
        placeKey,
        name: location.name,
        description: location.visitTip,
        googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.name} Da Nang`)}`,
      };
    }),
    notes: [
      isVietnamese
        ? "Kiểm tra thông tin hiện tại và điều kiện thời tiết trước khi đi."
        : "Check current information and weather before you go.",
    ],
  };
}

/** A structured response still needs semantic validation: the model may not
 * introduce a stop the caller did not unlock, even when its JSON is valid. */
export function requireUnlockedItineraryStops(
  itinerary: ItineraryResponse,
  unlockedPostcards: readonly string[],
): ItineraryResponse {
  const allowed = new Set(unlockedPostcards);
  if (itinerary.stops.some((stop) => !allowed.has(stop.placeKey))) {
    throw new Error("Itinerary contains a landmark that is not unlocked");
  }
  return itinerary;
}

function systemInstruction(
  repository: ContentRepository,
  language: Language,
): string {
  const approvedFacts = repository.approvedFacts(language).join("\n");
  return [
    "You are Rồng Con, a friendly, curious Da Nang guide.",
    `Reply only in ${languageLabel(language)} and keep ordinary dialogue under 80 words.`,
    "Use only the approved facts below. Do not invent historical facts, places, ratings, prices, opening hours, or recommendations.",
    "Never decide quest state, rewards, scores, puzzle answers, or player progression.",
    "If context is insufficient, say so and offer a safe next action. Do not collect personal data.",
    "Return only JSON matching the supplied response schema.",
    "Approved facts:",
    approvedFacts,
  ].join("\n");
}

export class GeminiDragonService implements DragonService {
  private readonly client: GoogleGenAI | null;

  public constructor(private readonly options: DragonServiceOptions) {
    this.client = options.apiKey
      ? new GoogleGenAI({
          apiKey: options.apiKey,
          httpOptions: { apiVersion: "v1", timeout: 7_500 },
        })
      : null;
  }

  public async chat(request: DragonChatRequest): Promise<DragonResult> {
    const fallback = makeFallbackReply(this.options.content, request);
    if (!this.client)
      return { reply: fallback, source: "fallback", retries: 0 };

    try {
      const reply = await this.requestStructured(
        request.message,
        request.language,
        DRAGON_REPLY_JSON_SCHEMA,
        DragonReplySchema,
        "Please repair the JSON so it exactly matches the response schema.",
      );
      return { reply, source: "gemini", retries: 0 };
    } catch {
      // Retry once for a transient provider failure or an invalid structured response.
      try {
        const reply = await this.requestStructured(
          request.message,
          request.language,
          DRAGON_REPLY_JSON_SCHEMA,
          DragonReplySchema,
          "Return valid JSON only, exactly matching the response schema.",
        );
        return { reply, source: "gemini", retries: 1 };
      } catch {
        return { reply: fallback, source: "fallback", retries: 1 };
      }
    }
  }

  public async itinerary(request: ItineraryRequest): Promise<ItineraryResult> {
    const fallback = makeFallbackItinerary(this.options.content, request);
    if (!this.client)
      return { itinerary: fallback, source: "fallback", retries: 0 };

    const facts = request.unlockedPostcards
      .map(
        (placeKey) =>
          this.options.content.locations(request.language)[placeKey],
      )
      .filter((location) => location !== undefined)
      .map(
        (location) =>
          `${location.name}: ${location.shortDescription} ${location.visitTip}`,
      )
      .join("\n");
    const prompt = [
      "Create a concise itinerary strictly from these unlocked landmarks and preferences.",
      `Unlocked landmark facts:\n${facts || "None"}`,
      `Preferences: ${JSON.stringify(request.preferences)}`,
      "Do not add unlisted places. A zero-stop itinerary is valid when nothing is unlocked.",
    ].join("\n\n");

    try {
      const itinerary = await this.requestStructured(
        prompt,
        request.language,
        ITINERARY_JSON_SCHEMA,
        ItineraryResponseSchema,
        "Please repair the JSON itinerary so it exactly matches the response schema.",
      );
      return {
        itinerary: requireUnlockedItineraryStops(
          itinerary,
          request.unlockedPostcards,
        ),
        source: "gemini",
        retries: 0,
      };
    } catch {
      try {
        const itinerary = await this.requestStructured(
          prompt,
          request.language,
          ITINERARY_JSON_SCHEMA,
          ItineraryResponseSchema,
          "Return valid JSON only, exactly matching the response schema.",
        );
        return {
          itinerary: requireUnlockedItineraryStops(
            itinerary,
            request.unlockedPostcards,
          ),
          source: "gemini",
          retries: 1,
        };
      } catch {
        return { itinerary: fallback, source: "fallback", retries: 1 };
      }
    }
  }

  private async requestStructured<T>(
    input: string,
    language: Language,
    responseSchema: Record<string, unknown>,
    validator: { parse(value: unknown): T },
    repairInstruction: string,
  ): Promise<T> {
    if (!this.client) throw new Error("Gemini is not configured");

    const interaction = await this.client.interactions.create(
      {
        model: this.options.model,
        input: `${input}\n\n${repairInstruction}`,
        store: false,
        system_instruction: systemInstruction(this.options.content, language),
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: responseSchema,
        },
      },
      { timeout: 7_500, maxRetries: 0 },
    );
    const output = interaction.output_text;
    if (!output) throw new Error("Gemini returned no text output");
    return validator.parse(parseJson(output));
  }
}
