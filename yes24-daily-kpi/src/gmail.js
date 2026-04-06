'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const axios = require('axios');
const { getTodayKST, getYesterdayKST, getDateStamp } = require('./utils/date');

const DATA_DIR = path.resolve(__dirname, '../data/tmp');

function getOAuth2Client() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Gmail OAuth2 자격증명 누락. npm run auth-gmail 실행 후 GMAIL_REFRESH_TOKEN을 .env에 추가하세요.\n' +
      '필요: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN'
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob');
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

function decodeBase64Url(encoded) {
  // Gmail API uses base64url encoding (- -> +, _ -> /)
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function extractHtmlBody(payload) {
  function walk(part) {
    if (part.mimeType === 'text/html' && part.body && part.body.data) {
      return decodeBase64Url(part.body.data);
    }
    if (part.parts) {
      for (const child of part.parts) {
        const result = walk(child);
        if (result) return result;
      }
    }
    return null;
  }
  return walk(payload) || '';
}

function extractDownloadLinks(html) {
  // Strategy 1: href before link text
  const campaignMatch = html.match(/href="([^"]+)"[^>]*>[^<]*Download Campaign CSV[^<]*<\/a>/i);
  const canvasMatch = html.match(/href="([^"]+)"[^>]*>[^<]*Download Canvas CSV[^<]*<\/a>/i);

  let campaignUrl = campaignMatch ? campaignMatch[1] : null;
  let canvasUrl = canvasMatch ? canvasMatch[1] : null;

  // Strategy 2: link text before href (some email clients reverse attribute order)
  if (!campaignUrl) {
    const m = html.match(/Download Campaign CSV[\s\S]{0,200}?href="(https?:\/\/[^"]+)"/i);
    if (m) campaignUrl = m[1];
  }
  if (!canvasUrl) {
    const m = html.match(/Download Canvas CSV[\s\S]{0,200}?href="(https?:\/\/[^"]+)"/i);
    if (m) canvasUrl = m[1];
  }

  // Strategy 3: URL keyword fallback
  if (!campaignUrl || !canvasUrl) {
    const allLinks = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
    if (!campaignUrl) {
      campaignUrl = allLinks.find(l => /campaign/i.test(l) && /csv/i.test(l)) || null;
    }
    if (!canvasUrl) {
      canvasUrl = allLinks.find(l => /canvas/i.test(l) && /csv/i.test(l)) || null;
    }
  }

  return { campaignUrl, canvasUrl };
}

async function downloadCsv(url, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const response = await axios.get(url, {
    responseType: 'stream',
    timeout: 60000,
    headers: { 'User-Agent': 'bucketstore-daily-kpi/1.0' },
  });
  const writer = fs.createWriteStream(destPath);
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function downloadEngagementCsvs() {
  const todayKST = getTodayKST();
  const dateStamp = getDateStamp();

  const auth = getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth });

  // after: 필터에 어제 KST 날짜를 사용하는 이유:
  // Braze 메일이 KST 자정 직후(= UTC 전날 오후)에 도착하는 경우,
  // 파이프라인이 11:00 KST(= 02:00 UTC)에 실행될 때
  // after:오늘KST 로 검색하면 UTC 기준 전날로 찍힌 메일이 누락됨.
  // after:어제KST 로 검색하면 어제~오늘 UTC 범위를 모두 포함, 최신순 정렬 후 첫 번째 메일 사용.
  const yesterdayKST = getYesterdayKST();
  const query = [
    'from:no-reply@alerts.braze.com',
    'subject:"Engagement Report Complete for martinee_reports_v1"',
    `after:${yesterdayKST}`,
  ].join(' ');

  console.log(`[gmail] 검색 쿼리: ${query} (오늘 KST: ${todayKST})`);
  console.log(`[gmail] after 기준: ${yesterdayKST} (어제 KST) — KST 자정 직후 UTC 전날 도착 메일 포함`);

  const searchResponse = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 5,
  });

  const messages = searchResponse.data.messages;
  if (!messages || messages.length === 0) {
    throw new Error(
      `오늘(${todayKST}) Braze Engagement Report 메일을 찾지 못했습니다.\n검색 쿼리: ${query}`
    );
  }

  const messageId = messages[0].id;
  console.log(`[gmail] 메일 ID: ${messageId} (${messages.length}건 중 최신)`);

  const msgResponse = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const payload = msgResponse.data.payload;
  if (!payload) {
    throw new Error(`Gmail 메시지 ${messageId} payload 없음`);
  }

  const html = extractHtmlBody(payload);
  if (!html) {
    throw new Error(`Gmail 메시지 ${messageId}에서 HTML 본문을 추출하지 못했습니다`);
  }

  const { campaignUrl, canvasUrl } = extractDownloadLinks(html);

  if (!campaignUrl) {
    throw new Error(`메일 ${messageId}에서 [Download Campaign CSV] 링크를 찾지 못했습니다`);
  }
  if (!canvasUrl) {
    throw new Error(`메일 ${messageId}에서 [Download Canvas CSV] 링크를 찾지 못했습니다`);
  }

  const campaignCsvPath = path.join(DATA_DIR, `campaign_${dateStamp}.csv`);
  const canvasCsvPath = path.join(DATA_DIR, `canvas_${dateStamp}.csv`);

  console.log(`[gmail] Campaign CSV 다운로드 -> ${campaignCsvPath}`);
  await downloadCsv(campaignUrl, campaignCsvPath);

  console.log(`[gmail] Canvas CSV 다운로드 -> ${canvasCsvPath}`);
  await downloadCsv(canvasUrl, canvasCsvPath);

  return { campaignCsvPath, canvasCsvPath };
}

module.exports = { downloadEngagementCsvs };
