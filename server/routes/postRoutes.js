const express = require('express')
const router = express.Router()
const postsController = require('../controllers/postsController')
const multer = require('multer');
const upload = multer(); // Create a Multer instance

router.route('/')
  .get(postsController.getAllPost)
  .post(postsController.createNewPost)

//router.route('/myexplorefeed')
 // .post(postsController.getMyExploreFeed)

router.route('/stream/:slug')
  .get(postsController.getStreamPost)

router.route('/comment')
  .patch(postsController.updateCommentCount)

router.route('/tags')
  .get(postsController.getAllTags)

router.route('/paging')
  .get(postsController.getPostsByPage);

router.route('/ranked')
  .get(postsController.getRankedPostsByPage);

router.route('/like').patch(postsController.likePost)
router.route('/unlike').patch(postsController.unlikePost)

router.route('/stars').patch(postsController.updateStars)
router.route('/:id').delete(postsController.deletePost)



router.route('/modal/:id').get(postsController.getSinglePost)

router.route('/remix')
.post(upload.single('image'), postsController.remixPost)
.get((req, res) => {
    // Implement GET handler if needed
    res.status(405).send('Method Not Allowed');
});

module.exports = router