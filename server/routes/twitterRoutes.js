const passport = require('passport');

const consumerKey = process.env.TWITTER_CONSUMER_KEY;
const consumerSecret = process.env.TWITTER_CONSUMER_SECRET;

if (consumerKey && consumerKey !== 'dummy' && consumerSecret && consumerSecret !== 'dummy') {
  const TwitterStrategy = require('passport-twitter').Strategy;
  passport.use(new TwitterStrategy({
    consumerKey,
    consumerSecret,
    callbackURL: (process.env.SERVER_URL || process.env.TWITTER_CALLBACK_URL || 'http://localhost:8000/auth/twitter/callback'),
  }, (token, tokenSecret, profile, done) => {
    done(null, profile);
  }));
}

module.exports = twitterRoutes = (app) => {
  app.get('/auth/twitter', (req, res) => res.status(503).json({ message: 'Twitter auth not configured' }));
  app.get('/auth/twitter/callback', (req, res) => res.redirect('/'));
};
