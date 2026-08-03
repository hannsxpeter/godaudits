'use strict';
const { primary, reader, timeouts, listPageLimit } = require('./db');
const { send } = require('./reply');
const log = require('./log');

const MAX_TITLE_LENGTH = 200;

function pageLimit(query) {
  const asked = Number(query.get('limit'));
  if (!Number.isInteger(asked) || asked < 1) {
    return listPageLimit;
  }
  return Math.min(asked, listPageLimit);
}

// GET /articles: the browse list the editorial console paints on open.
async function listArticles(res, ctx) {
  const limit = pageLimit(ctx.query);
  const after = ctx.query.get('after') || null;
  const page = await reader.articles.findMany({ after, limit }, { timeoutMs: timeouts.reader });
  const nextAfter = page.length === limit ? page[page.length - 1].articleId : null;
  log.info('articles.list.served', { traceId: ctx.traceId, source: reader.role, count: page.length });
  send(res, 200, { articles: page, nextAfter });
}

// GET /articles/:articleId: the editor detail view.
async function getArticle(res, ctx) {
  const article = await primary.articles.findOne({ articleId: ctx.articleId }, { timeoutMs: timeouts.primary });
  if (!article) {
    send(res, 404, { error: 'article not found' });
    return;
  }
  log.info('articles.detail.served', { traceId: ctx.traceId, source: primary.role, articleId: ctx.articleId });
  send(res, 200, article);
}

// PATCH /articles/:articleId/title: rename, then answer with the stored row
// the console renders as its confirmation card.
async function renameArticle(res, ctx) {
  let body;
  try {
    body = JSON.parse(ctx.raw || '{}');
  } catch (error) {
    send(res, 400, { error: 'body must be JSON' });
    return;
  }
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (title.length === 0 || title.length > MAX_TITLE_LENGTH) {
    send(res, 400, { error: 'title must be 1 to ' + MAX_TITLE_LENGTH + ' characters' });
    return;
  }
  const written = await primary.articles.updateTitle(
    { articleId: ctx.articleId, title, updatedAt: new Date().toISOString() },
    { timeoutMs: timeouts.primary }
  );
  if (written.rowCount === 0) {
    send(res, 404, { error: 'article not found' });
    return;
  }
  const stored = await reader.articles.findOne({ articleId: ctx.articleId }, { timeoutMs: timeouts.reader });
  if (!stored) {
    send(res, 503, { error: 'confirmation view unavailable' }, { 'Retry-After': '5' });
    return;
  }
  log.info('articles.renamed', { traceId: ctx.traceId, articleId: ctx.articleId, revision: stored.revision });
  send(res, 200, {
    articleId: stored.articleId,
    title: stored.title,
    revision: stored.revision,
    updatedAt: stored.updatedAt
  });
}

module.exports = { listArticles, getArticle, renameArticle };
