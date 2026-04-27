module.exports = {
  apps: [
    {
      name: "food-crm-backend",
      script: "npm",
      args: "run start",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: "4000",
      },
      max_memory_restart: "512M",
    },
  ],
};
