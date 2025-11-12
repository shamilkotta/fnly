export interface FnlyRequest {
  method: string;
  path: string;
  body: any;
  headers: Record<string, string>;
  query: Record<string, string>;
  params: Record<string, string>;
}

export interface FnlyResponse {
  status: (status: number) => FnlyResponse;
  json: (body: Record<string, any>) => FnlyResponse;
  send: (body: any) => FnlyResponse;
}

export function createRequestHandler(module: any) {
  return (event: any) => {
    // TODO: event hanler
    const { method } = event;
    const handler = module[method.toUpperCase()];
    if (!handler) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: `Method not allowed` })
      };
    }

    const fnlyRequest: FnlyRequest = {
      method,
      path: event.path,
      body: event.body,
      headers: event.headers,
      query: event.query,
      params: event.params
    };

    return handler(fnlyRequest);
  };
}
