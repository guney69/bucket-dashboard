'use strict';

require('dotenv').config();
const axios = require('axios');
const { getBrazeEndingAt } = require('./utils/date');

// $Purchase는 커스텀 이벤트가 아니라 purchases API로 별도 조회
const CUSTOM_EVENTS = [
  'YS_product_order_completed',
  'YS_add_to_cart',
  'YS_event_page_view',
  'YS_product_detail_view',
  'YS_search_completed',
  'YS_review_like_completed',
];

function getBrazeClient() {
  const apiKey = process.env.BRAZE_API_KEY;
  const endpoint = process.env.BRAZE_API_ENDPOINT;
  if (!apiKey || !endpoint) {
    throw new Error('BRAZE_API_KEY와 BRAZE_API_ENDPOINT가 .env에 설정되어야 합니다');
  }
  return axios.create({
    baseURL: endpoint,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
}

async function getSegmentSize(client, segmentId, endingAt) {
  const res = await client.get('/segments/data_series', {
    params: { segment_id: segmentId, length: 1, ending_at: endingAt },
  });
  const data = res.data && res.data.data;
  if (Array.isArray(data) && data.length > 0) {
    return data[0].size != null ? data[0].size : null;
  }
  return null;
}

async function getKpiMetric(client, metric, endingAt) {
  const res = await client.get(`/kpi/${metric}/data_series`, {
    params: { length: 1, ending_at: endingAt },
  });
  const data = res.data && res.data.data;
  if (Array.isArray(data) && data.length > 0) {
    const row = data[0];
    return row[metric] != null ? row[metric] : null;
  }
  return null;
}

// revenue: GET /purchases/revenue_series → data[0].revenue
async function getRevenue(client, endingAt) {
  const res = await client.get('/purchases/revenue_series', {
    params: { length: 1, ending_at: endingAt },
  });
  const data = res.data && res.data.data;
  if (Array.isArray(data) && data.length > 0) {
    return data[0].revenue != null ? data[0].revenue : null;
  }
  return null;
}

// purchase_cnt: GET /purchases/quantity_series → data[0].purchase_quantity
async function getPurchaseQuantity(client, endingAt) {
  const res = await client.get('/purchases/quantity_series', {
    params: { length: 1, ending_at: endingAt },
  });
  const data = res.data && res.data.data;
  if (Array.isArray(data) && data.length > 0) {
    return data[0].purchase_quantity != null ? data[0].purchase_quantity : null;
  }
  return null;
}

async function getEventCount(client, eventName, endingAt) {
  const res = await client.get('/events/data_series', {
    params: { event: eventName, unit: 'day', length: 1, ending_at: endingAt },
  });
  const data = res.data && res.data.data;
  if (Array.isArray(data) && data.length > 0) {
    return data[0].count != null ? data[0].count : null;
  }
  return null;
}

async function collectBrazeKpi(todayKST) {
  const client = getBrazeClient();
  const endingAt = getBrazeEndingAt();

  const pushSegmentId = process.env.SEGMENT_ID_PUSH;
  const smsSegmentId = process.env.SEGMENT_ID_SMS;
  const kakaoSegmentId = process.env.SEGMENT_ID_KAKAO;

  if (!pushSegmentId || !smsSegmentId || !kakaoSegmentId) {
    throw new Error('SEGMENT_ID_PUSH, SEGMENT_ID_SMS, SEGMENT_ID_KAKAO가 .env에 설정되어야 합니다');
  }

  console.log(`[braze] KPI 수집 기준: ${todayKST} (ending_at=${endingAt})`);

  const safeCall = (promise, label) =>
    promise.catch(e => {
      const detail = e.response ? JSON.stringify(e.response.data) : '';
      console.warn(`[braze] ${label} 실패: ${e.message}${detail ? ' | ' + detail : ''}`);
      return null;
    });

  const [
    pushSize, smsSize, kakaoSize,
    dau, mau,
    revenue, purchaseCnt,
    ...eventCounts
  ] = await Promise.all([
    safeCall(getSegmentSize(client, pushSegmentId, endingAt), 'push segment'),
    safeCall(getSegmentSize(client, smsSegmentId, endingAt), 'sms segment'),
    safeCall(getSegmentSize(client, kakaoSegmentId, endingAt), 'kakao segment'),
    safeCall(getKpiMetric(client, 'dau', endingAt), 'dau'),
    safeCall(getKpiMetric(client, 'mau', endingAt), 'mau'),
    safeCall(getRevenue(client, endingAt), 'revenue'),             // /purchases/revenue_series
    safeCall(getPurchaseQuantity(client, endingAt), 'purchase_cnt'), // /purchases/quantity_series
    ...CUSTOM_EVENTS.map(ev => safeCall(getEventCount(client, ev, endingAt), `event:${ev}`)),
  ]);

  return {
    date: todayKST,
    doseo_masudong: pushSize,      // 도서 마수동 유저
    ebook_masudong: smsSize,       // 이북 마수동 유저
    salak_masudong: kakaoSize,     // 사락 마수동 유저
    dau,
    mau,
    revenue,
    purchase_cnt: purchaseCnt,
    YS_product_order_completed: eventCounts[0],
    YS_add_to_cart: eventCounts[1],
    YS_event_page_view: eventCounts[2],
    YS_product_detail_view: eventCounts[3],
    YS_search_completed: eventCounts[4],
    YS_review_like_completed: eventCounts[5],
  };
}

module.exports = { collectBrazeKpi };
