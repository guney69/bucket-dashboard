'use strict';

require('dotenv').config();
const axios = require('axios');

async function sendSlackAlert(message, error) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('[notify] SLACK_WEBHOOK_URL not set, cannot send alert');
    return;
  }

  let errorText = '';
  if (error instanceof Error) {
    errorText = '\n```' + error.message + '```';
  } else if (error) {
    errorText = '\n```' + String(error) + '```';
  }

  const body = {
    text: `:rotating_light: *[bucketstore-daily-kpi] FAILURE*\n${message}${errorText}`,
  };

  try {
    await axios.post(webhookUrl, body, { timeout: 10000 });
  } catch (slackError) {
    // Never throw from notifier — just log
    console.error('[notify] Failed to send Slack alert:', slackError.message);
  }
}

module.exports = { sendSlackAlert };
