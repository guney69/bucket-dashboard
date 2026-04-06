'use strict';

require('dotenv').config();

const { downloadEngagementCsvs } = require('./gmail');
const { collectBrazeKpi } = require('./braze');
const { loadCsvToSheet, loadKpiRow } = require('./sheets');
const { sendSlackAlert } = require('./notify');
const { getTodayKST } = require('./utils/date');

async function main() {
  const todayKST = getTodayKST();
  console.log(`\n=== bucketstore-daily-kpi | ${todayKST} ===\n`);

  // ────────────────────────────────────────────────
  // STEP 1: Gmail에서 Engagement Report CSV 다운로드
  // ────────────────────────────────────────────────
  console.log('[step 1] Gmail: Engagement Report CSV 다운로드 중...');
  let gmailResult;
  try {
    gmailResult = await downloadEngagementCsvs();
    console.log('[step 1] 완료:', gmailResult);
  } catch (err) {
    await sendSlackAlert('[Step 1] Gmail CSV 다운로드 실패', err);
    console.error('[step 1] FATAL:', err.message);
    process.exit(1);
  }

  // ────────────────────────────────────────────────
  // STEP 2: Braze REST API로 KPI 수집
  // ────────────────────────────────────────────────
  console.log('[step 2] Braze: KPI 지표 수집 중...');
  let kpiData;
  try {
    kpiData = await collectBrazeKpi(todayKST);
    console.log('[step 2] 완료:', kpiData);
  } catch (err) {
    await sendSlackAlert('[Step 2] Braze KPI 수집 실패', err);
    console.error('[step 2] FATAL:', err.message);
    process.exit(1);
  }

  // ────────────────────────────────────────────────
  // STEP 3: Google Sheets에 데이터 적재
  // ────────────────────────────────────────────────
  console.log('[step 3] Google Sheets: 데이터 적재 중...');
  try {
    await loadCsvToSheet(gmailResult.campaignCsvPath, 'engagement_campaign');
    await loadCsvToSheet(gmailResult.canvasCsvPath, 'engagement_canvas');
    await loadKpiRow(kpiData);
    console.log('[step 3] 완료. 모든 데이터 적재 성공.');
  } catch (err) {
    await sendSlackAlert('[Step 3] Google Sheets 적재 실패', err);
    console.error('[step 3] FATAL:', err.message);
    process.exit(1);
  }

  console.log('\n=== 파이프라인 완료 ===\n');
}

main().catch(async (err) => {
  await sendSlackAlert('[Unhandled] 파이프라인 비정상 종료', err);
  console.error('Unhandled error:', err);
  process.exit(1);
});
