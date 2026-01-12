module.exports = {
  apps: [
    {
      name: 'ml-server',
      script: './start-ml.sh',
      cwd: '/home/user/webapp/ml-server',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 8000
      },
      error_file: './logs/ml-error.log',
      out_file: './logs/ml-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
