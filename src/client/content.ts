import dialogueEn from "../../content/dialogue.en.json";
import dialogueVi from "../../content/dialogue.vi.json";
import curatedPlaces from "../../content/curated-places.json";
import locationsEn from "../../content/locations.en.json";
import locationsVi from "../../content/locations.vi.json";
import type { Language, PlaceCard } from "../shared/types.js";

export type ClientLocationContent = {
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

export type ClientDialogueNode = {
  greeting: string;
  questPrompt: string;
  successMessage: string;
  failureMessage: string;
  sourceIds: string[];
};

const locationsByLanguage: Record<
  Language,
  Record<string, ClientLocationContent>
> = {
  vi: locationsVi,
  en: locationsEn,
};

const dialogueByLanguage: Record<
  Language,
  Record<string, ClientDialogueNode>
> = {
  vi: dialogueVi,
  en: dialogueEn,
};

export const getLocationContent = (
  language: Language,
  placeKey: string,
): ClientLocationContent | undefined => locationsByLanguage[language][placeKey];

export const getDialogueContent = (
  language: Language,
  npcId: string,
): ClientDialogueNode | undefined => dialogueByLanguage[language][npcId];

type CuratedPlaceSource = {
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

/** Reads the authored Starter cards directly from canonical JSON. It is also
 * the offline UI fallback when the Fastify service is unreachable. */
export const getCuratedPlaceCards = (language: Language): PlaceCard[] =>
  (curatedPlaces.cards as CuratedPlaceSource[]).map((place) => ({
    placeId: place.placeId,
    placeIdStatus: place.placeIdStatus,
    landmarkKey: place.landmarkKey,
    name: language === "vi" ? place.nameVi : place.nameEn,
    description: language === "vi" ? place.descriptionVi : place.descriptionEn,
    address: place.address,
    priceRange: place.priceRange,
    dietary: place.dietary,
    googleMapsUri: place.googleMapsUri,
    sourceIds: [...place.sourceIds],
  }));
