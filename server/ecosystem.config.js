module.exports = {
  apps: [{
    name        : 'cs-steel-wms',
    script      : 'app.js',
    cwd         : __dirname,
    instances   : 1,
    autorestart : true,
    watch       : false,
    env_production: {
      NODE_ENV : 'production',
      PORT     : 3001,
    },
  }],
};
