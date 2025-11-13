import path from "path";
import fs from "fs/promises";
import { watch } from "fs";
import { glob } from "glob";
import { filePathToRoute } from "@fnly/core";

export interface RouteInfo {
  filePath: string;
  expressPath: string;
  params: string[];
}

function extractParams(filePath: string): string[] {
  const matches = filePath.match(/\[([^\]]+)\]/g);
  if (!matches) return [];
  return matches.map((match) => match.replace(/\[|\]/g, ""));
}

export async function buildRouteMap(
  apiDir: string
): Promise<Map<string, RouteInfo>> {
  const routeMap = new Map<string, RouteInfo>();

  let files = await glob(`${apiDir}/**/*.{ts,js}`, {
    ignore: ["**/node_modules/**", "**/_*", "**/_*/**"]
  });

  files = files.filter((file) => {
    const filePath = path.relative(apiDir, file);
    // eslint-disable-next-line no-useless-escape
    return /^[A-Za-z0-9.\/\\\-\[\]]+$/.test(filePath);
  });

  for (const fullPath of files) {
    const relativeFilePath = path.relative(apiDir, fullPath);
    const expressPath = filePathToRoute(relativeFilePath, "express");
    const params = extractParams(relativeFilePath);

    routeMap.set(expressPath, {
      filePath: fullPath,
      expressPath,
      params
    });
  }

  return routeMap;
}

export function matchRoute(
  requestPath: string,
  routeMap: Map<string, RouteInfo>
): RouteInfo | null {
  // Normalize the request path
  const normalizedPath =
    requestPath.endsWith("/") && requestPath !== "/"
      ? requestPath.slice(0, -1)
      : requestPath;

  // Try exact match first
  if (routeMap.has(normalizedPath)) {
    return routeMap.get(normalizedPath)!;
  }

  const pathSegments = normalizedPath.split("/").filter(Boolean);

  for (const [routePath, routeInfo] of routeMap.entries()) {
    const routeSegments = routePath.split("/").filter(Boolean);

    if (routeSegments.length !== pathSegments.length) {
      continue;
    }

    let matches = true;
    const matchedParams: Record<string, string> = {};

    for (let i = 0; i < routeSegments.length; i++) {
      const routeSegment = routeSegments[i] as string;
      const pathSegment = pathSegments[i] as string;

      if (routeSegment.startsWith(":")) {
        const paramName = routeSegment.slice(1);
        matchedParams[paramName] = pathSegment;
      } else if (routeSegment !== pathSegment) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return routeInfo;
    }
  }

  return null;
}

export async function getRouteFile(
  requestPath: string,
  apiDir: string,
  routeMap: Map<string, RouteInfo>
): Promise<string | null> {
  let routePath = requestPath.replace(/^\/api/, "");
  if (routePath === "" || routePath === "/") {
    routePath = "/";
  }

  const routeInfo = matchRoute(routePath, routeMap);
  if (routeInfo) {
    return routeInfo.filePath;
  }

  if (routePath !== "/") {
    const fileSystemPath = routePath.startsWith("/")
      ? routePath.slice(1)
      : routePath;

    const directPath = path.join(apiDir, `${fileSystemPath}.ts`);
    try {
      await fs.stat(directPath);
      return directPath;
    } catch {
      const indexPath = path.join(apiDir, fileSystemPath, "index.ts");
      try {
        await fs.stat(indexPath);
        return indexPath;
      } catch {
        // Not found
      }
    }
  } else {
    const rootIndexPath = path.join(apiDir, "index.ts");
    try {
      await fs.stat(rootIndexPath);
      return rootIndexPath;
    } catch {
      // Not found
    }
  }

  return null;
}

export function extractRouteParams(
  requestPath: string,
  routeInfo: RouteInfo
): Record<string, string> {
  const params: Record<string, string> = {};

  if (routeInfo.params.length === 0) {
    return params;
  }

  const requestSegments = requestPath.split("/").filter(Boolean);
  const routeSegments = routeInfo.expressPath.split("/").filter(Boolean);

  for (let i = 0; i < routeSegments.length; i++) {
    const routeSegment = routeSegments[i] as string;
    if (routeSegment.startsWith(":")) {
      const paramName = routeSegment.slice(1);
      params[paramName] = requestSegments[i] || "";
    }
  }

  return params;
}

export function watchRouteMap(
  apiDir: string,
  routeMap: Map<string, RouteInfo>,
  onUpdate?: (newRouteMap: Map<string, RouteInfo>) => void
): () => void {
  let rebuildTimeout: NodeJS.Timeout | null = null;
  let isRebuilding = false;
  const watchers: ReturnType<typeof watch>[] = [];

  const rebuildRouteMap = async () => {
    if (isRebuilding) return;

    isRebuilding = true;
    try {
      const newRouteMap = await buildRouteMap(apiDir);

      routeMap.clear();
      for (const [key, value] of newRouteMap.entries()) {
        routeMap.set(key, value);
      }

      console.log(`✓ Routes updated: ${routeMap.size} routes`);

      if (onUpdate) {
        onUpdate(routeMap);
      }
    } catch (err) {
      console.error("Error rebuilding routes:", err);
    } finally {
      isRebuilding = false;
    }
  };

  const debouncedRebuild = () => {
    if (rebuildTimeout) {
      clearTimeout(rebuildTimeout);
    }
    rebuildTimeout = setTimeout(rebuildRouteMap, 300);
  };

  const isRouteFile = (filename: string): boolean => {
    return (
      (filename.endsWith(".ts") || filename.endsWith(".js")) &&
      !filename.startsWith("_")
    );
  };

  const watchDirectory = (dir: string) => {
    const watcher = watch(
      dir,
      { recursive: false },
      async (eventType, filename) => {
        if (!filename) return;

        if (eventType === "rename") {
          const filePath = path.join(dir, filename);

          try {
            const stat = await fs.stat(filePath);
            if (stat.isDirectory() && !filename.startsWith("_")) {
              watchDirectory(filePath);
              debouncedRebuild();
            } else if (isRouteFile(filename)) {
              debouncedRebuild();
            }
          } catch {
            if (isRouteFile(filename)) {
              debouncedRebuild();
            }
          }
        }
      }
    );

    watchers.push(watcher);

    fs.readdir(dir, { withFileTypes: true })
      .then((entries) => {
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith("_")) {
            watchDirectory(path.join(dir, entry.name));
          }
        }
      })
      .catch(() => {});
  };

  watchDirectory(apiDir);

  return () => {
    for (const watcher of watchers) {
      watcher.close();
    }
    if (rebuildTimeout) {
      clearTimeout(rebuildTimeout);
    }
  };
}
