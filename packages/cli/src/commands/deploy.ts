import archiver from "archiver";
import path from "path";
import fs from "fs/promises";
import fetch from "node-fetch";

interface FnlyConfig {
  projectId: string;
  userId?: string;
}

async function checkAuthentication() {
  // TODO: Implement actual authentication check
  return true;
}

async function getProjectConfig(cwd: string) {
  const configPath = path.join(cwd, "fnly.json");

  if (!(await fs.stat(configPath).catch(() => null))) {
    return null;
  }

  try {
    const configContent = await fs.readFile(configPath, "utf8");
    const config = JSON.parse(configContent) as FnlyConfig;

    if (!config.projectId) {
      return null;
    }

    return config;
  } catch (error) {
    console.error("❌ Failed to read fnly.json:", error);
    return null;
  }
}

async function getSignedUrl(projectId: string) {
  const response = await fetch(`${process.env.API_URL}/deployments/upload`, {
    method: "POST",
    body: JSON.stringify({ projectId, teamId: "1234567890" }),
    headers: {
      "Content-Type": "application/json"
    }
  }).then((res) => res.json() as Promise<{ signedUrl: string }>);
  return response.signedUrl;
}

async function archiveSource(cwd: string): Promise<Buffer> {
  const apiDir = path.join(cwd, "api");

  if (!(await fs.stat(apiDir).catch(() => null))) {
    throw new Error(`API directory not found: ${apiDir}`);
  }

  const archive = archiver("zip", { zlib: { level: 9 } });

  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    archive.on("error", (error) => {
      reject(error);
    });

    archive.directory(apiDir, false);
    archive.finalize();
  });
}

async function uploadToS3(zipBuffer: Buffer, signedUrl: string) {
  const response = await fetch(signedUrl, {
    method: "PUT",
    body: zipBuffer,
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": zipBuffer.length.toString()
    }
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to upload to S3: ${response.status} ${errorText}`);
  }
}

export async function deployCommand() {
  const cwd = process.cwd();

  console.log("🚀 Starting deployment...\n");
  console.log("🔐 Checking authentication...");
  const isAuthenticated = await checkAuthentication();
  if (!isAuthenticated) {
    console.error("❌ Authentication failed. Please log in.");
    process.exit(1);
  }
  console.log("✅ Authentication check passed\n");

  console.log("📋 Checking project configuration...");
  const config = await getProjectConfig(cwd);
  if (!config) {
    console.error(
      "❌ Project not configured. Please ensure fnly.json exists with projectId."
    );
    process.exit(1);
  }
  console.log(`✅ Project configured: ${config.projectId}\n`);

  console.log("📦 Creating deployment package from api folder...");
  let zipBuffer: Buffer;
  try {
    zipBuffer = await archiveSource(cwd);
  } catch (error) {
    console.error("❌ Failed to create deployment package:", error);
    process.exit(1);
  }

  console.log("🔗 Getting upload URL...");
  let signedUrl: string;
  try {
    signedUrl = await getSignedUrl(config.projectId);
    if (!signedUrl) {
      console.error("❌ Failed to get upload URL");
      process.exit(1);
    }
    console.log("✅ Received signed URL\n");
  } catch (error) {
    console.error("❌ Failed to get upload URL:", error);
    process.exit(1);
  }

  console.log("☁️  Uploading to Fnly...");
  try {
    await uploadToS3(zipBuffer, signedUrl);
    console.log("\n🎉 Deployment successful!");
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  }
}
