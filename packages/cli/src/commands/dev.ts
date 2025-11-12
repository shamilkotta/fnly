import path from "path";
import express, { Request, Response } from "express";
import { tsImport } from "tsx/esm/api";

import { FnlyRequest } from "../index.js";
import {
  buildRouteMap,
  getRouteFile,
  matchRoute,
  extractRouteParams,
  watchRouteMap
} from "../routing.js";
import { isFileExists } from "../utils.js";

export async function devCommand() {
  console.log("Starting development server...");
  const cwd = process.cwd();
  const apiDir = path.resolve(cwd, "api");
  if (!(await isFileExists(apiDir))) {
    console.error(`❌ API directory not found: ${apiDir}`);
    throw new Error(`API directory not found: ${apiDir}`);
  }

  // Build route map at startup
  console.log("Building routes...");
  const routeMap = await buildRouteMap(apiDir);
  console.log(`✓ Found ${routeMap.size} routes`);

  // Watch for file additions and removals
  const stopWatching = watchRouteMap(apiDir, routeMap);

  process.on("SIGINT", () => {
    stopWatching();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    stopWatching();
    process.exit(0);
  });

  const app = express();

  app.use(express.json());
  app.use(express.text());

  // Handle all /api/* routes
  app.all("/api/*", async (req: Request, res: Response) => {
    try {
      let routePath = req.path.replace(/^\/api/, "");
      if (routePath === "" || routePath === "/") {
        routePath = "/";
      }

      const filePath = await getRouteFile(routePath, apiDir, routeMap);

      if (!filePath) {
        return res.status(404).json({
          message: "Route not found",
          method: req.method,
          path: req.path,
          status: 404
        });
      }

      const module = await tsImport(filePath, import.meta.url);
      const handler = module[req.method.toUpperCase()];

      if (!handler) {
        return res.status(404).json({
          message: "Method not allowed",
          method: req.method,
          path: req.path,
          status: 404
        });
      }

      const routeInfo = matchRoute(routePath, routeMap);
      const routeParams = routeInfo
        ? extractRouteParams(routePath, routeInfo)
        : {};

      const headers: Record<string, string> = {};
      Object.entries(req.headers).forEach(([key, value]) => {
        if (value) {
          headers[key] = Array.isArray(value)
            ? value.join(", ")
            : String(value);
        }
      });

      const query: Record<string, string> = {};
      Object.entries(req.query).forEach(([key, value]) => {
        query[key] = Array.isArray(value) ? value.join(", ") : String(value);
      });

      const fnlyRequest: FnlyRequest = {
        method: req.method,
        path: req.path,
        body: req.body,
        headers,
        query,
        params: routeParams
      };

      const result = await handler(fnlyRequest);

      if (result) {
        if (
          typeof result === "object" &&
          "statusCode" in result &&
          "body" in result
        ) {
          const response = result as { statusCode: number; body: string };
          res.status(response.statusCode || 200);
          res.setHeader("Content-Type", "application/json");
          res.send(response.body);
        } else {
          res.json(result);
        }
      } else {
        res.json({});
      }
    } catch (err) {
      console.error("Error handling request:", err);
      res.status(500).json({
        message: "Internal server error",
        error: err instanceof Error ? err.message : String(err),
        status: 500
      });
    }
  });

  app.use((req: Request, res: Response) => {
    res.status(404).json({
      message: "Route not found",
      method: req.method,
      path: req.path,
      status: 404
    });
  });

  app.use(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
      console.error("Error:", err);
      res.status(500).json({
        message: "Internal server error",
        error: err.message,
        status: 500
      });
    }
  );

  const port = 3000;
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}
