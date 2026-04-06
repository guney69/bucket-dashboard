'use strict';

require('dotenv').config();
const fs = require('fs');
const { google } = require('googleapis');
const { parse: csvParse } = require('csv-parse/sync');

function getSheetsClient() {
  const keyFilePath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!keyFilePath) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON 경로가 .env에 설정되어야 합니다');
  }
  if (!fs.existsSync(keyFilePath)) {
    throw new Error(`서비스 계정 JSON 파일을 찾을 수 없습니다: ${keyFilePath}`);
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function appendRows(sheets, sheetName, rows) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_ID가 .env에 설정되어야 합니다');
  }
  if (rows.length === 0) {
    console.log(`[sheets] ${sheetName}: 추가할 행 없음`);
    return;
  }
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
  console.log(`[sheets] "${sheetName}"에 ${rows.length}행 추가 완료`);
}

function parseCsvToRows(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  return csvParse(content, {
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
}

async function isSheetEmpty(sheets, sheetName, spreadsheetId) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:A2`,
    });
    return !res.data.values || res.data.values.length === 0;
  } catch {
    return true;
  }
}

async function loadCsvToSheet(csvPath, sheetName) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const sheets = getSheetsClient();
  const allRows = parseCsvToRows(csvPath); // includes header row

  // Include header only when sheet is empty; skip on subsequent daily appends
  const empty = await isSheetEmpty(sheets, sheetName, spreadsheetId);
  const rows = empty ? allRows : allRows.slice(1);

  await appendRows(sheets, sheetName, rows);
}

async function loadKpiRow(kpi) {
  const sheets = getSheetsClient();
  const row = [
    kpi.date,
    kpi.doseo_masudong,
    kpi.ebook_masudong,
    kpi.salak_masudong,
    kpi.dau,
    kpi.mau,
    kpi.revenue,
    kpi.purchase_cnt,
    kpi.YS_product_order_completed,
    kpi.YS_add_to_cart,
    kpi.YS_event_page_view,
    kpi.YS_product_detail_view,
    kpi.YS_search_completed,
    kpi.YS_review_like_completed,
  ];
  await appendRows(sheets, 'daily_kpi', [row]);
}

module.exports = { loadCsvToSheet, loadKpiRow };
