// Periodic job to generate snapshots and bonus instances
const cron = require('node-cron');
const { generateBonusesForPeriod } = require('../services/bonusgeneration');
const logger = require('../utils/log');

/**
 * Initialize cron jobs for periodic bonus generation
 */
function initializeCronJobs() {
  // Daily check - handles all periodic bonuses (end-of-period gating is in the service)
  cron.schedule('0 0 * * *', async () => { // Runs at 12:00 AM daily
    try {
      logger.info('Running periodic bonus generation check');
      const result = await generateBonusesForPeriod();
      logger.info(`Periodic bonus generation completed: ${result.instancesCreated} instances created with ${result.allocationsGenerated} allocations`);
    } catch (error) {
      logger.error('Error in periodic bonus generation:', error);
    }
  });

  logger.info('Bonus generation cron jobs initialized');
}

async function generateBonusForPeriodTEST(period) {
  try {
    logger.info('Running quarterly bonus generation check');
    await generateBonusesForPeriod(period);
    logger.info('Quarterly bonus generation completed');
  } catch (error) {
    logger.error('Error in quarterly bonus generation:', error);
  }
}

module.exports = {
  initializeCronJobs,
  generateBonusForPeriodTEST
};
