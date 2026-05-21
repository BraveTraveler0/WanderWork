/*const { initializePostScheduler } = require('./postScheduler');
const { initializeZenPostScheduler } = require('./zenPostScheduler');
const { initializeBravePostScheduler } = require('./bravePostScheduler');
const { initializeConceptArtPostScheduler } = require('./conceptartPostScheduler');
const { initializeComicsPostScheduler } = require('./comicsPostScheduler');
const { initializeScifiPostScheduler } = require ('./scifiPostScheduler');
const { initializeFilmPostScheduler } = require ('./filmPostScheduler');
const { initializeFashionPostScheduler } = require ('./fashionPostScheduler');
const { initializeMangaPostScheduler } = require ('./mangaPostScheduler');
const { initializeTravelPostScheduler } = require ('./travelPostScheduler');
const { initializeClassicalPostScheduler } = require ('./classicalPostScheduler');
const { initializeAiPostScheduler } = require ('./aiPostScheduler');*/
const { initializeCreativeMixerScheduler } = require ('./creativeMixerConfig');

function initializeBots() {
  console.log('Initializing bot accounts...');

  // Initialize the post scheduler
  /*initializePostScheduler();
  initializeZenPostScheduler();
  initializeBravePostScheduler();
  initializeConceptArtPostScheduler();
  initializeComicsPostScheduler();
  initializeScifiPostScheduler();
  initializeFilmPostScheduler();
  initializeFashionPostScheduler();
  initializeMangaPostScheduler();
  initializeTravelPostScheduler();
  initializeClassicalPostScheduler();
  initializeAiPostScheduler();*/
  initializeCreativeMixerScheduler();

  // If you add more bot features in the future, initialize them here
  // For example:
  // initializeCommentBot();
  // initializeMessageBot();

  console.log('Bot accounts initialized successfully.');
}

function shutdownBots() {
  console.log('Shutting down bot accounts...');
  // Perform any necessary cleanup or shutdown procedures
  // This could include stopping schedulers, closing connections, etc.
  console.log('Bot accounts shut down successfully.');
}



module.exports = {
  initializeBots,
  shutdownBots
};