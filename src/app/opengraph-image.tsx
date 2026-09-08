import { ImageResponse } from "next/og";

import { getSettings } from "@/lib/settings";

/**
 * The image that appears when someone shares the site on WhatsApp, Facebook or
 * a group chat.
 *
 * Worth real effort here: in Sri Lanka a business link is far more likely to be
 * passed around on WhatsApp than clicked from a search page, and a link with no
 * preview card looks like spam.
 *
 * Generated rather than a static file so the tagline follows whatever the owner
 * sets in admin Settings.
 */
export const alt = "Car Dress SL — vehicle service centre and auto spare parts";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const settings = await getSettings();

  const name = settings["site.name"] || "Car Dress SL";
  const tagline =
    settings["site.tagline"] || "Vehicle service centre & auto spare parts";
  const phone = settings["contact.phone"];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0c0c0b",
          // Two brand washes, matching the site's hero treatment.
          backgroundImage:
            "radial-gradient(60% 55% at 12% 0%, rgba(255,64,0,0.30), transparent 70%), radial-gradient(50% 45% at 92% 12%, rgba(255,115,64,0.18), transparent 70%)",
          fontFamily: "sans-serif",
          color: "#fafaf9",
        }}
      >
        {/* Wordmark, drawn as text so no font file has to be fetched. */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>CAR</span>
          <span
            style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1, color: "#ff4000" }}
          >
            DRESS
          </span>
          <span
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "#8c8c88",
              marginTop: 14,
            }}
          >
            SL
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 78,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -2.5,
              maxWidth: 900,
            }}
          >
            Your car, sorted properly.
          </div>
          <div style={{ fontSize: 30, color: "#b9b9b6", maxWidth: 860 }}>{tagline}</div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #3d3d3b",
            paddingTop: 28,
            fontSize: 26,
            color: "#8c8c88",
          }}
        >
          <span>{name}</span>
          {phone ? <span style={{ color: "#ff7340" }}>{phone}</span> : <span />}
        </div>
      </div>
    ),
    size,
  );
}
