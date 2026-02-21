module.exports = {
  apps: [
    {
      name: 'demibot',
      script: 'index.js',
      node_args: '--experimental-modules',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      kill_timeout: 5000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'demibot-painel',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: './',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
}
