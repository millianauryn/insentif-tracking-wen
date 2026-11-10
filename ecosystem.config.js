module.exports = {
  apps: [
    {
      name: 'insetive-api',
      script: 'index.js',
      cwd: '/opt/insetive-tracking/server',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        CLIENT_ORIGIN: 'https://your-domain.com'
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3002,
        CLIENT_ORIGIN: 'http://localhost:5173'
      },
      error_file: '/var/log/pm2/insetive-api-error.log',
      out_file: '/var/log/pm2/insetive-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '500M',
      node_args: '',
      watch: false,
      ignore_watch: ['node_modules', 'data', '*.log'],
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};