'use strict';

// Every call that leaves this process goes through here, so nothing can wait on
// a dependency without a cutoff.
function withTimeout(work, ms, label) {
  let timer = null;
  const deadline = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(label + ' exceeded ' + ms + ' ms')), ms);
  });
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

module.exports = { withTimeout };
