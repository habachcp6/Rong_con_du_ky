# Privacy

Public route: `/privacy`.

The MVP saves game state locally first. If Firebase is configured, an anonymous Firebase UID and the normalized game state may be synchronized to Firestore. The state contains language, quest progression, unlocked postcard keys, in-game coordinates and itinerary preferences; it does not contain Google Places ratings/reviews/hours/photos, raw Gemini output or chat history.

A Companion question is sent to the server only when that integration is configured. The server logs route/request metadata rather than the full prompt. Google Maps links open an external Google service under its own privacy policy.

The current build dispatches sanitized analytics events in browser memory only. It does not send an analytics-provider event, a chat message, GPS coordinates, email or a direct identifier. If a production analytics provider is added later, the team must add consent and update this document before release.

Players can clear local state via browser site-data controls. If production Firebase is enabled, the release page must provide a team contact and deletion-request path.
