import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import { Hyperbrowser } from "@hyperbrowser/sdk";
import FirecrawlApp from "@mendable/firecrawl-js";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/analyze", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      console.log(`[PIPELINE] Starting capture for URL: ${url}`);
      
      const hbApiKey = process.env.HYPERBROWSER_API_KEY;
      const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
      
      let screenshotBase64: string | null = null;
      let mimeType = "image/png";

      // --- 1. ATTEMPT HYPERBROWSER ---
      if (hbApiKey) {
        try {
          const hb = new Hyperbrowser({ apiKey: hbApiKey });
          console.log("[HYPERBROWSER] Attempting capture...");

          const scrapeWithRetry = async (targetUrl: string, retries = 2) => {
            for (let i = 0; i < retries; i++) {
              try {
                const sessionsRes: any = await hb.sessions.list();
                const activeSessions = (sessionsRes.sessions || []).filter((s: any) => 
                  s.status === "active" || s.status === "running" || s.status === "pending"
                );
                
                if (activeSessions.length > 0) {
                  for (const s of activeSessions) {
                    console.log(`[HYPERBROWSER] Closing active session: ${s.id}`);
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
                  console.log("[HYPERBROWSER] Session limit reached, retrying...");
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

          const hbResult = await scrapeWithRetry(url);
          const screenshotValue = hbResult.data.screenshot;

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
          console.log("[HYPERBROWSER] Capture success.");
        } catch (hbError: any) {
          console.warn("[HYPERBROWSER] Failed:", hbError.message);
        }
      }

      // --- 2. FALLBACK TO FIRECRAWL ---
      if (!screenshotBase64 && firecrawlApiKey) {
        try {
          console.log("[FIRECRAWL] Attempting fallback capture...");
          const fc = new FirecrawlApp({ apiKey: firecrawlApiKey });
          const scrapeResponse = await (fc as any).scrapeUrl(url, {
            formats: ["screenshot"]
          });

          if (scrapeResponse.success && scrapeResponse.screenshot) {
            screenshotBase64 = scrapeResponse.screenshot.replace(/^data:image\/\w+;base64,/, "");
            const mimeMatch = scrapeResponse.screenshot.match(/^data:(image\/\w+);base64,/);
            if (mimeMatch) mimeType = mimeMatch[1];
            console.log("[FIRECRAWL] Capture success.");
          } else {
            throw new Error(scrapeResponse.error || "Firecrawl capture failed");
          }
        } catch (fcError: any) {
          console.error("[FIRECRAWL] Failed too:", fcError.message);
        }
      }

      if (!screenshotBase64) {
        throw new Error("Both capture pipelines failed. Please check your API keys and concurrency limits.");
      }

      res.json({ screenshotBase64, mimeType });
    } catch (error: any) {
      console.error("[PIPELINE ERROR]:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
