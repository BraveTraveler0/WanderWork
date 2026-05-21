const User = require("../models/User");

function runAt10AM() {
  const now = new Date();
  const target = new Date();
  target.setHours(10, 0, 0, 0); // Set the target time to 10:00 AM

  if (now >= target) {
    target.setDate(target.getDate() + 1); // If it's already past 10:00 AM, set the target to tomorrow
  }

  const delay = target.getTime() - now.getTime(); // Calculate the delay in milliseconds

  setTimeout(() => {
    User.updateMany({}, { $inc: { stars: 2 } }, (err, result) => {
      if (err) {
        console.error(err);
      } else {
        console.log(`Updated users with new code`);
      }
    });
    setInterval(runAt10AM, 24 * 60 * 60 * 1000); // Call the function again every 24 hours
  }, delay);
}

module.exports = runAt10AM;