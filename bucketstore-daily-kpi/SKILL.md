# SKILL.md — 검증된 업무 프로세스

> 이 프로젝트에서 시행착오 끝에 확인한 정답에 가까운 방법들.

---

## 1. Braze API 엔드포인트 매핑 (검증 완료)

| 지표 | 엔드포인트 | 응답 필드 |
|------|-----------|---------|
| DAU | `GET /kpi/dau/data_series` | `data[0].dau` |
| MAU | `GET /kpi/mau/data_series` | `data[0].mau` |
| **Revenue** | `GET /purchases/revenue_series` | `data[0].revenue` |
| **Purchase 건수** | `GET /purchases/quantity_series` | `data[0].purchase_quantity` |
| 커스텀 이벤트 | `GET /events/data_series?event=이벤트명&unit=day` | `data[0].count` |
| 세그먼트 모수 | `GET /segments/data_series?segment_id=...` | `data[0].size` |

**공통 파라미터**: `length=1`, `ending_at=new Date().toISOString()`

> `$Purchase`는 커스텀 이벤트가 아니다. `/purchases/quantity_series`로 조회한다.
> Revenue도 `/kpi/`가 아닌 `/purchases/`에 있다.

---

## 2. Braze MCP 서버 소스코드로 엔드포인트 확인하는 법

새로운 Braze 지표를 추가할 때 아래 경로에서 실제 URL path와 응답 필드를 먼저 확인한다.

```
~/Library/Application Support/Claude/Claude Extensions/
  ant.dir.pypi.braze.braze-mcp-server/src/braze_mcp/
    tools/     ← url_path, params 확인
    models/    ← 응답 필드명 확인
```

---

## 3. Gmail 검색 쿼리 작성 순서

1. **Gmail MCP로 실제 메일 먼저 조회**
   ```
   from:no-reply@alerts.braze.com subject:"Engagement Report"
   ```
   → 실제 제목, threadId, internalDate(UTC) 확인

2. **날짜 필터는 어제 KST 기준**
   ```js
   `after:${getYesterdayKST()}`  // KST → UTC 변환 이슈 대응
   ```
   - KST 당일 새벽에 도착한 메일이 UTC로는 전날로 찍히는 경우가 있음
   - `after:어제` 로 검색하면 어제~오늘 UTC 범위를 모두 포함
   - 결과는 최신순 정렬이므로 `messages[0]`이 가장 최근 메일

3. **스레드 threading 대응**
   - `messages.list`는 개별 메시지 단위로 반환 (스레드 무관)
   - threadId ≠ messageId 이면 기존 스레드의 reply로 도착한 것
   - 검색 결과 최신 메시지를 선택하면 올바른 메일 선택됨

---

## 4. Braze `ending_at` 올바른 사용법

```js
// 항상 현재 시각 사용 → Braze가 미래 날짜를 400으로 거부하지 않음
function getBrazeEndingAt() {
  return new Date().toISOString();
}
```

- `length=1`이면 현재 시각 기준 최근 1일 데이터를 반환
- "내일 자정 KST" 같은 미래 계산값은 절대 사용하지 않는다

---

## 5. Google Sheets CSV 적재 패턴

```js
// 시트가 비어있으면 헤더 포함, 데이터가 있으면 헤더 제외
const empty = await isSheetEmpty(sheets, sheetName, spreadsheetId);
const rows = empty ? allRows : allRows.slice(1);
```

- `valueInputOption: 'USER_ENTERED'` → 숫자가 문자열로 들어가지 않음
- `insertDataOption: 'INSERT_ROWS'` → 기존 데이터 덮어쓰지 않고 행 추가

---

## 6. macOS 자동화 스케줄러: launchd

```xml
<!-- ~/Library/LaunchAgents/com.xxx.plist -->
<key>StartCalendarInterval</key>
<dict>
    <key>Hour</key><integer>9</integer>
    <key>Minute</key><integer>0</integer>
</dict>
```

```bash
# 등록
launchctl load ~/Library/LaunchAgents/com.xxx.plist

# 수정 시: unload → plist 수정 → load
launchctl unload ~/Library/LaunchAgents/com.xxx.plist
# (plist 수정)
launchctl load ~/Library/LaunchAgents/com.xxx.plist

# 즉시 실행 (테스트)
launchctl start com.xxx

# 확인
launchctl list | grep xxx
```

- cron과 달리 절전(sleep) 중 시간이 지나도 깨어난 직후 실행
- nvm 사용 시 node 절대 경로 지정 필수:
  `/Users/gunheelee/.nvm/versions/node/v25.8.0/bin/node`

---

## 7. Braze Engagement Report 파이프라인 시간 설계

```
Braze 리포트 발송: 08:30 KST
파이프라인 실행:   09:00 KST
링크 만료:        09:30 KST (발송 후 1시간)
```

- 다운로드 링크는 **발송 후 1시간** 만료
- 파이프라인 실행 시각은 리포트 발송 시각 **30분 이내**로 설정
- Braze 대시보드에서 Engagement Report 발송 시각을 파이프라인 실행 직전으로 맞춘다

---

## 8. 동시 API 호출 패턴 (Promise.all + 개별 에러 처리)

```js
const safeCall = (promise, label) =>
  promise.catch(e => {
    const detail = e.response ? JSON.stringify(e.response.data) : '';
    console.warn(`[braze] ${label} 실패: ${e.message}${detail ? ' | ' + detail : ''}`);
    return null; // 개별 실패는 null로 처리, 전체 중단 안 함
  });

const [a, b, c, ...rest] = await Promise.all([
  safeCall(getA(), 'a'),
  safeCall(getB(), 'b'),
  safeCall(getC(), 'c'),
  ...items.map(x => safeCall(getX(x), x)),
]);
```

- 14개 API를 순차 호출 시 ~14초, 동시 호출 시 ~1-2초
- 개별 실패를 `null`로 처리해 부분 데이터라도 Sheets에 적재 가능
- 에러 시 응답 본문(`e.response.data`)도 함께 로깅해 디버깅 편의성 확보

---

## 9. 프로젝트 시작 전 환경 확인 체크리스트

- [ ] Node 버전 및 nvm 여부 확인 (`node -v`, `which node`)
- [ ] 기존 프로젝트 패턴 확인 (TypeScript vs JavaScript)
- [ ] Gmail MCP로 실제 메일 제목/구조 확인
- [ ] Braze MCP 서버 소스코드에서 엔드포인트 확인
- [ ] 서비스 계정 JSON 경로 및 접근 권한 확인
- [ ] Google Sheets 서비스 계정 공유 권한 확인
- [ ] Braze 리포트 발송 시각과 파이프라인 실행 시각 30분 이내 설정
