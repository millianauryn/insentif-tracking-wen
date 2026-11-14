module.exports = {
  apps: [
    {
      name: 'insetive-api',
      script: 'index.js',
      cwd: 'server', // relative: resolves to <project-root>/server wherever the config is started (Windows repo or /opt deploy)
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        CLIENT_ORIGIN: 'https://your-domain.com',
        COOKIE_SECURE: 'false' // plain-HTTP deployment: browser refuses Secure cookies over http
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
      // 100, bukan 10: selama job deploy berjalan app bisa kena badai kill
      // ~0,5 detik per start. Dengan 10, PM2 menyerah ("errored") tepat saat
      // badai selesai -> situs 502 permanen. Dengan 100 app hidup lagi sendiri
      // setelah job selesai (~40 detik badai jauh di bawah batas ini).
      max_restarts: 100,
      min_uptime: '10s'
    }
  ]
};