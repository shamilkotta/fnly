export interface FnlyRequest {
  method: string;
  path: string;
  body: any;
  headers: Record<string, string>;
  query: Record<string, string>;
  params: Record<string, string>;
}
