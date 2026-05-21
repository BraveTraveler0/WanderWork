const PostRank = require("../../models/postranks");
const Post = require("../../models/posts");

/*const getYesterday = () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  return yesterday;
};*/

const updateRankedPost = async (post, timeScale, idx) => {
  try {
    const actualTimeScale = timeScale === "daily" ? "today" : timeScale;
    let rankedPost = await PostRank.findOne({
      post: post._id,
      time_scale: actualTimeScale,
    });
    if (!rankedPost) {
      rankedPost = new PostRank({
        post: post._id,
        category: post.category,
        time_scale: actualTimeScale,
        point: post.point,
        slug: post.slug,
        PostTime: post.PostTime,
        rank: idx + 1,
      });
    } else {
      rankedPost.category = post.category;
      rankedPost.point = post.point;
      rankedPost.PostTime = post.PostTime;
      rankedPost.rank = idx + 1
    }
    await rankedPost.save();
  } catch (error) {
    console.error("Error creating/updating rankedpost:", error);
  }
};

const initRanking = async (timeScale) => {
  try {
    //const yesterday = getYesterday();
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    let filter = {};

    if (timeScale === "daily") {
      filter = {
        PostTime: {
          $gte: startOfToday,
          $lt: endOfToday
        }
      };
    } else if (timeScale === "weekly") {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay() + 1);
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() - today.getDay() + 7);
      endOfWeek.setHours(23, 59, 59); // Set the time to 11:59:59 PM for the end of the week
      filter = {
        PostTime: {
          $gte: startOfWeek,
          $lt: endOfWeek,
        },
      };
    } else if (timeScale === "monthly") {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
      filter = {
        PostTime: {
          $gte: startOfMonth,
          $lt: endOfMonth,
        },
      };
    } else if (timeScale === "yearly") {
      const today = new Date();
      const startOfYear = new Date(today.getFullYear(), 0, 1, 0, 0, 0);
      const endOfYear = new Date(today.getFullYear() + 1, 0, 0, 23, 59, 59);
      filter = {
        PostTime: {
          $gte: startOfYear,
          $lt: endOfYear,
        },
      };
    }
    const posts = await Post.find(filter);
    posts.sort((a, b) => b.point - a.point);
    if (posts && posts.length > 0) {
      posts.forEach((post, idx) => {
        updateRankedPost(post, timeScale, idx);
      });
    } else {
      console.log(`Not found any posts in time scale: ${timeScale}`);
    }
  } catch (error) {
    console.error("Error init daily rank:", error);
  }
};

module.exports = {
    initRanking
}
