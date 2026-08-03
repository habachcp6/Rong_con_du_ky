import fs from "node:fs";
import path from "node:path";
import type { Language } from "../../shared/types.js";

export type ContentLocation = {
  key: string;
  name: string;
  shortDescription: string;
  funFact: string;
  visitTip: string;
  authoredImage: string;
  assetId: string;
  imageAttributionId: string;
  sourceIds: string[];
};

export type DialogueNode = {
  greeting: string;
  questPrompt: string;
  successMessage: string;
  failureMessage: string;
  sourceIds: string[];
};

export type CuratedPlace = {
  placeId: string | null;
  placeIdStatus: "verified" | "unverified";
  landmarkKey: string;
  name: string;
  description: string;
  address: string;
  priceRange: string;
  dietary: "any" | "vegetarian";
  googleMapsUri: string;
  sourceIds: string[];
};

type CuratedPlaceSource = {
  id: string;
  placeId: string | null;
  placeIdStatus: "verified" | "unverified";
  landmarkKey: string;
  nameVi: string;
  nameEn: string;
  descriptionVi: string;
  descriptionEn: string;
  address: string;
  priceRange: string;
  dietary: "any" | "vegetarian";
  googleMapsUri: string;
  sourceIds: string[];
};

type JsonRecord<T> = Record<string, T>;

const readJson = <T>(filePath: string): T | undefined => {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return undefined;
  }
};

/**
 * Reads the authored content directory at runtime. Keeping this at the service
 * edge means curated copy never has a second TypeScript source of truth.
 */
export class ContentRepository {
  private readonly cache = new Map<string, unknown>();

  public constructor(
    private readonly contentDir = path.resolve(process.cwd(), "content"),
  ) {}

  public locations(language: Language): JsonRecord<ContentLocation> {
    return this.load(`locations.${language}.json`) ?? {};
  }

  public dialogue(language: Language): JsonRecord<DialogueNode> {
    return this.load(`dialogue.${language}.json`) ?? {};
  }

  public curatedPlaces(language: Language): CuratedPlace[] {
    const data = this.load<unknown>("curated-places.json");
    const cards =
      data &&
      typeof data === "object" &&
      Array.isArray((data as { cards?: unknown }).cards)
        ? (data as { cards: unknown[] }).cards
        : Array.isArray(data)
          ? data
          : [];
    return cards.filter(isCuratedPlaceSource).map((place) => ({
      placeId: place.placeId,
      placeIdStatus: place.placeIdStatus,
      landmarkKey: place.landmarkKey,
      name: language === "vi" ? place.nameVi : place.nameEn,
      description:
        language === "vi" ? place.descriptionVi : place.descriptionEn,
      address: place.address,
      priceRange: place.priceRange,
      dietary: place.dietary,
      googleMapsUri: place.googleMapsUri,
      sourceIds: place.sourceIds,
    }));
  }

  public approvedFacts(language: Language): string[] {
    return Object.values(this.locations(language)).flatMap((location) => [
      `${location.name}: ${location.shortDescription}`,
      `Fact: ${location.funFact}`,
      `Visit tip: ${location.visitTip}`,
    ]);
  }

  private load<T>(fileName: string): T | undefined {
    if (this.cache.has(fileName)) {
      return this.cache.get(fileName) as T | undefined;
    }

    const content = readJson<T>(path.join(this.contentDir, fileName));
    this.cache.set(fileName, content);
    return content;
  }
}

function isCuratedPlaceSource(value: unknown): value is CuratedPlaceSource {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CuratedPlaceSource>;
  return (
    (typeof item.placeId === "string" || item.placeId === null) &&
    (item.placeIdStatus === "verified" ||
      item.placeIdStatus === "unverified") &&
    typeof item.landmarkKey === "string" &&
    typeof item.nameVi === "string" &&
    typeof item.nameEn === "string" &&
    typeof item.descriptionVi === "string" &&
    typeof item.descriptionEn === "string" &&
    typeof item.address === "string" &&
    typeof item.priceRange === "string" &&
    (item.dietary === "any" || item.dietary === "vegetarian") &&
    typeof item.googleMapsUri === "string" &&
    Array.isArray(item.sourceIds)
  );
}
