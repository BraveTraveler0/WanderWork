const Comments = require('../models/comments.js')
const Posts = require('../models/posts.js')
const User = require('../models/User.js')
const asyncHandler = require('express-async-handler')
const mongoose = require('mongoose')
const { createNotification } = require('./notificationsController.js');

// @desc Get all comments
// @route GET /userprofile
// @access Private, app populates list of comments
const getCommentsByPostId = asyncHandler(async (req, res) => {
    const { post } = req.query; // Extracting the 'post' query parameter
    // Get comments with the matching postId from MongoDB
    const comments = await Comments.find({ post }).sort({createdAt: -1}).lean();
  
    res.json(comments);
  });

// @desc Create new comment
// @route POST /userprofile
// @access Private, only current user
const createNewComment = asyncHandler(async (req, res) => {
  const { userId, displayName, profimage, content, postId } = req.body;

  // Confirm data
  if (!content || !postId || !displayName || !profimage || !userId) {
      return res.status(400).json({ message: 'All fields are required' });
  }

  try {

      // Create the comment object
      const newComment = {
          user: { userId, displayName, profimage },
          content
      };

      // Find the post and push the new comment into the comments array
      const post = await Posts.findById(postId);
      if (!post) {
          return res.status(404).json({ message: 'Post not found' });
      }

      post.comments.push(newComment);

      // Save the updated post
      await post.save();

      if (userId && post) {
        console.log(userId, post)
        // Call createNotification with the correct parameters
        await createNotification({
            senderSlug: userId,
            recipSlug: post.slug,
            action: 'Commented on your post',
            post: post
        }, res);
      }

      res.status(201).json({ message: 'Comment created successfully', comment: newComment });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error creating comment' });
  }
});

const createNewReply = asyncHandler(async (req, res) => {
  const { userId, displayName, profimage, content, postId, commentId } = req.body;

  // Confirm data
  if (!content || !postId || !displayName || !profimage || !userId || !commentId) {
      return res.status(400).json({ message: 'All fields are required' });
  }

  try {

      // Create the comment object
      const newReply = {
          user: { userId, displayName, profimage },
          content
      };

      // Find the post by postId
      const post = await Posts.findById(postId);
      if (!post) {
          return res.status(404).json({ message: 'Post not found' });
      }

      // Find the comment within the post's comments array by commentId
      const comment = post.comments.find(comment => comment._id.equals(commentId));
      if (!comment) {
          return res.status(404).json({ message: 'Comment not found' });
      }

      // Push the new reply into the replies array of the comment
      comment.replies.push(newReply);

      // Save the updated post
      await post.save();

      if (userId && post) {
        // Call createNotification with the correct parameters
        await createNotification({
            senderSlug: userId,
            recipSlug: post.slug,
            action: 'Replied to you',
            post: post
        }, res);
      }

      res.status(201).json({ message: 'Comment created successfully', comment: newReply });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error creating comment' });
  }
});

const upVote = asyncHandler(async (req, res) => {
  const { id, commentId, voteUser } = req.body;

  // Confirm data
  if (!id || !commentId || !voteUser) {
    return res.status(400).json({ message: 'Post id, comment id, and vote user are required' });
  }

  try {
    // Find the post
    const post = await Posts.findById(id).exec();
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Convert commentId to an ObjectId
    const commentObjectId = mongoose.Types.ObjectId(commentId);

    // Find the comment within the post's main comments array
    let comment = post.comments.find(comment => comment._id.equals(commentObjectId));

    // If comment is not found in the main comments array, try searching in replies
    if (!comment) {
      for (const parentComment of post.comments) {
        comment = parentComment.replies.find(reply => reply._id.equals(commentObjectId));
        if (comment) break; // Break loop if comment is found in replies
      }
    }

    // If comment is still not found, return 404
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if voteUser exists in votedUsers array
    if (!comment.voteUpUsers.includes(voteUser)) {
      // If voteUser does not exist, increment commentRank by 1 and add voteUser to votedUsers array
      comment.commentRank += 1;
      comment.voteUpUsers.push(voteUser);
    } else if (comment.voteUpUsers.includes(voteUser)) {
      comment.commentRank -= 1;
      comment.voteUpUsers = comment.voteUpUsers.filter(user => user !== voteUser);
    } else {
      // If voteUser already exists, return the statement "this user has already voted"
      return res.status(400).json({ message: 'This user has already voted' });
    }

    // Save the updated post
    await post.save();

    res.json({ message: `Comment rank updated for comment with id ${commentId}` });
  } catch (error) {
    console.error('Error upvoting comment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

const downVote = asyncHandler(async (req, res) => {
  const { id, commentId, voteUser } = req.body;

  // Confirm data
  if (!id || !commentId || !voteUser) {
    return res.status(400).json({ message: 'Post id, comment id, and vote user are required' });
  }

  try {
    // Find the post
    const post = await Posts.findById(id).exec();
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Convert commentId to an ObjectId
    const commentObjectId = mongoose.Types.ObjectId(commentId);

    // Find the comment within the post's main comments array
    let comment = post.comments.find(comment => comment._id.equals(commentObjectId));

    // If comment is not found in the main comments array, try searching in replies
    if (!comment) {
      for (const parentComment of post.comments) {
        comment = parentComment.replies.find(reply => reply._id.equals(commentObjectId));
        if (comment) break; // Break loop if comment is found in replies
      }
    }

    // If comment is still not found, return 404
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if voteUser exists in votedUsers array
    if (!comment.voteDownUsers.includes(voteUser)) {
      // If voteUser does not exist, decrement commentRank by 1 and add voteUser to votedUsers array
      comment.commentRank -= 1;
      comment.voteDownUsers.push(voteUser);
    } else if (comment.voteDownUsers.includes(voteUser)) {
      comment.commentRank += 1;
      comment.voteDownUsers = comment.voteDownUsers.filter(user => user !== voteUser);
    } else {
      // If voteUser already exists, return the statement "this user has already voted"
      return res.status(400).json({ message: 'This user has already voted' });
    }

    // Save the updated post
    await post.save();

    res.json({ message: `Comment rank updated for comment with id ${commentId}` });
  } catch (error) {
    console.error('Error downvoting comment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

const updateCommentStars = asyncHandler(async (req, res) => {
  const { postId, id, starDonator, stars, slug } = req.body

  // Confirm data 
  if (!id || !postId) {
    return res.status(400).json({ message: 'Post id and user are required' })
  }

  // Does the post exist to update?
  const post = await Posts.findById(postId).exec()
  console.log(post)

  if (!post) {
    return res.status(400).json({ message: 'Post not found' })
  }

  // Find the comment with the matching ID in the comments array
  const comment = post.comments.find(comment => comment._id.toString() === id);
  console.log(comment)

  if (!comment) {
    return res.status(400).json({ message: 'Comment not found' });
  }

  if (stars && starDonator) {
    comment.stars += stars;
    console.log(comment.stars)

    // Initialize comment.starDonator if it doesn't exist
    if (!comment.commentStarDonator) {
        comment.commentStarDonator = [];
    }

    // Add starDonator to comment.starDonator if it's not already included
    if (!comment.commentStarDonator.includes(starDonator)) {
        comment.commentStarDonator.push(starDonator);
    }
}

  // Find the user in the database and subtract their "stars" by 1
  const userToUpdate = await User.findOne({ $or: [{ _id: starDonator }, { slug: starDonator }] }).exec();
  if (userToUpdate) {
    userToUpdate.stars = Math.max(0, (userToUpdate.stars || 0) - 1);
    await userToUpdate.save();
  }

  // Convert slug to ObjectId
  let userToGiveStarId;
  if (mongoose.Types.ObjectId.isValid(slug)) {
    userToGiveStarId = mongoose.Types.ObjectId(slug);
  }

  // Find the user in the database and add their "stars" by 1
  const userToGiveStar = await User.findOne({ _id: userToGiveStarId }).exec();
  if (userToGiveStar) {
    userToGiveStar.stars = (userToGiveStar.stars || 0) + 1; // Increment stars by 1
    await userToGiveStar.save();
  }

  const updatedPost = await post.save()

  if (userToUpdate && userToGiveStar && post) {
    // Call createNotification with the correct parameters
    await createNotification({
        senderSlug: userToUpdate._id,
        recipSlug: userToGiveStar._id,
        action: 'Gave you stars',
        post: post
    }, res);
  }

  res.json({ message: `${updatedPost.user}'s post updated` })
})

// @desc Update a comment
// @route PATCH /userprofile
// @access Private, only user who created & admin
const updateComment = asyncHandler(async (req, res) => {
    const { id, user, text, image, likes  } = req.body

    // Confirm data 
    if (!id || !user) {
        return res.status(400).json({ message: 'Comment id and user are required' })
    }

    // Does the comment exist to update?
    const comment = await Comments.findById(id).exec()

    if (!comment) {
        return res.status(400).json({ message: 'Comment not found' })
    }

    comment.text = text
    comment.image = image
    comment.likes = likes

    const updatedComment = await comment.save()

    res.json({ message: `${updatedComment.user}'s comment updated` })
})

// @desc Delete a comment
// @route DELETE /userprofile
// @access Private, only user who created & admin
const deleteComment = asyncHandler(async (req, res) => {
    const { id } = req.body

    // Confirm data
    if (!id) {
        return res.status(400).json({ message: 'Comment ID Required' })
    }

    // Does the comment exist to delete?
    const comment = await Comments.findById(id).exec()

    if (!comment) {
        return res.status(400).json({ message: 'Comment not found' })
    }

    const result = await comment.deleteOne()

    const reply = `Comment by ${result.user} with ID ${result.text} deleted`

    res.json(reply)
})

module.exports = {
    getCommentsByPostId,
    createNewComment,
    upVote,
    downVote,
    createNewReply,
    updateComment,
    updateCommentStars,
    deleteComment
}