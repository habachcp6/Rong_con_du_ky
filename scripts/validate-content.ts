import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  LANDMARK_GAME_DEFINITIONS,
  getLandmarkGameDefinitionByLocationKey,
  validateLandmarkGameDefinitions,
} from "../src/shared/landmark-game-definitions.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Location content is keyed by the canonical game registry, not a second
 * handwritten campaign list. */
export const EXPECTED_LOCATION_KEYS = LANDMARK_GAME_DEFINITIONS.map(
  (definition) => definition.locationKey,
);

export const EXPECTED_DIALOGUE_KEYS = [
  "dragon_bridge_npc",
  "my_khe_npc",
  "marble_npc",
  "son_tra_npc",
  "han_river_bridge_guide",
  "linh_ung_guide",
  "cham_museum_guide",
  "non_nuoc_guide",
  "han_market_guide",
  "ba_na_guide",
] as const;

const LOCATION_FIELDS = [
  "key",
  "name",
  "shortDescription",
  "funFact",
  "visitTip",
  "authoredImage",
  "assetId",
  "imageAttributionId",
  "sourceIds",
] as const;

const DIALOGUE_FIELDS = [
  "greeting",
  "questPrompt",
  "successMessage",
  "failureMessage",
  "sourceIds",
] as const;
const CURATED_PLACE_FIELDS = [
  "id",
  "placeId",
  "placeIdStatus",
  "landmarkKey",
  "nameVi",
  "nameEn",
  "descriptionVi",
  "descriptionEn",
  "address",
  "priceRange",
  "dietary",
  "googleMapsUri",
  "sourceIds",
] as const;
const RESTRICTED_PLACE_FIELDS = new Set([
  "rating",
  "userRatingCount",
  "reviews",
  "openingHours",
  "openNow",
  "photos",
  "photoUrl",
]);

export type ValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type ValidationResult = {
  ok: boolean;
  issues: ValidationIssue[];
  summary: string[];
};

export type SourceRecord = {
  id: string;
  metadata: Record<string, string>;
};

export type SourceRegistryResult = {
  sources: Map<string, SourceRecord>;
  issues: ValidationIssue[];
};

export type ContentValidationInput = {
  locationsVi: unknown;
  locationsEn: unknown;
  dialogueVi: unknown;
  dialogueEn: unknown;
  curatedPlaces: unknown;
  sourcesMarkdown: string;
  assetManifest: unknown;
  publicDir?: string;
};

type AssetReference = {
  id: string;
  path: string;
  attributionId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addIssue(
  issues: ValidationIssue[],
  code: string,
  issuePath: string,
  message: string,
) {
  issues.push({ code, path: issuePath, message });
}

function keysMatch(actual: string[], expected: readonly string[]) {
  return (
    JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort())
  );
}

function validateExactFields(
  value: Record<string, unknown>,
  expected: readonly string[],
  issuePath: string,
  issues: ValidationIssue[],
) {
  const actual = Object.keys(value);
  if (!keysMatch(actual, expected)) {
    addIssue(
      issues,
      "FIELD_SHAPE_MISMATCH",
      issuePath,
      `Expected fields [${expected.join(", ")}], received [${actual.sort().join(", ")}].`,
    );
  }
}

function expectNonEmptyString(
  value: unknown,
  issuePath: string,
  issues: ValidationIssue[],
  minimumLength = 1,
): value is string {
  if (typeof value !== "string" || value.trim().length < minimumLength) {
    addIssue(
      issues,
      "REQUIRED_TEXT_MISSING",
      issuePath,
      `Expected a non-empty string of at least ${minimumLength} characters.`,
    );
    return false;
  }
  return true;
}

function readSourceIds(
  value: unknown,
  issuePath: string,
  issues: ValidationIssue[],
) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((id) => typeof id !== "string" || !/^[a-z][a-z0-9_]+$/.test(id))
  ) {
    addIssue(
      issues,
      "SOURCE_IDS_INVALID",
      issuePath,
      "Expected at least one lowercase source ID.",
    );
    return [] as string[];
  }
  return value as string[];
}

function sentenceCount(text: string) {
  return text.split(/[.!?]+/u).filter((sentence) => sentence.trim().length > 0)
    .length;
}

function wordCount(text: string) {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

function validateTextLength(
  value: unknown,
  issuePath: string,
  issues: ValidationIssue[],
  minimumLength: number,
  maximumLength = 700,
) {
  if (!expectNonEmptyString(value, issuePath, issues, minimumLength)) {
    return;
  }
  if (value.length > maximumLength) {
    addIssue(
      issues,
      "TEXT_TOO_LONG",
      issuePath,
      `Text must be at most ${maximumLength} characters.`,
    );
  }
}

function validateSourceMetadata(
  id: string,
  record: SourceRecord,
  issues: ValidationIssue[],
) {
  const metadata = record.metadata;
  const kind = metadata.kind;
  const commonFields = ["kind", "title", "url", "accessed", "license / use"];
  const requiredFields =
    kind === "asset-attribution"
      ? [...commonFields, "author", "asset paths"]
      : [...commonFields, "publisher", "supports"];

  for (const field of requiredFields) {
    if (!metadata[field]) {
      addIssue(
        issues,
        "SOURCE_METADATA_MISSING",
        `sources.${id}.${field}`,
        `Source '${id}' is missing '${field}'.`,
      );
    }
  }

  if (metadata.url && !/^(https:\/\/|local:\/\/)/u.test(metadata.url)) {
    addIssue(
      issues,
      "SOURCE_URL_INVALID",
      `sources.${id}.url`,
      "Source URLs must use https:// or local://.",
    );
  }
  if (metadata.accessed && !/^\d{4}-\d{2}-\d{2}$/u.test(metadata.accessed)) {
    addIssue(
      issues,
      "SOURCE_DATE_INVALID",
      `sources.${id}.accessed`,
      "Accessed date must use YYYY-MM-DD.",
    );
  }
}

export function parseSourceRegistry(markdown: string): SourceRegistryResult {
  const sources = new Map<string, SourceRecord>();
  const issues: ValidationIssue[] = [];
  const headings = [...markdown.matchAll(/^## `([a-z][a-z0-9_]*)`\s*$/gmu)];

  if (headings.length === 0) {
    addIssue(
      issues,
      "SOURCE_REGISTRY_EMPTY",
      "sources",
      "No source records were found.",
    );
    return { sources, issues };
  }

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const id = heading[1];
    const start = (heading.index ?? 0) + heading[0].length;
    const end =
      index + 1 < headings.length
        ? (headings[index + 1].index ?? markdown.length)
        : markdown.length;
    const block = markdown.slice(start, end);

    if (sources.has(id)) {
      addIssue(
        issues,
        "SOURCE_ID_DUPLICATE",
        `sources.${id}`,
        `Source ID '${id}' is declared more than once.`,
      );
      continue;
    }

    const metadata: Record<string, string> = {};
    for (const fieldMatch of block.matchAll(
      /^\s*-\s+\*\*([^*]+):\*\*\s*(.+?)\s*$/gmu,
    )) {
      metadata[fieldMatch[1].trim().toLowerCase()] = fieldMatch[2].trim();
    }
    const record = { id, metadata };
    sources.set(id, record);
    validateSourceMetadata(id, record, issues);
  }

  return { sources, issues };
}

function validateReferencedSources(
  sourceIds: string[],
  allowedKinds: readonly string[],
  registry: Map<string, SourceRecord>,
  issuePath: string,
  issues: ValidationIssue[],
) {
  for (const sourceId of sourceIds) {
    const source = registry.get(sourceId);
    if (!source) {
      addIssue(
        issues,
        "SOURCE_NOT_FOUND",
        issuePath,
        `Source ID '${sourceId}' is not declared in content/sources.md.`,
      );
      continue;
    }
    if (!allowedKinds.includes(source.metadata.kind)) {
      addIssue(
        issues,
        "SOURCE_KIND_INVALID",
        issuePath,
        `Source ID '${sourceId}' has kind '${source.metadata.kind}', expected one of [${allowedKinds.join(", ")}].`,
      );
    }
  }
}

function createAssetIndex(manifest: unknown, issues: ValidationIssue[]) {
  const assets = new Map<string, AssetReference>();
  if (!isRecord(manifest) || !Array.isArray(manifest.assets)) {
    addIssue(
      issues,
      "ASSET_MANIFEST_INVALID",
      "assets.manifest",
      "Asset manifest must contain an assets array.",
    );
    return assets;
  }

  for (const [index, candidate] of manifest.assets.entries()) {
    if (!isRecord(candidate)) {
      addIssue(
        issues,
        "ASSET_MANIFEST_INVALID",
        `assets.manifest.assets[${index}]`,
        "Asset entry must be an object.",
      );
      continue;
    }
    const id = candidate.id;
    const assetPath = candidate.path;
    const attributionId = candidate.attributionId;
    if (
      typeof id !== "string" ||
      typeof assetPath !== "string" ||
      typeof attributionId !== "string"
    ) {
      addIssue(
        issues,
        "ASSET_MANIFEST_INVALID",
        `assets.manifest.assets[${index}]`,
        "Asset entry requires string id, path, and attributionId fields.",
      );
      continue;
    }
    if (assets.has(id)) {
      addIssue(
        issues,
        "ASSET_ID_DUPLICATE",
        `assets.manifest.assets[${index}].id`,
        `Asset ID '${id}' is duplicated.`,
      );
      continue;
    }
    assets.set(id, { id, path: assetPath, attributionId });
  }
  return assets;
}

function validateLandmarkGameDefinitionContract(issues: ValidationIssue[]) {
  const result = validateLandmarkGameDefinitions();
  for (const error of result.errors) {
    addIssue(
      issues,
      "LANDMARK_GAME_DEFINITION_INVALID",
      "landmark-game-definitions",
      error,
    );
  }
}

function validateLocation(
  key: string,
  locationVi: unknown,
  locationEn: unknown,
  registry: Map<string, SourceRecord>,
  assets: Map<string, AssetReference>,
  publicDir: string | undefined,
  issues: ValidationIssue[],
) {
  const viPath = `locations.vi.${key}`;
  const enPath = `locations.en.${key}`;
  if (!isRecord(locationVi) || !isRecord(locationEn)) {
    addIssue(
      issues,
      "LOCATION_INVALID",
      key,
      "Both Vietnamese and English locations must be objects.",
    );
    return;
  }

  const definition = getLandmarkGameDefinitionByLocationKey(key);
  if (!definition) {
    addIssue(
      issues,
      "LOCATION_GAME_DEFINITION_MISSING",
      key,
      `Location '${key}' has no canonical landmark game definition.`,
    );
  } else {
    for (const [language, location, basePath] of [
      ["vi", locationVi, viPath],
      ["en", locationEn, enPath],
    ] as const) {
      if (location.assetId !== definition.postcardAssetId) {
        addIssue(
          issues,
          "LOCATION_POSTCARD_BINDING_MISMATCH",
          `${basePath}.assetId`,
          `${language} location '${key}' must use postcard asset '${definition.postcardAssetId}'.`,
        );
      }
    }
  }

  validateExactFields(locationVi, LOCATION_FIELDS, viPath, issues);
  validateExactFields(locationEn, LOCATION_FIELDS, enPath, issues);
  if (!keysMatch(Object.keys(locationVi), Object.keys(locationEn))) {
    addIssue(
      issues,
      "LANGUAGE_FIELD_PARITY_MISMATCH",
      key,
      "Vietnamese and English location fields differ.",
    );
  }

  for (const [language, location, basePath] of [
    ["vi", locationVi, viPath],
    ["en", locationEn, enPath],
  ] as const) {
    if (location.key !== key) {
      addIssue(
        issues,
        "LOCATION_KEY_INVALID",
        `${basePath}.key`,
        `Expected key '${key}' for ${language}.`,
      );
    }
    validateTextLength(location.name, `${basePath}.name`, issues, 2, 120);
    validateTextLength(
      location.shortDescription,
      `${basePath}.shortDescription`,
      issues,
      80,
      700,
    );
    if (
      typeof location.shortDescription === "string" &&
      (wordCount(location.shortDescription) < 50 ||
        wordCount(location.shortDescription) > 80)
    ) {
      addIssue(
        issues,
        "LOCATION_DESCRIPTION_WORD_COUNT_INVALID",
        `${basePath}.shortDescription`,
        "shortDescription must contain 50–80 words.",
      );
    }
    validateTextLength(
      location.funFact,
      `${basePath}.funFact`,
      issues,
      20,
      300,
    );
    validateTextLength(
      location.visitTip,
      `${basePath}.visitTip`,
      issues,
      20,
      350,
    );
    expectNonEmptyString(
      location.authoredImage,
      `${basePath}.authoredImage`,
      issues,
      1,
    );
    expectNonEmptyString(location.assetId, `${basePath}.assetId`, issues, 1);
    expectNonEmptyString(
      location.imageAttributionId,
      `${basePath}.imageAttributionId`,
      issues,
      1,
    );
  }

  const viSourceIds = readSourceIds(
    locationVi.sourceIds,
    `${viPath}.sourceIds`,
    issues,
  );
  const enSourceIds = readSourceIds(
    locationEn.sourceIds,
    `${enPath}.sourceIds`,
    issues,
  );
  if (JSON.stringify(viSourceIds) !== JSON.stringify(enSourceIds)) {
    addIssue(
      issues,
      "LANGUAGE_SOURCE_PARITY_MISMATCH",
      key,
      "Vietnamese and English locations must reference the same source IDs in the same order.",
    );
  }
  validateReferencedSources(
    viSourceIds,
    ["tourism-fact"],
    registry,
    `${viPath}.sourceIds`,
    issues,
  );

  if (
    locationVi.assetId !== locationEn.assetId ||
    locationVi.authoredImage !== locationEn.authoredImage
  ) {
    addIssue(
      issues,
      "LANGUAGE_ASSET_PARITY_MISMATCH",
      key,
      "Vietnamese and English locations must reference the same asset.",
    );
  }
  if (locationVi.imageAttributionId !== locationEn.imageAttributionId) {
    addIssue(
      issues,
      "LANGUAGE_IMAGE_ATTRIBUTION_PARITY_MISMATCH",
      key,
      "Vietnamese and English locations must reference the same image attribution.",
    );
  }

  const assetId =
    typeof locationVi.assetId === "string" ? locationVi.assetId : "";
  const asset = assets.get(assetId);
  if (!asset) {
    addIssue(
      issues,
      "LOCATION_ASSET_NOT_FOUND",
      `${viPath}.assetId`,
      `Asset '${assetId}' is not declared in the asset manifest.`,
    );
    return;
  }
  if (locationVi.authoredImage !== asset.path) {
    addIssue(
      issues,
      "LOCATION_ASSET_PATH_MISMATCH",
      `${viPath}.authoredImage`,
      "authoredImage must match the declared manifest asset path.",
    );
  }
  if (locationVi.imageAttributionId !== asset.attributionId) {
    addIssue(
      issues,
      "LOCATION_ASSET_ATTRIBUTION_MISMATCH",
      `${viPath}.imageAttributionId`,
      "imageAttributionId must match the manifest asset attribution ID.",
    );
  }
  validateReferencedSources(
    [asset.attributionId],
    ["asset-attribution"],
    registry,
    `${viPath}.imageAttributionId`,
    issues,
  );

  if (publicDir && typeof locationVi.authoredImage === "string") {
    const assetFile = path.resolve(publicDir, `.${locationVi.authoredImage}`);
    if (
      !assetFile.startsWith(`${path.resolve(publicDir)}${path.sep}`) ||
      !fs.existsSync(assetFile)
    ) {
      addIssue(
        issues,
        "LOCATION_ASSET_FILE_MISSING",
        `${viPath}.authoredImage`,
        `Asset file '${locationVi.authoredImage}' does not exist in public/.`,
      );
    }
  }
}

function validateDialogue(
  key: string,
  dialogueVi: unknown,
  dialogueEn: unknown,
  registry: Map<string, SourceRecord>,
  issues: ValidationIssue[],
) {
  const viPath = `dialogue.vi.${key}`;
  const enPath = `dialogue.en.${key}`;
  if (!isRecord(dialogueVi) || !isRecord(dialogueEn)) {
    addIssue(
      issues,
      "DIALOGUE_INVALID",
      key,
      "Both Vietnamese and English dialogue nodes must be objects.",
    );
    return;
  }
  validateExactFields(dialogueVi, DIALOGUE_FIELDS, viPath, issues);
  validateExactFields(dialogueEn, DIALOGUE_FIELDS, enPath, issues);
  if (!keysMatch(Object.keys(dialogueVi), Object.keys(dialogueEn))) {
    addIssue(
      issues,
      "LANGUAGE_FIELD_PARITY_MISMATCH",
      key,
      "Vietnamese and English dialogue fields differ.",
    );
  }

  for (const [language, node, basePath] of [
    ["vi", dialogueVi, viPath],
    ["en", dialogueEn, enPath],
  ] as const) {
    for (const field of [
      "greeting",
      "questPrompt",
      "successMessage",
      "failureMessage",
    ] as const) {
      validateTextLength(node[field], `${basePath}.${field}`, issues, 8, 400);
      if (typeof node[field] === "string" && sentenceCount(node[field]) > 4) {
        addIssue(
          issues,
          "DIALOGUE_SENTENCE_LIMIT",
          `${basePath}.${field}`,
          `${language} dialogue must contain at most four sentences.`,
        );
      }
    }
  }

  const viSourceIds = readSourceIds(
    dialogueVi.sourceIds,
    `${viPath}.sourceIds`,
    issues,
  );
  const enSourceIds = readSourceIds(
    dialogueEn.sourceIds,
    `${enPath}.sourceIds`,
    issues,
  );
  if (JSON.stringify(viSourceIds) !== JSON.stringify(enSourceIds)) {
    addIssue(
      issues,
      "LANGUAGE_SOURCE_PARITY_MISMATCH",
      key,
      "Vietnamese and English dialogue must reference the same source IDs in the same order.",
    );
  }
  validateReferencedSources(
    viSourceIds,
    ["tourism-fact"],
    registry,
    `${viPath}.sourceIds`,
    issues,
  );
}

function findRestrictedFields(
  value: unknown,
  issuePath: string,
  issues: ValidationIssue[],
) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      findRestrictedFields(entry, `${issuePath}[${index}]`, issues),
    );
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  for (const [key, nestedValue] of Object.entries(value)) {
    if (RESTRICTED_PLACE_FIELDS.has(key)) {
      addIssue(
        issues,
        "RESTRICTED_PLACE_DATA",
        `${issuePath}.${key}`,
        `Starter content must not persist '${key}'.`,
      );
    }
    findRestrictedFields(nestedValue, `${issuePath}.${key}`, issues);
  }
}

function isValidGoogleMapsUri(value: string) {
  try {
    const url = new URL(value);
    const googleHost =
      url.hostname === "maps.app.goo.gl" || url.hostname.endsWith("google.com");
    return (
      url.protocol === "https:" &&
      googleHost &&
      (url.pathname.includes("/maps/") || url.hostname === "maps.app.goo.gl")
    );
  } catch {
    return false;
  }
}

function validateCuratedPlaces(
  curatedPlaces: unknown,
  locationKeys: readonly string[],
  registry: Map<string, SourceRecord>,
  issues: ValidationIssue[],
) {
  if (
    !isRecord(curatedPlaces) ||
    curatedPlaces.version !== 1 ||
    !Array.isArray(curatedPlaces.cards)
  ) {
    addIssue(
      issues,
      "CURATED_PLACES_INVALID",
      "curated-places",
      "Expected version 1 and a cards array.",
    );
    return;
  }
  if (curatedPlaces.cards.length < 12) {
    addIssue(
      issues,
      "CURATED_PLACES_INCOMPLETE",
      "curated-places.cards",
      "Provide at least 12 Starter food cards covering all MVP landmarks.",
    );
  }

  const ids = new Set<string>();
  const representedLandmarks = new Set<string>();
  for (const [index, card] of curatedPlaces.cards.entries()) {
    const cardPath = `curated-places.cards[${index}]`;
    findRestrictedFields(card, cardPath, issues);
    if (!isRecord(card)) {
      addIssue(
        issues,
        "CURATED_PLACE_INVALID",
        cardPath,
        "Card must be an object.",
      );
      continue;
    }
    validateExactFields(card, CURATED_PLACE_FIELDS, cardPath, issues);
    if (
      !expectNonEmptyString(card.id, `${cardPath}.id`, issues, 3) ||
      !/^[a-z][a-z0-9_]+$/u.test(card.id)
    ) {
      addIssue(
        issues,
        "CURATED_PLACE_ID_INVALID",
        `${cardPath}.id`,
        "Card ID must use lowercase snake_case.",
      );
    } else if (ids.has(card.id)) {
      addIssue(
        issues,
        "CURATED_PLACE_ID_DUPLICATE",
        `${cardPath}.id`,
        `Card ID '${card.id}' is duplicated.`,
      );
    } else {
      ids.add(card.id);
    }

    if (
      card.placeIdStatus !== "verified" &&
      card.placeIdStatus !== "unverified"
    ) {
      addIssue(
        issues,
        "PLACE_ID_STATUS_INVALID",
        `${cardPath}.placeIdStatus`,
        "placeIdStatus must be verified or unverified.",
      );
    }
    if (
      card.placeIdStatus === "verified" &&
      (typeof card.placeId !== "string" ||
        !/^ChIJ[A-Za-z0-9_-]{8,}$/u.test(card.placeId))
    ) {
      addIssue(
        issues,
        "PLACE_ID_INVALID",
        `${cardPath}.placeId`,
        "A verified placeId must look like a Google Place ID.",
      );
    }
    if (card.placeIdStatus === "unverified" && card.placeId !== null) {
      addIssue(
        issues,
        "PLACE_ID_UNVERIFIED_NOT_NULL",
        `${cardPath}.placeId`,
        "Unverified Starter cards must keep placeId null; do not fabricate IDs.",
      );
    }

    if (
      !expectNonEmptyString(
        card.landmarkKey,
        `${cardPath}.landmarkKey`,
        issues,
        1,
      ) ||
      !locationKeys.includes(card.landmarkKey)
    ) {
      addIssue(
        issues,
        "CURATED_PLACE_LANDMARK_INVALID",
        `${cardPath}.landmarkKey`,
        "landmarkKey must reference a canonical location.",
      );
    } else {
      representedLandmarks.add(card.landmarkKey);
    }
    for (const textField of [
      "nameVi",
      "nameEn",
      "descriptionVi",
      "descriptionEn",
      "address",
    ] as const) {
      validateTextLength(
        card[textField],
        `${cardPath}.${textField}`,
        issues,
        textField.startsWith("description") ? 35 : 3,
        500,
      );
    }
    if (
      card.priceRange !== "budget" &&
      card.priceRange !== "moderate" &&
      card.priceRange !== "premium"
    ) {
      addIssue(
        issues,
        "CURATED_PRICE_RANGE_INVALID",
        `${cardPath}.priceRange`,
        "priceRange must be budget, moderate, or premium editorial grouping.",
      );
    }
    if (card.dietary !== "any" && card.dietary !== "vegetarian") {
      addIssue(
        issues,
        "CURATED_DIETARY_INVALID",
        `${cardPath}.dietary`,
        "dietary must be any or vegetarian.",
      );
    }
    if (
      !expectNonEmptyString(
        card.googleMapsUri,
        `${cardPath}.googleMapsUri`,
        issues,
        1,
      ) ||
      !isValidGoogleMapsUri(card.googleMapsUri)
    ) {
      addIssue(
        issues,
        "GOOGLE_MAPS_URI_INVALID",
        `${cardPath}.googleMapsUri`,
        "Starter card must link to an https Google Maps URI.",
      );
    }

    const sourceIds = readSourceIds(
      card.sourceIds,
      `${cardPath}.sourceIds`,
      issues,
    );
    validateReferencedSources(
      sourceIds,
      ["curated-place", "curation-policy"],
      registry,
      `${cardPath}.sourceIds`,
      issues,
    );
    const sourceKinds = new Set(
      sourceIds.map((sourceId) => registry.get(sourceId)?.metadata.kind),
    );
    if (
      !sourceKinds.has("curated-place") ||
      !sourceKinds.has("curation-policy")
    ) {
      addIssue(
        issues,
        "CURATED_PLACE_PROVENANCE_INCOMPLETE",
        `${cardPath}.sourceIds`,
        "Every Starter card needs one venue source and the Starter curation-policy source.",
      );
    }
  }

  for (const landmarkKey of locationKeys) {
    if (!representedLandmarks.has(landmarkKey)) {
      addIssue(
        issues,
        "CURATED_PLACE_LANDMARK_MISSING",
        "curated-places.cards",
        `No Starter card is associated with '${landmarkKey}'.`,
      );
    }
  }
}

export function validateContentData(
  input: ContentValidationInput,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  validateLandmarkGameDefinitionContract(issues);
  const sourceRegistry = parseSourceRegistry(input.sourcesMarkdown);
  issues.push(...sourceRegistry.issues);
  const assets = createAssetIndex(input.assetManifest, issues);

  if (!isRecord(input.locationsVi) || !isRecord(input.locationsEn)) {
    addIssue(
      issues,
      "LOCATION_FILE_INVALID",
      "locations",
      "Location files must contain objects.",
    );
  } else {
    const viKeys = Object.keys(input.locationsVi);
    const enKeys = Object.keys(input.locationsEn);
    if (!keysMatch(viKeys, EXPECTED_LOCATION_KEYS)) {
      addIssue(
        issues,
        "LOCATION_KEYS_INVALID",
        "locations.vi",
        `Expected exactly [${EXPECTED_LOCATION_KEYS.join(", ")}].`,
      );
    }
    if (!keysMatch(enKeys, EXPECTED_LOCATION_KEYS)) {
      addIssue(
        issues,
        "LOCATION_KEYS_INVALID",
        "locations.en",
        `Expected exactly [${EXPECTED_LOCATION_KEYS.join(", ")}].`,
      );
    }
    if (!keysMatch(viKeys, enKeys)) {
      addIssue(
        issues,
        "LANGUAGE_KEY_PARITY_MISMATCH",
        "locations",
        "Vietnamese and English locations must have the same keys.",
      );
    }
    for (const key of EXPECTED_LOCATION_KEYS) {
      validateLocation(
        key,
        input.locationsVi[key],
        input.locationsEn[key],
        sourceRegistry.sources,
        assets,
        input.publicDir,
        issues,
      );
    }
  }

  if (!isRecord(input.dialogueVi) || !isRecord(input.dialogueEn)) {
    addIssue(
      issues,
      "DIALOGUE_FILE_INVALID",
      "dialogue",
      "Dialogue files must contain objects.",
    );
  } else {
    const viKeys = Object.keys(input.dialogueVi);
    const enKeys = Object.keys(input.dialogueEn);
    if (!keysMatch(viKeys, EXPECTED_DIALOGUE_KEYS)) {
      addIssue(
        issues,
        "DIALOGUE_KEYS_INVALID",
        "dialogue.vi",
        `Expected exactly [${EXPECTED_DIALOGUE_KEYS.join(", ")}].`,
      );
    }
    if (!keysMatch(enKeys, EXPECTED_DIALOGUE_KEYS)) {
      addIssue(
        issues,
        "DIALOGUE_KEYS_INVALID",
        "dialogue.en",
        `Expected exactly [${EXPECTED_DIALOGUE_KEYS.join(", ")}].`,
      );
    }
    if (!keysMatch(viKeys, enKeys)) {
      addIssue(
        issues,
        "LANGUAGE_KEY_PARITY_MISMATCH",
        "dialogue",
        "Vietnamese and English dialogue must have the same keys.",
      );
    }
    for (const key of EXPECTED_DIALOGUE_KEYS) {
      validateDialogue(
        key,
        input.dialogueVi[key],
        input.dialogueEn[key],
        sourceRegistry.sources,
        issues,
      );
    }
  }

  validateCuratedPlaces(
    input.curatedPlaces,
    EXPECTED_LOCATION_KEYS,
    sourceRegistry.sources,
    issues,
  );

  return {
    ok: issues.length === 0,
    issues,
    summary: [
      `locations=${EXPECTED_LOCATION_KEYS.length}`,
      `dialogueNodes=${EXPECTED_DIALOGUE_KEYS.length}`,
      `sources=${sourceRegistry.sources.size}`,
    ],
  };
}

function readJsonFile(filePath: string, issues: ValidationIssue[]): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown JSON read error.";
    addIssue(issues, "JSON_READ_FAILED", filePath, message);
    return undefined;
  }
}

export function validateContentFiles(
  projectRoot = path.resolve(__dirname, ".."),
): ValidationResult {
  const bootstrapIssues: ValidationIssue[] = [];
  const contentDir = path.join(projectRoot, "content");
  const locationsVi = readJsonFile(
    path.join(contentDir, "locations.vi.json"),
    bootstrapIssues,
  );
  const locationsEn = readJsonFile(
    path.join(contentDir, "locations.en.json"),
    bootstrapIssues,
  );
  const dialogueVi = readJsonFile(
    path.join(contentDir, "dialogue.vi.json"),
    bootstrapIssues,
  );
  const dialogueEn = readJsonFile(
    path.join(contentDir, "dialogue.en.json"),
    bootstrapIssues,
  );
  const curatedPlaces = readJsonFile(
    path.join(contentDir, "curated-places.json"),
    bootstrapIssues,
  );
  const assetManifest = readJsonFile(
    path.join(projectRoot, "public", "assets", "manifest.json"),
    bootstrapIssues,
  );
  let sourcesMarkdown = "";
  try {
    sourcesMarkdown = fs.readFileSync(
      path.join(contentDir, "sources.md"),
      "utf8",
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown sources read error.";
    addIssue(
      bootstrapIssues,
      "SOURCES_READ_FAILED",
      path.join(contentDir, "sources.md"),
      message,
    );
  }

  const result = validateContentData({
    locationsVi,
    locationsEn,
    dialogueVi,
    dialogueEn,
    curatedPlaces,
    sourcesMarkdown,
    assetManifest,
    publicDir: path.join(projectRoot, "public"),
  });
  result.issues.unshift(...bootstrapIssues);
  result.ok = result.issues.length === 0;
  return result;
}

function isCliInvocation() {
  return (
    Boolean(process.argv[1]) && path.resolve(process.argv[1]) === __filename
  );
}

if (isCliInvocation()) {
  const result = validateContentFiles();
  if (result.ok) {
    console.log(`✅ Content validation passed (${result.summary.join(", ")}).`);
  } else {
    console.error(
      `❌ Content validation failed with ${result.issues.length} issue(s):`,
    );
    for (const issue of result.issues) {
      console.error(`- [${issue.code}] ${issue.path}: ${issue.message}`);
    }
    process.exitCode = 1;
  }
}
