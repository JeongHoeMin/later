# Task 조회

Task의 원본은 현재 checkout의 각 Directory에 있는 네 문서다. 이 파일에는 Task별 상태 표를 수동 관리하지 않는다.
생성·이름·병렬 작업 규칙은 [Task Identity](../task-identity.md), 코드 컨벤션은 [project.md](../project.md)를 따른다.

PowerShell에서 현재 checkout의 Task 파일을 조회한다:

```powershell
Get-ChildItem .agent/tasks -Directory |
  Sort-Object Name |
  ForEach-Object { Join-Path $_.FullName 'task.yaml' } |
  Where-Object { Test-Path -LiteralPath $_ } |
  ForEach-Object { Get-Content -LiteralPath $_ }
```

브랜치와 status/phase/current_summary/next_action을 확인한 후 해당 Task의 task.yaml → requirement.md → progress.md → verification.md를 읽는다.
완료 Task의 후속 제안은 각 progress.md와 최종 보고를 참고한다. 다른 브랜치의 구현·검증 상태를 현재 checkout에 있다고 가정하지 않는다.
Dashboard가 필요하면 이 파일의 수동 표를 추가하는 대신 Task 데이터를 읽어 파생 뷰를 생성한다.
Directory가 ULID ID로 시작하므로 위 문자열 정렬은 신규 Task의 생성 시간순 조회다. 같은 밀리초 안의 순서는 보장하지 않는다.
기존 Task의 이관 ULID는 이관 시각을 담는다. 과거 작업 시간순 조회는 원래 created_at을 사용하며 날짜만 알려진 항목에 임의 시각을 만들지 않는다.
