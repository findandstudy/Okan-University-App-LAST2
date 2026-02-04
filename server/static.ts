import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { storage } from "./storage";

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
      // Long cache for hashed assets (JS, CSS)
      if (filePath.match(/\.(js|css)$/) && filePath.includes('-')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      // Shorter cache for images
      else if (filePath.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
      // No cache for HTML
      else if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", async (_req, res) => {
    try {
      const tenant = await storage.getTenantByDomain("okanuniversity.app");
      let html = fs.readFileSync(path.resolve(distPath, "index.html"), "utf-8");
      
      if (tenant) {
        // Update page title
        if (tenant.universityName) {
          html = html.replace(
            /<title>.*?<\/title>/,
            `<title>${tenant.universityName}</title>`
          );
          html = html.replace(
            /<meta property="og:title" content=".*?">/,
            `<meta property="og:title" content="${tenant.universityName}">`
          );
        }
        
        // Update favicon
        if (tenant.faviconUrl) {
          html = html.replace(
            /<link rel="icon" type="image\/png" href=".*?">/,
            `<link rel="icon" type="image/png" href="${tenant.faviconUrl}">`
          );
        }
      }
      
      res.set("Content-Type", "text/html");
      res.send(html);
    } catch (error) {
      res.sendFile(path.resolve(distPath, "index.html"));
    }
  });
}
