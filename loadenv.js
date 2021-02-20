/* eslint-disable no-console, @typescript-eslint/no-var-requires */
const dotenv = require('dotenv');

function loadEnv(envs) {
  const fullEnvs = [...envs];
  if (!fullEnvs.includes(null) && !fullEnvs.includes(undefined)) {
    fullEnvs.push(null);
  }
  fullEnvs.forEach((env) => {
    const path = env == null ? '.env.local' : `.env.${env}.local`;
    const res = dotenv.config({ path, silent: true });
    if (res && !res.error) console.log(`Loaded env-vars from ${path}`);
    if (res && res.error && res.error.code !== 'ENOENT') {
      console.error(res.error);
    }
  });
  fullEnvs.forEach((env) => {
    const path = env == null ? '.env' : `.env.${env}`;
    const res = dotenv.config({ path, silent: true });
    if (res && !res.error) console.log(`Loaded env-vars from ${path}`);
    if (res && res.error && res.error.code !== 'ENOENT') {
      console.error(res.error);
    }
  });
}

if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_ENV = 'development';
}

if (process.env.DEPLOY_ENV == null) process.env.DEPLOY_ENV = 'localdev';
loadEnv([process.env.DEPLOY_ENV, process.env.NODE_ENV]);
