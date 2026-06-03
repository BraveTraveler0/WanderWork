const passport = require('passport');
const { safePublicUrl, getPublicServerUrl } = require('../utils/publicUrls');

const consumerKey = process.env.TWITTER_CONSUMER_KEY;
const consumerSecret = process.env.TWITTER_CONSUMER_SECRET;
const twitterCallbackUrl = safePublicUrl(
  process.env.TWITTER_CALLBACK_URL,
  `${getPublicServerUrl()}/auth/twitter/callback`
);

if (consumerKey && consumerKey !== 'dummy' && consumerSecret && consumerSecret !== 'dummy') {
  const TwitterStrategy = require('passport-twitter').Strategy;
  passport.use(new TwitterStrategy({
    consumerKey,
    consumerSecret,
    callbackURL: twitterCallbackUrl,
  }, (token, tokenSecret, profile, done) => {
    done(null, profile);
  }));
}

module.exports = twitterRoutes = (app) => {
  app.get('/auth/twitter', (req, res) => res.status(503).json({ message: 'Twitter auth not configured' }));
  app.get('/auth/twitter/callback', (req, res) => res.redirect('/'));
};
