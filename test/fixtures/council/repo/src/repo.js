function scoped(query, tenant) {
  return { ...query, tenant };
}

module.exports = { scoped };
