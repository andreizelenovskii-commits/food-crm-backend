module.exports = {
  apps: [
    {
      name: "food-crm-backend-staging",
      script: "npm",
      args: "run start",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: "4100",
      },
      max_memory_restart: "512M",
    },
  ],
};
