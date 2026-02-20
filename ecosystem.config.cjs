module.exports = {
  apps: [
    {
      name: 'demi-bot',
      script: 'index.js',
      node_args: '--experimental-specifier-resolution=node',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'demi-painel',
      script: './node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      interpreter: 'node'
    }
  ]
}
