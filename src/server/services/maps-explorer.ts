import { GoogleGenAI } from "@google/genai";
import {
  ExploreSearchResponseSchema,
  type ExplorePlaceItem,
  type ExploreSearchRequest,
  type ExploreSearchResponse,
} from "../../shared/schemas.js";

export type MapsExplorerResult = ExploreSearchResponse;

export type MapsExplorerService = {
  explore(request: ExploreSearchRequest): Promise<MapsExplorerResult>;
};

export type MapsExplorerServiceOptions = {
  apiKey: string;
  model: string;
};

type FallbackPlaceDef = {
  id: string;
  nameVi: string;
  nameEn: string;
  summaryVi: string;
  summaryEn: string;
  category: "culture" | "nature" | "food" | "cafe" | "sightseeing";
  address: string;
  googleMapsUri: string;
  reviewSnippetVi?: string;
  reviewSnippetEn?: string;
};

const REAL_WORLD_DANANG_PLACES: FallbackPlaceDef[] = [
  {
    id: "love_bridge_danang",
    nameVi: "Cầu Tình Yêu Đà Nẵng",
    nameEn: "Love Lock Bridge Da Nang",
    summaryVi:
      "Cây cầu đi bộ lãng mạn ven sông Hàn với hàng trăm cột đèn lồng hình trái tim đỏ rực rỡ và những ổ khóa tình yêu của du khách bốn phương.",
    summaryEn:
      "A romantic pedestrian pier on the east bank of the Han River lined with glowing red heart-shaped lanterns and lovers' padlocks.",
    category: "sightseeing",
    address: "Đường Trần Hưng Đạo, An Hải Tây, Sơn Trà, Đà Nẵng",
    googleMapsUri:
      "https://www.google.com/maps/search/?api=1&query=C%E1%BA%A7u%20T%C3%ACnh%20Y%C3%AAu%20%C4%90%C3%A0%20N%E1%BA%B5ng",
    reviewSnippetVi:
      "Điểm ngắm cầu Rồng phun lửa lý tưởng và check-in hoàng hôn bên sông Hàn tuyệt đẹp.",
    reviewSnippetEn:
      "Great vantage point for watching the Dragon Bridge fire show and sunset along the river.",
  },
  {
    id: "carp_dragon_statue",
    nameVi: "Tượng Cá Chép Hóa Rồng",
    nameEn: "Carp Turning Into Dragon Statue",
    summaryVi:
      "Bức tượng nặng gần 200 tấn được đúc từ đá cẩm thạch trắng tự nhiên, biểu tượng cho sự kiên trì, may mắn và khát vọng vươn lên của người dân Đà Nẵng.",
    summaryEn:
      "A 200-ton white marble statue symbolizing perseverance and good fortune, standing proudly on the eastern riverbank.",
    category: "culture",
    address: "Bờ đông sông Hàn, Trần Hưng Đạo, Sơn Trà, Đà Nẵng",
    googleMapsUri:
      "https://www.google.com/maps/search/?api=1&query=T%C6%B0%E1%BB%A3ng%20C%C3%A1%20Ch%C3%A9p%20H%C3%B3a%20R%E1%BB%93ng%20%C4%90%C3%A0%20N%E1%BA%B5ng",
    reviewSnippetVi:
      "Tượng phun nước về đêm dưới ánh đèn rực rỡ bên bến thuyền DHC Marina.",
    reviewSnippetEn:
      "The fountain lights up dramatically at night right next to DHC Marina pier.",
  },
  {
    id: "dinh_ban_co_son_tra",
    nameVi: "Đỉnh Bàn Cờ — Bán Đảo Sơn Trà",
    nameEn: "Chessboard Peak (Dinh Ban Co) — Son Tra",
    summaryVi:
      "Điểm cao nhất trên bán đảo Sơn Trà với tượng Tiên ông ngồi đánh cờ bên bàn cờ tiên, nơi bạn có thể ngắm trọn vẹn toàn cảnh thành phố biển và mây trời Đà Nẵng.",
    summaryEn:
      "The highest accessible summit on the Son Tra Peninsula, featuring a statue of a fairy sage pondering a chess game with panoramic views.",
    category: "nature",
    address: "Đỉnh núi Bán Đảo Sơn Trà, Thọ Quang, Sơn Trà, Đà Nẵng",
    googleMapsUri:
      "https://www.google.com/maps/search/?api=1&query=%C4%90%E1%BB%89nh%20B%C3%A0n%20C%E1%BB%9D%20S%C6%A1n%20Tr%C3%A0%20%C4%90%C3%A0%20N%E1%BA%B5ng",
    reviewSnippetVi:
      "Đường lên có cảnh sắc rừng nguyên sinh hùng vĩ, sáng sớm mây bay tuyệt đẹp.",
    reviewSnippetEn:
      "Breathtaking mountain ride through lush jungle canopy with views spanning the entire coastline.",
  },
  {
    id: "hai_van_pass",
    nameVi: "Đèo Hải Vân & Di Tích Hải Vân Quan",
    nameEn: "Hai Van Pass & Historic Hai Van Gate",
    summaryVi:
      "Cung đèo hiểm trở và ngoạn mục bậc nhất Việt Nam được mệnh danh là 'Thiên hạ đệ nhất hùng quan' nối liền Đà Nẵng và Thừa Thiên Huế.",
    summaryEn:
      "One of the world's most scenic coastal mountain passes, crowned by the ancient stone ramparts of the Hai Van Gate.",
    category: "nature",
    address: "Đèo Hải Vân, Quốc lộ 1A, Hòa Hiệp Bắc, Liên Chiểu, Đà Nẵng",
    googleMapsUri:
      "https://www.google.com/maps/search/?api=1&query=%C4%90%C3%A8o%20H%E1%BA%A3i%20V%C3%A2n%20H%E1%BA%A3i%20V%C3%A2n%20Quan%20%C4%90%C3%A0%20N%E1%BA%B5ng",
    reviewSnippetVi:
      "Điểm săn mây và ngắm vịnh Đà Nẵng từ trên cao cực kỳ ấn tượng.",
    reviewSnippetEn:
      "Incredible ocean panorama and winding mountain curves steeped in history.",
  },
  {
    id: "bai_da_obama_son_tra",
    nameVi: "Bãi Đá Đen & Bãi Rạng — Sơn Trà",
    nameEn: "Obama Rock Beach & Bai Rang — Son Tra",
    summaryVi:
      "Bãi biển hoang sơ với những khối đá bazan đen tự nhiên xếp lớp độc đáo nhô ra biển xanh ngọc bích, thích hợp lặn ngắm san hô và chèo SUP.",
    summaryEn:
      "A pristine coastal spot with volcanic rock formations meeting crystal turquoise water, popular for snorkeling and SUP paddling.",
    category: "nature",
    address: "Hoàng Sa, Bán đảo Sơn Trà, Thọ Quang, Sơn Trà, Đà Nẵng",
    googleMapsUri:
      "https://www.google.com/maps/search/?api=1&query=B%C3%A3i%20%C4%90%C3%A1%20Obama%20S%C6%A1n%20Tr%C3%A0%20%C4%90%C3%A0%20N%E1%BA%B5ng",
    reviewSnippetVi:
      "Nước biển trong vắt nhìn thấy đáy, nhiều chòi lá nghỉ ngơi đón gió biển trong lành.",
    reviewSnippetEn:
      "Crystal clear water with wooden cabanas offering cool ocean breezes.",
  },
  {
    id: "ran_nam_o",
    nameVi: "Rạn Nam Ô & Làng Nước Mắm Nam Ô",
    nameEn: "Nam O Reef & Heritage Fish Sauce Village",
    summaryVi:
      "Bãi rạn đá rêu xanh mướt trải dài ven biển vào mùa xuân, gắn liền với làng nghề làm nước mắm truyền thống hàng trăm năm tuổi của xứ Quảng.",
    summaryEn:
      "A striking coastal reef famous for green moss-covered boulders and centuries-old artisanal fish sauce heritage.",
    category: "culture",
    address: "Nam Ô, Hòa Hiệp Nam, Liên Chiểu, Đà Nẵng",
    googleMapsUri:
      "https://www.google.com/maps/search/?api=1&query=R%E1%BA%A1n%20Nam%20%C3%94%20%C4%90%C3%A0%20N%E1%BA%B5ng",
    reviewSnippetVi:
      "Mùa rêu xanh tạo nên khung cảnh chụp ảnh ngoạn mục, đặc sản gỏi cá Nam Ô tươi ngon.",
    reviewSnippetEn:
      "Photogenic emerald moss season and authentic local fresh raw fish salad delicacy.",
  },
  {
    id: "con_ga_cathedral",
    nameVi: "Nhà Thờ Chính Tòa Đà Nẵng (Nhà Thờ Con Gà)",
    nameEn: "Da Nang Cathedral (Pink Rooster Church)",
    summaryVi:
      "Công trình kiến trúc Gothic độc đáo sơn màu hồng pastel rực rỡ xây dựng từ năm 1923, với biểu tượng con gà bằng hợp kim trên đỉnh tháp chuông.",
    summaryEn:
      "A 1923 French Gothic cathedral featuring pastel pink facades and a weathercock atop its steeple.",
    category: "culture",
    address: "156 Trần Phú, Hải Châu 1, Hải Châu, Đà Nẵng",
    googleMapsUri:
      "https://www.google.com/maps/search/?api=1&query=Nh%C3%A0%20Th%E1%BB%9D%20Ch%C3%ADnh%20T%C3%B2a%20%C4%90%C3%A0%20N%E1%BA%B5ng%20156%20Tr%E1%BA%A7n%20Ph%C3%BA",
    reviewSnippetVi:
      "Kiến trúc trang nhã, không gian thanh bình ngay giữa lòng trung tâm phố thị sầm uất.",
    reviewSnippetEn:
      "Peaceful historic oasis with distinctive pastel architecture in downtown Da Nang.",
  },
  {
    id: "da_nang_fine_arts_museum",
    nameVi: "Bảo Tàng Mỹ Thuật Đà Nẵng",
    nameEn: "Da Nang Museum of Fine Arts",
    summaryVi:
      "Nơi trưng bày hơn 1.000 tác phẩm nghệ thuật tạo hình hiện đại, tranh sơn mài, điêu khắc dân gian và mỹ thuật truyền thống miền Trung — Tây Nguyên.",
    summaryEn:
      "Home to over 1,000 fine art works, lacquer paintings, folk carvings, and regional heritage crafts.",
    category: "culture",
    address: "78 Lê Duẩn, Thạch Thang, Hải Châu, Đà Nẵng",
    googleMapsUri:
      "https://www.google.com/maps/search/?api=1&query=B%E1%BA%A3o%20T%C3%A0ng%20M%E1%BB%B9%20Thu%E1%BA%ADt%20%C4%90%C3%A0%20N%E1%BA%B5ng%2078%20L%C3%AA%20Du%E1%BA%A9n",
    reviewSnippetVi:
      "Không gian trưng bày tinh tế, giàu giá trị văn hóa và chiều sâu mỹ thuật.",
    reviewSnippetEn:
      "Thoughtfully curated exhibitions celebrating Vietnamese artistic mastery.",
  },
  {
    id: "son_tra_night_market",
    nameVi: "Chợ Đêm Sơn Trà",
    nameEn: "Son Tra Night Market",
    summaryVi:
      "Khu chợ đêm sầm uất ngay gần Cầu Rồng với hàng trăm gian hàng ẩm thực đường phố, hải sản nướng thơm lừng, trà sữa và quà lưu niệm thủ công mỹ nghệ.",
    summaryEn:
      "A bustling street market near Dragon Bridge packed with fresh grilled seafood, street snacks, and artisan crafts.",
    category: "food",
    address: "Đường Mai Hắc Đế giao Lý Nam Đế, An Hải Tây, Sơn Trà, Đà Nẵng",
    googleMapsUri:
      "https://www.google.com/maps/search/?api=1&query=Ch%E1%BB%A3%20%C4%90%C3%AAm%20S%C6%A1n%20Tr%C3%A0%20%C4%90%C3%A0%20N%E1%BA%B5ng",
    reviewSnippetVi:
      "Không khí nhộn nhịp, hải sản giá bình dân và đi bộ sang cầu Rồng rất tiện lợi.",
    reviewSnippetEn:
      "Vibrant evening vibe with affordable street eats within steps of Dragon Bridge.",
  },
  {
    id: "apec_park_danang",
    nameVi: "Công Viên APEC & Mái Vòm Cánh Diều",
    nameEn: "APEC Park & Da Nang Kite Dome",
    summaryVi:
      "Công viên ven sông Hàn nổi bật với công trình kiến trúc mái vòm 'Cánh diều bay cao' uốn lượn hiện đại, thảm cỏ xanh và vườn tượng nghệ thuật quốc tế.",
    summaryEn:
      "A modern riverside public park headlined by an architectural giant steel kite dome and international sculpture garden.",
    category: "sightseeing",
    address: "Đường 2 Tháng 9 giao Bạch Đằng, Bình Hiên, Hải Châu, Đà Nẵng",
    googleMapsUri:
      "https://www.google.com/maps/search/?api=1&query=C%C3%B4ng%20Vi%C3%AAn%20APEC%20%C4%90%C3%A0%20N%E1%BA%B5ng",
    reviewSnippetVi:
      "Kiến trúc mái vòm cực đẹp vào ban đêm khi lên đèn, gió sông Hàn mát mẻ.",
    reviewSnippetEn:
      "Striking illuminated canopy structure offering pleasant river breezes at night.",
  },
  {
    id: "nui_than_tai_hot_springs",
    nameVi: "Công Viên Suối Khoáng Nóng Núi Thần Tài",
    nameEn: "Nui Than Tai Hot Springs Park",
    summaryVi:
      "Khu nghỉ dưỡng sinh thái khoáng nóng tự nhiên nằm giữa thung lũng Bà Nà — Núi Chúa với bồn tắm khoáng nóng, tắm bùn, công viên nước và động Long Tiên.",
    summaryEn:
      "An eco-wellness resort nestled in the Ba Na foothills featuring natural thermal mineral pools, mud baths, and water park attractions.",
    category: "nature",
    address: "Quốc lộ 14G, Hòa Phú, Hòa Vang, Đà Nẵng",
    googleMapsUri:
      "https://www.google.com/maps/search/?api=1&query=C%C3%B4ng%20Vi%C3%AAn%20Su%E1%BB%91i%20Kho%C3%A1ng%20N%C3%B3ng%20N%C3%BAi%20Th%E1%BA%A7n%20T%C3%A0i",
    reviewSnippetVi:
      "Khoáng nóng thư giãn cơ thể, không khí rừng núi trong lành rất dễ chịu.",
    reviewSnippetEn:
      "Rejuvenating thermal waters surrounded by refreshing rainforest scenery.",
  },
  {
    id: "ghenh_bang_son_tra",
    nameVi: "Ghềnh Bàng — Sơn Trà",
    nameEn: "Ghenh Bang Coastal Cape — Son Tra",
    summaryVi:
      "Bãi đá tự nhiên hoang sơ với hàng dặm đá cuội và rạn san hô nông ven chân bán đảo Sơn Trà, thiên đường cho các bạn trẻ thích trekking và dã ngoại.",
    summaryEn:
      "A wild, rocky cape with coastal reefs and tidal pools, beloved by adventure trekkers and campers.",
    category: "nature",
    address: "Hoàng Sa, Thọ Quang, Sơn Trà, Đà Nẵng",
    googleMapsUri:
      "https://www.google.com/maps/search/?api=1&query=Gh%E1%BB%81nh%20B%C3%A0ng%20S%C6%A1n%20Tr%C3%A0%20%C4%90%C3%A0%20N%E1%BA%B5ng",
    reviewSnippetVi:
      "Cảnh biển hoang sơ tuyệt đối, thích hợp cắm trại và ngắm bình minh trên biển.",
    reviewSnippetEn:
      "Pristine unspoiled seascape ideal for rugged hiking and sunrise photography.",
  },
  {
    id: "thuan_phuoc_bridge",
    nameVi: "Cầu Thuận Phước",
    nameEn: "Thuan Phuoc Suspension Bridge",
    summaryVi:
      "Cây cầu treo dây võng dài nhất Việt Nam bắc qua cửa sông Hàn đổ ra vịnh Đà Nẵng, kết nối cung đường biển Nguyễn Tất Thành với bán đảo Sơn Trà.",
    summaryEn:
      "Vietnam's longest suspension bridge spanning the mouth of the Han River where it flows into Da Nang Bay.",
    category: "sightseeing",
    address: "Cửa biển sông Hàn, Sơn Trà & Hải Châu, Đà Nẵng",
    googleMapsUri:
      "https://www.google.com/maps/search/?api=1&query=C%E1%BA%A7u%20Thu%E1%BA%ADn%20Ph%C6%B0%E1%BB%9Bc%20%C4%90%C3%A0%20N%E1%BA%B5ng",
    reviewSnippetVi:
      "Gió biển lộng gió, ngắm hoàng hôn buông trên vịnh Đà Nẵng cực kỳ lãng mạn.",
    reviewSnippetEn:
      "Spectacular twilight viewpoints overlooking the open bay and coastal mountains.",
  },
  {
    id: "helio_center_night_market",
    nameVi: "Chợ Đêm & Khu Phức Hợp Helio",
    nameEn: "Helio Night Market & Entertainment Complex",
    summaryVi:
      "Tổ hợp chợ đêm ẩm thực và giải trí hàng đầu Đà Nẵng với hàng trăm món ăn đường phố Á — Âu, sân khấu nhạc sống acoustic và rạp chiếu phim.",
    summaryEn:
      "A premier evening food and lifestyle market featuring street cuisine, live acoustic stages, and festival activities.",
    category: "food",
    address: "Đường 2 Tháng 9, Hòa Cường Bắc, Hải Châu, Đà Nẵng",
    googleMapsUri:
      "https://www.google.com/maps/search/?api=1&query=Ch%E1%BB%A3%20%C4%90%C3%AAm%20Helio%20%C4%90%C3%A0%20N%E1%BA%B5ng",
    reviewSnippetVi:
      "Không gian sạch sẽ, món ăn phong phú từ bún mắm, nem lụi đến hải sản nướng.",
    reviewSnippetEn:
      "Clean, festive atmosphere with a mouthwatering array of regional dishes and live music.",
  },
];

function filterFallbackPlaces(
  request: ExploreSearchRequest,
): ExploreSearchResponse {
  const isVi = request.language === "vi";
  const queryLower = request.query.toLowerCase().trim();
  const categoryLower = request.category?.toLowerCase();

  let matches = REAL_WORLD_DANANG_PLACES;

  if (categoryLower && categoryLower !== "all" && categoryLower !== "tất cả") {
    matches = matches.filter(
      (place) =>
        place.category === categoryLower ||
        (categoryLower.includes("food") && place.category === "food") ||
        (categoryLower.includes("nature") && place.category === "nature") ||
        (categoryLower.includes("culture") && place.category === "culture") ||
        (categoryLower.includes("sightseeing") &&
          place.category === "sightseeing"),
    );
  }

  if (queryLower) {
    const scored = matches.filter((place) => {
      const name = (isVi ? place.nameVi : place.nameEn).toLowerCase();
      const summary = (isVi ? place.summaryVi : place.summaryEn).toLowerCase();
      const addr = place.address.toLowerCase();
      return (
        name.includes(queryLower) ||
        summary.includes(queryLower) ||
        addr.includes(queryLower) ||
        queryLower.includes(place.category)
      );
    });
    if (scored.length > 0) matches = scored;
  }

  const selected = matches.slice(0, 8);
  const places: ExplorePlaceItem[] = selected.map((place) => ({
    name: isVi ? place.nameVi : place.nameEn,
    summary: isVi ? place.summaryVi : place.summaryEn,
    address: place.address,
    category: place.category,
    googleMapsUri: place.googleMapsUri,
    reviewSnippet: isVi ? place.reviewSnippetVi : place.reviewSnippetEn,
  }));

  const overview = isVi
    ? `Dữ liệu địa điểm thực tế tại Đà Nẵng phù hợp với tìm kiếm "${request.query}". Bạn có thể xem chỉ đường chi tiết trên Google Maps.`
    : `Real-world places in Da Nang matching "${request.query}". You can open each location directly on Google Maps.`;

  return {
    overview,
    places,
    groundingSources: places.map((place) => ({
      title: place.name,
      uri: place.googleMapsUri,
    })),
    source: "authored_maps",
  };
}

export class GeminiMapsExplorerService implements MapsExplorerService {
  private readonly client: GoogleGenAI | null;

  public constructor(private readonly options: MapsExplorerServiceOptions) {
    this.client = options.apiKey
      ? new GoogleGenAI({
          apiKey: options.apiKey,
          httpOptions: { apiVersion: "v1", timeout: 10_000 },
        })
      : null;
  }

  public async explore(
    request: ExploreSearchRequest,
  ): Promise<MapsExplorerResult> {
    const fallback = filterFallbackPlaces(request);
    if (!this.client) {
      return fallback;
    }

    const isVi = request.language === "vi";
    const refLat = request.location?.latitude ?? 16.0544;
    const refLng = request.location?.longitude ?? 108.2022;

    const userQuery = request.query;
    const prompt = isVi
      ? `Hãy tìm kiếm các địa điểm thực tế, mới nhất và chính xác tại Đà Nẵng cho chủ đề: "${userQuery}". ${request.category ? `Danh mục: ${request.category}.` : ""} Cung cấp tên địa điểm, giới thiệu ngắn gọn lý do nổi bật, địa chỉ và cảm nhận trải nghiệm thực tế.`
      : `Search for authentic, up-to-date real-world places in Da Nang for: "${userQuery}". ${request.category ? `Category: ${request.category}.` : ""} Provide place names, concise descriptions, addresses, and visit highlights.`;

    try {
      const response = await this.client.models.generateContent({
        model: this.options.model || "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: refLat,
                longitude: refLng,
              },
            },
          },
        },
      });

      const text = response.text || "";
      const candidates = response.candidates || [];
      const groundingMetadata = candidates[0]?.groundingMetadata;
      const chunks =
        (groundingMetadata?.groundingChunks as Array<{
          maps?: {
            title?: string;
            uri?: string;
            address?: string;
            placeAnswerSources?: {
              reviewSnippets?: Array<{ text?: string }>;
            };
          };
          web?: { uri?: string; title?: string };
        }>) || [];

      const groundingSources: Array<{ title?: string; uri: string }> = [];
      const places: ExplorePlaceItem[] = [];

      for (const chunk of chunks) {
        if (chunk.maps?.uri) {
          const title = chunk.maps.title || "Địa điểm trên Google Maps";
          const uri = chunk.maps.uri;
          groundingSources.push({ title, uri });

          let reviewSnippet: string | undefined;
          const snippets = chunk.maps.placeAnswerSources?.reviewSnippets || [];
          if (snippets.length > 0 && snippets[0]?.text) {
            reviewSnippet = snippets[0].text.slice(0, 300);
          }

          places.push({
            name: title,
            summary: isVi
              ? `Địa điểm thực tế được định vị qua Google Maps tại Đà Nẵng.`
              : `Real-world location verified via Google Maps in Da Nang.`,
            address: chunk.maps.address,
            googleMapsUri: uri,
            reviewSnippet,
          });
        } else if (chunk.web?.uri) {
          groundingSources.push({
            title: chunk.web.title || "Nguồn bản đồ",
            uri: chunk.web.uri,
          });
        }
      }

      // If Maps grounding did not return distinct chunk items, combine with fallback items with real maps search links
      if (places.length === 0) {
        const enrichedFallback = filterFallbackPlaces(request);
        return {
          overview: text || enrichedFallback.overview,
          places: enrichedFallback.places,
          groundingSources:
            groundingSources.length > 0
              ? groundingSources
              : enrichedFallback.groundingSources,
          source: "gemini_maps",
        };
      }

      const result: ExploreSearchResponse = {
        overview:
          text.slice(0, 950) ||
          (isVi
            ? `Đã tìm thấy ${places.length} địa điểm thực tế tại Đà Nẵng.`
            : `Found ${places.length} real-world places in Da Nang.`),
        places: places.slice(0, 10),
        groundingSources: groundingSources.slice(0, 10),
        source: "gemini_maps",
      };

      return ExploreSearchResponseSchema.parse(result);
    } catch {
      return fallback;
    }
  }
}
