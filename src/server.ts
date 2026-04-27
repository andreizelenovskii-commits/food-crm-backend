import { createApp } from "@backend/app";
import { backendEnv } from "@backend/config/env";

async function main() {
  const app = await createApp();

  try {
    await app.listen({
      host: backendEnv.host,
      port: backendEnv.port,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
