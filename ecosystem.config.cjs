module.exports = {
  apps: [
    {
      name: 'order-ai',
      script: 'npm',
      args: 'run dev',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        ENABLE_TRANSLATION: 'false' // ✅ 번역 비활성화 (속도 개선)
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
