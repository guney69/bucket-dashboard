'use strict';

require('dotenv').config();
const { google } = require('googleapis');
const readline = require('readline');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

async function main() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('ERROR: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set in .env');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'urn:ietf:wg:oauth:2.0:oob' // out-of-band redirect for CLI
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // forces refresh_token to be returned every time
  });

  console.log('\n브라우저에서 아래 URL을 열어 Google 계정으로 로그인하세요:\n');
  console.log(authUrl);
  console.log('\n권한 허용 후 표시되는 인증 코드를 아래에 붙여넣으세요:\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('인증 코드: ', async (code) => {
    rl.close();
    try {
      const { tokens } = await oauth2Client.getToken(code.trim());
      if (!tokens.refresh_token) {
        console.warn('\nWARNING: refresh_token이 반환되지 않았습니다.');
        console.warn('Google 계정에서 앱 액세스를 취소한 후 다시 실행하세요.');
        process.exit(1);
      }
      console.log('\n아래 값을 .env 파일의 GMAIL_REFRESH_TOKEN에 붙여넣으세요:\n');
      console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
    } catch (err) {
      console.error('토큰 발급 실패:', err.message);
      process.exit(1);
    }
  });
}

main();
