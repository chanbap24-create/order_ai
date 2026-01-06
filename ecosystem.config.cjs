module.exports = {
  apps: [
    {
      name: 'order-ai',
      script: 'npm',
      args: 'run dev',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        ENABLE_TRANSLATION: 'true' // ✅ 번역 활성화 (영어 주문 지원)
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
