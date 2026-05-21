const express = require('express')
const router = express.Router()
const commentsController = require('../controllers/commentsController')

router.route('/')
    .get(commentsController.getCommentsByPostId)
    .post(commentsController.createNewComment)
    .patch(commentsController.updateComment)
    .delete(commentsController.deleteComment)

router.route('/reply')
    .post(commentsController.createNewReply)

router.route('/upvote')
    .post(commentsController.upVote)

router.route('/downvote')
    .post(commentsController.downVote)

router.route('/stars')
    .patch(commentsController.updateCommentStars)

module.exports = router