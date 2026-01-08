// PM2 설정 - ML 서버 + Next.js 서버
module.exports = {
  apps: [
    {
      name: 'order-ai',
      script: 'npx',
      args: 'wrangler pages dev dist --ip 0.0.0.0 --port 3000',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        ML_SERVER_URL: 'http://localhost:8000'
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    },
    {
      name: 'ml-server',
      script: './venv/bin/python',
      args: 'main.py',
      cwd: '/home/user/webapp/ml-server',
      interpreter: 'none',
      env: {
        PYTHONUNBUFFERED: '1',
        PORT: 8000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '2G',
      error_file: './logs/ml-error.log',
      out_file: './logs/ml-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
