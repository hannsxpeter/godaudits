'use strict';
// Every document read must go through this helper so the workspace predicate
// is never forgotten.
function scoped(query, user) {
  return { ...query, workspaceId: user.workspaceId };
}
module.exports = { scoped };
