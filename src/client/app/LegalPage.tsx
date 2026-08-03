import { useEffect, useState } from "react";
import type { Language } from "../../shared/types";

export type LegalDocument = "privacy" | "terms";

type LegalPageProps = {
  document: LegalDocument;
};

const copy = (language: Language, vi: string, en: string): string =>
  language === "vi" ? vi : en;

const legalContent = (document: LegalDocument, language: Language) => {
  if (document === "privacy") {
    return {
      eyebrow: copy(language, "Thông tin công khai", "Public information"),
      title: copy(language, "Chính sách quyền riêng tư", "Privacy notice"),
      intro: copy(
        language,
        "Rồng Con Du Ký là bản MVP quảng bá du lịch. Chính sách này mô tả chính xác cách bản build hiện tại xử lý dữ liệu.",
        "Rồng Con Du Ký is a tourism-promotion MVP. This notice describes how the current build handles data.",
      ),
      sections: [
        {
          title: copy(language, "Dữ liệu trò chơi", "Game data"),
          body: copy(
            language,
            "Tiến trình, ngôn ngữ và sở thích lịch trình được lưu trước hết trong localStorage của trình duyệt. Khi Firebase được đội cấu hình, người chơi được tạo một tài khoản ẩn danh và cùng dữ liệu tiến trình có thể được đồng bộ vào Firestore theo UID ẩn danh đó.",
            "Progress, language, and itinerary preferences are first saved in browser localStorage. When the team configures Firebase, an anonymous account is created and the same progress may be synchronized to Firestore under that anonymous UID.",
          ),
        },
        {
          title: copy(
            language,
            "Trợ lý và liên kết ngoài",
            "Companion and external links",
          ),
          body: copy(
            language,
            "Câu hỏi bạn chủ động nhập cho Trợ lý chỉ được gửi tới backend khi dịch vụ đã được cấu hình; backend không ghi toàn bộ nội dung prompt vào log ứng dụng. Các nút Google Maps mở Google Maps trong tab mới và chịu chính sách của Google.",
            "A question you voluntarily enter for the Companion is sent to the backend only when the service is configured; the backend does not log the full prompt. Google Maps buttons open Google Maps in a new tab and are governed by Google's policies.",
          ),
        },
        {
          title: copy(language, "Phân tích", "Analytics"),
          body: copy(
            language,
            "Build hiện tại chỉ phát sự kiện analytics đã lọc trong bộ nhớ trình duyệt để một tích hợp có consent có thể dùng về sau. Không có nhà cung cấp analytics hay định danh người dùng nào được gửi từ bản MVP này. Các sự kiện không chứa nội dung chat, vị trí GPS, email hay thông tin nhận dạng trực tiếp.",
            "The current build emits sanitized analytics events only in browser memory so a consent-aware integration can use them later. This MVP sends no analytics-provider data or user identifier. Events do not include chat content, GPS position, email, or direct identifiers.",
          ),
        },
        {
          title: copy(language, "Lựa chọn của bạn", "Your choices"),
          body: copy(
            language,
            "Bạn có thể xóa dữ liệu cục bộ bằng cách xóa site data trong trình duyệt. Nếu Firebase production được bật, hướng dẫn yêu cầu xóa dữ liệu sẽ được công bố cùng URL phát hành và thông tin liên hệ của đội.",
            "You can delete local data by clearing this site's browser data. If production Firebase is enabled, deletion-request instructions will be published with the release URL and team contact details.",
          ),
        },
      ],
    };
  }

  return {
    eyebrow: copy(language, "Thông tin công khai", "Public information"),
    title: copy(language, "Điều khoản sử dụng", "Terms of use"),
    intro: copy(
      language,
      "Đây là bản demo hackathon mang tính giáo dục và quảng bá du lịch, không phải dịch vụ đặt chỗ hay chỉ dẫn an toàn chính thức.",
      "This is an educational hackathon and tourism-promotion demo, not a booking service or official safety guidance.",
    ),
    sections: [
      {
        title: copy(language, "Thông tin tham quan", "Travel information"),
        body: copy(
          language,
          "Nội dung địa danh và thẻ gợi ý Starter là nội dung đã biên tập, có source ID hiển thị trong game. Không xem chúng là thông tin thời gian thực. Luôn kiểm tra điều kiện, giờ hoạt động, thời tiết, giá, tuyến đường và hướng dẫn của cơ quan/đơn vị chính thức trước khi đi.",
          "Landmark content and Starter recommendation cards are authored content with source IDs displayed in the game. They are not live information. Always check conditions, hours, weather, prices, routes, and official guidance before travelling.",
        ),
      },
      {
        title: copy(language, "Bảo tồn và an toàn", "Conservation and safety"),
        body: copy(
          language,
          "Nhiệm vụ Sơn Trà chỉ khuyến khích quan sát dấu vết. Không đuổi theo, chạm, cho ăn hay làm phiền động vật hoang dã; tuân theo biển báo và tuyến được phép tại điểm đến.",
          "The Son Tra quest encourages observing traces only. Do not chase, touch, feed, or disturb wildlife; follow signs and permitted routes at the destination.",
        ),
      },
      {
        title: copy(language, "Nội dung và liên kết", "Content and links"),
        body: copy(
          language,
          "Các dữ kiện được diễn giải từ nguồn được ghi nhận; ảnh trong MVP là placeholder do đội tạo. Google Maps là dịch vụ của Google và mọi liên kết ngoài được mở theo điều khoản của bên cung cấp tương ứng.",
          "Facts are paraphrased from attributed sources; MVP images are team-created placeholders. Google Maps is a Google service, and each external link opens under its provider's terms.",
        ),
      },
      {
        title: copy(language, "Giới hạn dịch vụ", "Service limitations"),
        body: copy(
          language,
          "MVP có thể chạy offline fallback khi Firebase, Gemini hoặc backend không sẵn sàng. Không có bảo đảm về tính sẵn sàng liên tục, tính chính xác thời gian thực hoặc phù hợp cho quyết định an toàn, y tế hay tài chính.",
          "The MVP can use offline fallbacks when Firebase, Gemini, or the backend is unavailable. It makes no guarantee of continuous availability, real-time accuracy, or suitability for safety, medical, or financial decisions.",
        ),
      },
    ],
  };
};

export const LegalPage = ({ document }: LegalPageProps) => {
  const [language, setLanguage] = useState<Language>(() =>
    typeof navigator !== "undefined" && navigator.language.startsWith("en")
      ? "en"
      : "vi",
  );
  const content = legalContent(document, language);

  useEffect(() => {
    window.document.title = `${content.title} | Rồng Con Du Ký`;
  }, [content.title]);

  return (
    <main className="legal-page">
      <nav className="legal-page__nav" aria-label="Legal navigation">
        <a href="/">← {copy(language, "Về game", "Back to game")}</a>
        <div>
          <a href="/privacy">{copy(language, "Quyền riêng tư", "Privacy")}</a>
          <a href="/terms">{copy(language, "Điều khoản", "Terms")}</a>
          <button
            type="button"
            onClick={() =>
              setLanguage((current) => (current === "vi" ? "en" : "vi"))
            }
          >
            {language === "vi" ? "English" : "Tiếng Việt"}
          </button>
        </div>
      </nav>
      <article className="legal-page__article">
        <p className="legal-page__eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p className="legal-page__intro">{content.intro}</p>
        {content.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
        <p className="legal-page__updated">
          {copy(language, "Cập nhật: 03/08/2026", "Last updated: 2026-08-03")}
        </p>
      </article>
    </main>
  );
};
