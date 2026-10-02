import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiProperty({ type: String, example: 'BAD_REQUEST' })
  declare code: string;
  @ApiProperty({ type: String, example: '요청 값이 올바르지 않습니다.' })
  declare message: string;
  @ApiPropertyOptional({ type: [String], description: '입력 검증 메시지 목록' })
  declare details?: string[];
}

export class ApiErrorResponseDto {
  @ApiProperty({ type: () => ApiErrorDto })
  declare error: ApiErrorDto;
}
