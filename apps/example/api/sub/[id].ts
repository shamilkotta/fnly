export async function handler(event: any) {
  const { id } = event.pathParameters;
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello details route!,", id })
  };
}
