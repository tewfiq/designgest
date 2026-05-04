import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import { Hyperbrowser } from "@hyperbrowser/sdk";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const hb = new Hyperbrowser({
    apiKey: process.env.HYPERBROWSER_API_KEY,
  });

  // API Routes
  app.post("/api/analyze", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      console.log(`Capturing screenshot for URL: ${url}`);
      
      if (!process.env.HYPERBROWSER_API_KEY) {
        throw new Error("HYPERBROWSER_API_KEY is not configured.");
      }

      // 0. Cleanup active sessions (for free tier limit)
      try {
        const sessionsRes: any = await hb.sessions.list();
        const activeSessions = (sessionsRes.sessions || []).filter((s: any) => s.status === "active" || s.status === "running");
        if (activeSessions.length > 0) {
          for (const s of activeSessions) {
            console.log(`Closing active session: ${s.id}`);
            await hb.sessions.stop(s.id);
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (e) {
        console.warn("Failed to cleanup sessions:", e);
      }

      // 1. Scrape with Hyperbrowser SDK
      let scrapeResult: any;
      let retries = 0;
      const maxRetries = 2;

      while (retries <= maxRetries) {
        try {
          scrapeResult = await hb.scrape.startAndWait({
            url,
            scrapeOptions: {
              formats: ["screenshot"],
              screenshotOptions: {
                fullPage: true,
              }
            }
          });
          
          if (scrapeResult.status === "completed") break;
          
          if (scrapeResult.error?.includes("Maximum number of active sessions") && retries < maxRetries) {
            console.log("Hitting concurrency limit, retrying in 3s...");
            await new Promise(resolve => setTimeout(resolve, 3000));
            retries++;
            continue;
          }
          break;
        } catch (err: any) {
          if (err.message.includes("Maximum number of active sessions") && retries < maxRetries) {
             console.log("Hitting concurrency limit via exception, retrying in 3s...");
             await new Promise(resolve => setTimeout(resolve, 3000));
             retries++;
             continue;
          }
          throw err;
        }
      }

      if (scrapeResult.status !== "completed" || !scrapeResult.data?.screenshot) {
        console.error("Scrape failed or missing screenshot:", scrapeResult.error);
        throw new Error(scrapeResult.error || "Failed to capture screenshot");
      }

      const screenshotValue = scrapeResult.data.screenshot;
      let screenshotBase64: string;
      let mimeType = "image/png";

      if (screenshotValue.startsWith("http")) {
        console.log("Fetching screenshot from URL:", screenshotValue);
        const imageRes = await axios.get(screenshotValue, {
          responseType: "arraybuffer",
        });
        screenshotBase64 = Buffer.from(imageRes.data).toString("base64");
        const contentType = imageRes.headers["content-type"];
        mimeType = typeof contentType === "string" ? contentType : (screenshotValue.endsWith(".webp") ? "image/webp" : "image/png");
      } else {
        screenshotBase64 = screenshotValue.replace(/^data:image\/\w+;base64,/, "");
        const mimeMatch = screenshotValue.match(/^data:(image\/\w+);base64,/);
        if (mimeMatch) mimeType = mimeMatch[1];
      }

      res.json({ screenshotBase64, mimeType });
    } catch (error: any) {
      console.error("Capture failed:", error.message);
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
