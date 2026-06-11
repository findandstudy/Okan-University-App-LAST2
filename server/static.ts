import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { injectSeoMeta } from "./seoRenderer";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Static assets with immutable caching for hashed files
  app.use(express.static(distPath, {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, filePath) => {
      if (filePath.match(/\.(js|css)$/) && filePath.includes('-')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (filePath.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      } else if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));

  // Fallthrough to index.html — inject SSR meta tags for bots before sending
  app.use("/{*path}", async (req, res) => {
    try {
      let html = fs.readFileSync(path.resolve(distPath, "index.html"), "utf-8");

      // SSR meta injection (OG tags, Twitter card, JSON-LD, canonical, hreflang)
      html = await injectSeoMeta(html, req);

      res.set("Content-Type", "text/html");
      res.set("Cache-Control", "no-cache");
      res.send(html);
    } catch (error) {
      res.set("Cache-Control", "no-cache");
      res.sendFile(path.resolve(distPath, "index.html"));
    }
  });
}
