# MEMORY.md — 하지 말아야 할 것들

> 이 프로젝트에서 실수하거나 불필요하게 돌아간 작업들. 다음에는 반복하지 않는다.

---

## 1. Braze API 엔드포인트를 스펙 명세만 보고 추정했다

### 실수
- `revenue` → `/kpi/revenue/data_series` 로 요청 → **404**
- `purchase_cnt` → `/events/data_series?event=$Purchase` 로 요청 → **400**

### 이유
- Revenue는 KPI API가 아닌 Purchases API 하위에 있음
- `$Purchase`는 커스텀 이벤트가 아닌 Braze 내장 결제 오브젝트라 events API로 조회 불가

### 교훈
> Braze API 엔드포인트는 명세서가 아닌 **MCP 서버 소스코드**(`tools/`, `models/`)를 먼저 확인한다.
> 특히 `$`로 시작하는 이벤트명은 커스텀 이벤트가 아닐 가능성이 높다.

---

## 2. Gmail `after:` 날짜 필터에 오늘 KST 날짜를 사용했다

### 실수
```js
`after:${todayKST}` // after:2026-04-01
```
→ KST 자정 직후 도착한 메일(UTC 기준 전날)이 검색에서 누락

### 이유
- Braze 메일이 00:29 KST (= 전날 15:29 UTC)에 도착
- `after:2026-04-01` 검색 시 UTC 날짜가 `2026-03-31`인 메일은 제외됨

### 교훈
> Gmail `after:` 필터는 **어제 KST 날짜**를 기준으로 사용한다.
> KST와 UTC의 9시간 차이 때문에 "오늘 KST 메일"이 UTC로는 전날에 찍힐 수 있다.

---

## 3. Braze `ending_at`을 미래 시각으로 계산했다

### 실수
```js
// "내일 자정 KST를 UTC로 변환"
const tomorrowMidnightKST = new Date(Date.UTC(y, m-1, d+1, 0, 0, 0) - 9*3600*1000);
```
→ 11:00 KST(= 02:00 UTC) 실행 시, `ending_at`이 같은 날 15:00 UTC = 13시간 후 미래값
→ 전체 Braze API 요청 **400 에러**

### 교훈
> Braze `ending_at`은 반드시 **과거 시각**이어야 한다.
> `new Date().toISOString()` (현재 시각)을 사용하면 항상 안전하다.

---

## 4. Google Sheets CSV 적재 시 헤더를 무조건 제거했다

### 실수
```js
return records.slice(1); // 항상 헤더 제거
```
→ 시트가 비어있을 때 헤더 없이 데이터만 들어가서 컬럼 이름 없음

### 교훈
> 시트가 비어있는지 먼저 확인하고, 비어있으면 헤더 포함 / 데이터가 있으면 헤더 제외한다.

---

## 5. macOS에서 cron을 사용했다

### 실수
- `crontab -e`로 cron 등록 → 절전 모드에서 실행 안 됨

### 교훈
> macOS 스케줄러는 **launchd**를 사용한다.
> cron은 절전 중 예약 시간이 지나면 스킵하지만, launchd는 깨어난 직후 실행한다.

---

## 6. 처음에 TypeScript로 설계했다가 JavaScript로 변경했다

### 실수
- 사용자 환경 확인 없이 명세의 `.ts` 확장자만 보고 TypeScript 프로젝트로 설계
- 실제 환경은 순수 Node.js, TypeScript 빌드 단계가 불필요했음

### 교훈
> 스택 결정 전 실제 실행 환경(Node 버전, tsconfig 유무, 기존 패턴)을 먼저 확인한다.
> 명세의 파일 확장자는 참고용일 수 있다.

---

## 7. Braze 다운로드 링크 만료 시간을 고려하지 않았다

### 실수
- Braze 이메일 본문: `"Note that these links will expire in 1 hours"`
- 파이프라인 실행 시각과 링크 발급 시각 차이가 1시간 이상 → **403 에러**

### 교훈
> Braze Engagement Report 발송 시각을 파이프라인 실행 시각 **직전(30분 이내)**으로 설정해야 한다.
> 파이프라인과 리포트 발송 시각은 반드시 함께 설계한다.

---

## 8. Gmail 검색 쿼리를 실제 메일 확인 없이 작성했다

### 실수
- 명세에 적힌 제목 패턴만 보고 검색 쿼리 작성
- 실제 메일 제목이 달라 검색 결과 0건

### 교훈
> Gmail 검색 쿼리 작성 전 **Gmail MCP로 실제 메일을 먼저 조회**해서 제목, 발신인, 날짜 형식을 확인한다.
