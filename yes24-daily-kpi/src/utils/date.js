'use strict';

require('dotenv').config();

// Returns 'YYYY-MM-DD' in Asia/Seoul timezone
function getTodayKST() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.TIMEZONE || 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA locale produces YYYY-MM-DD format natively
  return formatter.format(now);
}

// Returns ISO8601 string for Braze ending_at parameter.
// Uses current time so the value is always in the past (Braze rejects future dates with 400).
// With length=1, Braze returns the most recent 1-day window ending now.
function getBrazeEndingAt() {
  return new Date().toISOString();
}

// Returns 'YYYY-MM-DD' of yesterday in Asia/Seoul timezone
// 사용 목적: Gmail after: 필터에 사용.
// Braze 메일이 KST 자정 직후(UTC 전날 오후)에 도착하므로,
// 오늘 KST 기준으로 after:어제 로 검색해야 해당 메일이 포함됨.
function getYesterdayKST() {
  const todayKST = getTodayKST(); // 'YYYY-MM-DD'
  const [y, m, d] = todayKST.split('-').map(Number);
  // KST 기준 어제 날짜 계산
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1));
  return yesterday.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

// Returns YYYYMMDD compact string for file naming
function getDateStamp() {
  return getTodayKST().replace(/-/g, '');
}

module.exports = { getTodayKST, getYesterdayKST, getBrazeEndingAt, getDateStamp };
