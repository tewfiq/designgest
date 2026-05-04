import { Handler } from "@netlify/functions";
import { Hyperbrowser } from "@hyperbrowser/sdk";
import FirecrawlApp from "@mendable/firecrawl-js";
import axios from "axios";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { url } = JSON.parse(event.body || "{}");
    if (!url) {
      return { statusCode: 400, body: JSON.stringify({ error: "URL is required" }) };
    }

    const hbApiKey = process.env.HYPERBROWSER_API_KEY;
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;

    let screenshotBase64: string | null = null;
    let mimeType = "image/png";

    // --- 1. ATTEMPT HYPERBROWSER ---
    if (hbApiKey) {
      try {
        const hb = new Hyperbrowser({ apiKey: hbApiKey });
        
        // Helper for scraping with retries
        const scrapeWithRetry = async (targetUrl: string, retries = 2) => {
          for (let i = 0; i < retries; i++) {
            try {
              // Cleanup active sessions (Free tier limit)
              const sessionsRes: any = await hb.sessions.list();
              const activeSessions = (sessionsRes.sessions || []).filter((s: any) => 
                s.status === "active" || s.status === "running" || s.status === "pending"
              );
              
              if (activeSessions.length > 0) {
                for (const s of activeSessions) {
                  await hb.sessions.stop(s.id);
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
              }

              const result = await hb.scrape.startAndWait({
                url: targetUrl,
                scrapeOptions: {
                  formats: ["screenshot"],
                  screenshotOptions: { fullPage: true }
                }
              });

              if (result.status === "completed" && result.data?.screenshot) {
                return result;
              }
              
              if (result.error?.includes("Maximum number of active sessions") && i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
              }
              throw new Error(result.error || "Hyperbrowser capture failed");
            } catch (err: any) {
              if (err.message.includes("Maximum number of active sessions") && i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
              }
              throw err;
            }
          }
          throw new Error("Hyperbrowser max retries reached");
        };

        const res = await scrapeWithRetry(url);
        const screenshotValue = res.data.screenshot;

        if (screenshotValue.startsWith("http")) {
          const imageRes = await axios.get(screenshotValue, { responseType: "arraybuffer" });
          screenshotBase64 = Buffer.from(imageRes.data).toString("base64");
          const contentType = imageRes.headers["content-type"];
          mimeType = typeof contentType === "string" ? contentType : "image/png";
        } else {
          screenshotBase64 = screenshotValue.replace(/^data:image\/\w+;base64,/, "");
          const mimeMatch = screenshotValue.match(/^data:(image\/\w+);base64,/);
          if (mimeMatch) mimeType = mimeMatch[1];
        }
      } catch (hbError) {
        console.warn("Hyperbrowser failed, trying Firecrawl fallback...", hbError);
      }
    }

    // --- 2. FALLBACK TO FIRECRAWL ---
    if (!screenshotBase64 && firecrawlApiKey) {
      try {
        const app = new FirecrawlApp({ apiKey: firecrawlApiKey });
        const scrapeResponse = await (app as any).scrapeUrl(url, {
          formats: ["screenshot"]
        });

        if (scrapeResponse.success && scrapeResponse.screenshot) {
          screenshotBase64 = scrapeResponse.screenshot.replace(/^data:image\/\w+;base64,/, "");
          const mimeMatch = scrapeResponse.screenshot.match(/^data:(image\/\w+);base64,/);
          if (mimeMatch) mimeType = mimeMatch[1];
        } else {
          throw new Error(scrapeResponse.error || "Firecrawl capture failed");
        }
      } catch (fcError) {
        console.error("Firecrawl failed too:", fcError);
      }
    }

    if (!screenshotBase64) {
      throw new Error("Both Hyperbrowser and Firecrawl failed to capture the screenshot.");
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ screenshotBase64, mimeType }),
    };
  } catch (error: any) {
    console.error("Pipeline failed:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
