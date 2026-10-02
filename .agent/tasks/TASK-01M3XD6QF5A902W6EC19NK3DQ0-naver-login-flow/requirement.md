# Requirement

Goal: 사용자 승인에 따라 서버 전용 네이버 실제 브라우저 로그인 API를 완성한다. 현재 부족한 서버 로그인 시작/state/콜백/앱복귀/완료를 연결하며 모바일 제품 코드는 수정하지 않는다.

R1 AC-R1-1: 서버의 무작위state·독립attemptSecret과5분 시도를 저장하고 등록된callback으로인가URL을 생성한다. DB에는state/proof의해시만 저장한다.
R1 AC-R1-2: Callback에서state를 저장시도와대조하고 만료/중복을거부하며 네이버code/state는암호화저장한다. 앱복귀URL에는시도ID만전달하고 code/state/service token/proof는노출하지않는다. 복귀대상은서버고정설정.
R2 AC-R2-1: 앱은start에서받은proof로만callback완료시도를일회소비하고 기존네이버code교환·회원·서비스세션발급으로연결한다. proof불일치/콜백미도착/만료/재사용/사용자취소는서비스로그인하지않는다.
R2 AC-R2-2: DB원자성/동시소비,암호화변조,고정URL설정검증을수행한다.

후속Task: HTTP start/callback/complete등록·legacy네이버직접제출차단·Swagger계약, 전체프로세스문서. 실제주소/앱URI는env설정으로두며배포/네이버콘솔변경/모바일구현은제외.
