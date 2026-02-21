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
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'demibot-painel',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: './',
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
