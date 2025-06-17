// Periodic job to generate snapshots and bonus instances
const cron = require('node-cron');
const { generateBonusesForPeriod } = require('../services/bonusgeneration');
const logger = require('../utils/log');

/**
 * Initialize cron jobs for periodic bonus generation
 */
function initializeCronJobs() {
  // Daily check - will handle daily bonuses and check for other periods
  cron.schedule('0 2 * * *', async () => { // Runs at 2 AM daily
    try {
      logger.info('Running daily bonus generation check');
      const result = await generateBonusesForPeriod('daily');
      logger.info(`Daily bonus generation completed: ${result.instancesCreated} instances created with ${result.allocationsGenerated} allocations`);
    } catch (error) {
      logger.error('Error in daily bonus generation:', error);
    }
  });

  // Weekly check - Runs every Monday at 3 AM
  cron.schedule('0 3 * * 1', async () => {
    try {
      logger.info('Running weekly bonus generation check');
      await generateBonusesForPeriod('weekly');
      logger.info('Weekly bonus generation completed');
    } catch (error) {
      logger.error('Error in weekly bonus generation:', error);
    }
  });

  // Monthly check - Runs on the 1st of each month at 4 AM
  cron.schedule('0 4 1 * *', async () => {
    try {
      logger.info('Running monthly bonus generation check');
      await generateBonusesForPeriod('monthly');
      logger.info('Monthly bonus generation completed');
    } catch (error) {
      logger.error('Error in monthly bonus generation:', error);
    }
  });

  // Quarterly check - Runs on the 1st day of each quarter at 5 AM
  cron.schedule('0 5 1 1,4,7,10 *', async () => {
    try {
      logger.info('Running quarterly bonus generation check');
      await generateBonusesForPeriod('quarterly');
      logger.info('Quarterly bonus generation completed');
    } catch (error) {
      logger.error('Error in quarterly bonus generation:', error);
    }
  });

  // Yearly check - Runs on January 1st at 6 AM
  cron.schedule('0 6 1 1 *', async () => {
    try {
      logger.info('Running yearly bonus generation check');
      await generateBonusesForPeriod('yearly');
      logger.info('Yearly bonus generation completed');
    } catch (error) {
      logger.error('Error in yearly bonus generation:', error);
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
