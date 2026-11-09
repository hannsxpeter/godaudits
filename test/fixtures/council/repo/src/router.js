'use strict';

const router = require('express').Router();

router.use(authorize);
router.get('/boards/:id', loadBoard);

module.exports = router;
