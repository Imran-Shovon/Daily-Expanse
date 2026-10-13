// Vercel Function entry for the API. All /api/v1/* requests are rewritten here and handled
// by the compiled Nest app (built with `nest build`, which keeps the decorator metadata that
// NestJS dependency injection needs).
const { getServer } = require('@expense/api/dist/serverless.js');

module.exports = async function handler(req, res) {
  const app = await getServer();
  return app(req, res);
};
