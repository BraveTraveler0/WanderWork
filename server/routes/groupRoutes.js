const express = require('express');
const groupsController = require('../controllers/groupsController')

const router = express.Router();

router.route('/createGroup')
    .post(groupsController.createNewGroup)

router.get('/', groupsController.getAllGroups)

router.get('/:id', groupsController.getGroupById)

router.post('/search', groupsController.getGroupByQuery)

router.get('/posts/:category', groupsController.getGroupPosts)

module.exports = router;