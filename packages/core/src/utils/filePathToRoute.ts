type Service = "express" | "worker";

export function filePathToRoute(
  relativeFilePath: string,
  service: Service
): string {
  let route = relativeFilePath
    .replace(/\.ts$/, "")
    .replace(/\.js$/, "")
    .replace(/\./g, "-");

  route = route.replace(/\\/g, "/");

  if (route.endsWith("/index")) {
    route = route.replace("/index", "");
  }

  route = route.replace(/\[([^\]]+)\]/g, dynamicSymbol(service));

  if (!route.startsWith("/")) {
    route = "/" + route;
  }

  if (route === "/" || route === "") {
    return "/";
  }

  return route;
}

const dynamicSymbol = (service: Service) => {
  switch (service) {
    case "express":
      return ":$1";
    case "worker":
      return "{$1}";
    default:
      throw new Error(`Invalid service: ${service}`);
  }
};
