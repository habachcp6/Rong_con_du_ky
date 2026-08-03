import type { PlaceCard } from "../../shared/types.js";
import type { RecommendationRequest } from "../../shared/schemas.js";
import type { ContentRepository, CuratedPlace } from "./content.js";

export type CuratedRecommendationResult = {
  source: "curated";
  places: PlaceCard[];
  notice: string | null;
};

const priceCeiling = (range: string): number | undefined => {
  const values = range
    .match(/[\d.]+/g)
    ?.map((value) => Number.parseInt(value.replaceAll(".", ""), 10))
    .filter(Number.isFinite);
  if (values?.length) return Math.max(...values);

  // These are ordering bands for authored Starter cards, not live price data.
  const bands: Record<string, number> = {
    budget: 100_000,
    moderate: 250_000,
    premium: 500_000,
  };
  return bands[range.toLowerCase()];
};

const toPlaceCard = (place: CuratedPlace): PlaceCard => ({
  placeId: place.placeId,
  placeIdStatus: place.placeIdStatus,
  landmarkKey: place.landmarkKey,
  name: place.name,
  description: place.description,
  address: place.address,
  priceRange: place.priceRange,
  dietary: place.dietary,
  googleMapsUri: place.googleMapsUri,
  sourceIds: place.sourceIds,
});

/**
 * Starter-tier recommendations are a deterministic filter over authored cards.
 * No Places ratings, reviews, opening hours, or photos are invented or cached.
 */
export function findCuratedRecommendations(
  repository: ContentRepository,
  request: RecommendationRequest,
): CuratedRecommendationResult {
  const all = repository.curatedPlaces(request.language);
  const landmarkMatches = request.landmarkKey
    ? all.filter((place) => place.landmarkKey === request.landmarkKey)
    : all;
  const dietaryMatches =
    request.dietary === "vegetarian"
      ? landmarkMatches.filter((place) => place.dietary === "vegetarian")
      : landmarkMatches;
  const budget = request.budgetVnd;
  const budgetMatches = budget
    ? dietaryMatches.filter((place) => {
        const ceiling = priceCeiling(place.priceRange);
        return ceiling === undefined || ceiling <= budget;
      })
    : dietaryMatches;
  const selected = (
    budgetMatches.length
      ? budgetMatches
      : dietaryMatches.length
        ? dietaryMatches
        : landmarkMatches
  ).slice(0, 5);

  const noExactMatch =
    selected.length > 0 &&
    budgetMatches.length === 0 &&
    Boolean(request.budgetVnd);
  const notice =
    selected.length === 0
      ? request.language === "vi"
        ? "Chưa có thẻ địa điểm phù hợp trong nội dung đã biên tập. Hãy thử lại với bộ lọc khác."
        : "There is no matching authored place card yet. Try another filter."
      : noExactMatch
        ? request.language === "vi"
          ? "Đây là các lựa chọn gần nhất trong nội dung đã biên tập; hãy kiểm tra giá hiện tại trên Google Maps."
          : "These are the closest authored options; check current prices on Google Maps."
        : null;

  return { source: "curated", places: selected.map(toPlaceCard), notice };
}
