'use strict';

function getBoard(db, id) {
  return db.boards.findOne({ id });
}

module.exports = { getBoard };
