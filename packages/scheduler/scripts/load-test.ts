/**
 * Load Test Script for Scheduler Service
 *
 * Tests scheduler performance under load by simulating:
 * - Multiple campaigns
 * - Multiple job types
 * - High job submission rate
 * - Monitoring queue metrics
 *
 * Usage:
 *   ts-node scripts/load-test.ts [numJobs] [numCampaigns]
 *
 * Example:
 *   ts-node scripts/load-test.ts 1000 10
 */

import axios from 'axios';
import Bull from 'bull';

// Configuration
const SCHEDULER_URL = process.env.SCHEDULER_URL || 'http://localhost:9266';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const NUM_JOBS = parseInt(process.argv[2] || '100', 10);
const NUM_CAMPAIGNS = parseInt(process.argv[3] || '5', 10);

// Job types to test
enum JobType {
  DEFERRED_EFFECT = 'DEFERRED_EFFECT',
  SETTLEMENT_GROWTH = 'SETTLEMENT_GROWTH',
  STRUCTURE_MAINTENANCE = 'STRUCTURE_MAINTENANCE',
  EVENT_EXPIRATION = 'EVENT_EXPIRATION',
}

// Job priorities
enum JobPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 8,
  CRITICAL = 10,
}

/**
 * Generate random campaign ID
 */
function getRandomCampaignId(): string {
  const index = Math.floor(Math.random() * NUM_CAMPAIGNS);
  return `campaign-${index + 1}`;
}

/**
 * Generate random job type
 */
function getRandomJobType(): JobType {
  const types = Object.values(JobType);
  return types[Math.floor(Math.random() * types.length)];
}

/**
 * Generate random job priority
 */
function getRandomPriority(): JobPriority {
  const priorities = Object.values(JobPriority).filter(
    (v) => typeof v === 'number'
  ) as JobPriority[];
  return priorities[Math.floor(Math.random() * priorities.length)];
}

/**
 * Generate job data based on type
 */
function generateJobData(type: JobType, campaignId: string) {
  const baseData = {
    type,
    campaignId,
    priority: getRandomPriority(),
  };

  switch (type) {
    case JobType.DEFERRED_EFFECT:
      return {
        ...baseData,
        effectId: `effect-${Math.floor(Math.random() * 100)}`,
        executeAt: new Date(Date.now() + Math.random() * 60000).toISOString(),
      };
    case JobType.SETTLEMENT_GROWTH:
    case JobType.STRUCTURE_MAINTENANCE:
    case JobType.EVENT_EXPIRATION:
      return baseData;
    default:
      return baseData;
  }
}

/**
 * Add a single job to the queue
 */
async function addJob(queue: Bull.Queue, jobData: any): Promise<void> {
  await queue.add(jobData, {
    priority: 11 - jobData.priority, // Invert priority for Bull
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });
}

/**
 * Get queue metrics from scheduler
 */
async function getMetrics() {
  try {
    const response = await axios.get(`${SCHEDULER_URL}/metrics`);
    return response.data;
  } catch (error) {
    console.error(
      'Failed to fetch metrics:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

/**
 * Run load test
 */
async function runLoadTest() {
  console.log('='.repeat(60));
  console.log('Scheduler Service Load Test');
  console.log('='.repeat(60));
  console.log(`Scheduler URL: ${SCHEDULER_URL}`);
  console.log(`Redis URL: ${REDIS_URL}`);
  console.log(`Number of jobs: ${NUM_JOBS}`);
  console.log(`Number of campaigns: ${NUM_CAMPAIGNS}`);
  console.log('='.repeat(60));
  console.log('');

  // Connect to Redis queue directly
  const queue = new Bull('scheduler-queue', REDIS_URL);

  try {
    // Get initial metrics
    console.log('Fetching initial metrics...');
    const initialMetrics = await getMetrics();
    if (initialMetrics) {
      console.log('Initial metrics:', JSON.stringify(initialMetrics, null, 2));
    }
    console.log('');

    // Generate and submit jobs
    console.log(`Submitting ${NUM_JOBS} jobs...`);
    const startTime = Date.now();
    const jobPromises: Promise<void>[] = [];

    for (let i = 0; i < NUM_JOBS; i++) {
      const campaignId = getRandomCampaignId();
      const jobType = getRandomJobType();
      const jobData = generateJobData(jobType, campaignId);

      jobPromises.push(addJob(queue, jobData));

      // Progress indicator every 100 jobs
      if ((i + 1) % 100 === 0) {
        console.log(`  Progress: ${i + 1}/${NUM_JOBS} jobs submitted`);
      }
    }

    // Wait for all jobs to be queued
    await Promise.all(jobPromises);
    const submissionTime = Date.now() - startTime;

    console.log('');
    console.log(`✓ All ${NUM_JOBS} jobs submitted in ${submissionTime}ms`);
    console.log(`  Submission rate: ${(NUM_JOBS / (submissionTime / 1000)).toFixed(2)} jobs/sec`);
    console.log('');

    // Monitor queue progress
    console.log('Monitoring queue progress (checking every 2 seconds)...');
    console.log('Press Ctrl+C to stop monitoring');
    console.log('');

    const processingStartTime = Date.now();
    const lastCompletedCount = initialMetrics?.completed || 0;

    const monitorInterval = setInterval(async () => {
      const metrics = await getMetrics();
      if (!metrics) {
        return;
      }

      const { active, waiting, completed, failed, delayed } = metrics;
      const totalProcessed = completed - lastCompletedCount;
      const elapsedSeconds = (Date.now() - processingStartTime) / 1000;
      const processingRate = totalProcessed / elapsedSeconds;

      console.log(
        `[${new Date().toISOString()}] ` +
          `Active: ${active}, ` +
          `Waiting: ${waiting}, ` +
          `Completed: ${totalProcessed} (+${completed - (initialMetrics?.completed || 0)}), ` +
          `Failed: ${failed}, ` +
          `Delayed: ${delayed} | ` +
          `Rate: ${processingRate.toFixed(2)} jobs/sec`
      );

      // Stop monitoring when all jobs are done
      if (active === 0 && waiting === 0 && delayed === 0 && totalProcessed >= NUM_JOBS) {
        clearInterval(monitorInterval);
        console.log('');
        console.log('='.repeat(60));
        console.log('Load Test Complete');
        console.log('='.repeat(60));
        console.log(`Total jobs submitted: ${NUM_JOBS}`);
        console.log(`Total jobs completed: ${totalProcessed}`);
        console.log(`Total jobs failed: ${failed}`);
        console.log(`Total processing time: ${elapsedSeconds.toFixed(2)}s`);
        console.log(`Average processing rate: ${processingRate.toFixed(2)} jobs/sec`);
        console.log(
          `Average job latency: ${((elapsedSeconds / totalProcessed) * 1000).toFixed(2)}ms`
        );
        console.log('='.repeat(60));

        await queue.close();
        process.exit(0);
      }
    }, 2000);

    // Handle Ctrl+C
    process.on('SIGINT', async () => {
      console.log('');
      console.log('Stopping monitor...');
      clearInterval(monitorInterval);
      await queue.close();
      process.exit(0);
    });
  } catch (error) {
    console.error('Load test failed:', error);
    await queue.close();
    process.exit(1);
  }
}

// Run the load test
runLoadTest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
