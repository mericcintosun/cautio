import { ImageResponse } from "next/og";

export const alt = "Cautio: rental deposits neither side can touch alone";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// IDENTITY.md palette: stock #f3efe6, ink #1c1b3b, riso-orange #ff6a2b, riso-blue #2f55d4.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#f3efe6", color: "#1c1b3b" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            background: "#ff6a2b",
            clipPath: "polygon(62% 0, 100% 0, 100% 100%, 44% 100%)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, width: "100%" }}>
          <div style={{ display: "flex", fontSize: 150, fontWeight: 900, letterSpacing: -2, textShadow: "6px 4px 0 #2f55d4" }}>CAUTIO</div>
          <div style={{ display: "flex", fontSize: 40, lineHeight: 1.25, maxWidth: 720 }}>
            The deposit sits in a shared vault. Every deduction is its own line. Disputes end with one of two sealed offers.
          </div>
          <div style={{ display: "flex", fontSize: 26 }}>USDG on Arbitrum · São Paulo</div>
        </div>
      </div>
    ),
    size
  );
}
