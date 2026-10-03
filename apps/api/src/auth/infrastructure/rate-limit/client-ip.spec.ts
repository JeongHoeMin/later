import { describe, it, expect } from 'vitest';
import { normalizeClientIp, readTrustedProxyCidrs } from './client-ip.js';
describe('클라이언트 IP와 신뢰 프록시', () => {
  it.each([
    ['::ffff:192.0.2.1', '192.0.2.1'],
    ['::ffff:c000:201', '192.0.2.1'],
    ['2001:0db8:0000:0000:0000:0000:0000:0001', '2001:db8::1'],
    ['192.0.2.1', '192.0.2.1'],
  ])('동일 주소 %s를 %s로 정규화한다', (input, want) =>
    expect(normalizeClientIp(input)).toBe(want),
  );
  it.each(['unknown', '1.2.3.4, 5.6.7.8', ''])(
    '유효하지 않은 IP %s는 거부한다',
    (ip) => expect(() => normalizeClientIp(ip)).toThrow(),
  );
  it('프록시를 기본 신뢰하지 않으며 명시적인 IP/CIDR만 허용한다', () => {
    expect(readTrustedProxyCidrs()).toBe(false);
    expect(readTrustedProxyCidrs('')).toBe(false);
    expect(readTrustedProxyCidrs(' 127.0.0.1/32,::1,10.0.0.0/8 ')).toEqual([
      '127.0.0.1/32',
      '::1',
      '10.0.0.0/8',
    ]);
  });
  it.each([
    'true',
    '1',
    'loopback',
    '0.0.0.0/0',
    '::/0',
    '127.0.0.1/33',
    '::1/129',
    '10.0.0.0/-1',
    '127.0.0.1,,::1',
  ])('위험하거나 잘못된 설정 %s는 시작 시 거부한다', (value) =>
    expect(() => readTrustedProxyCidrs(value)).toThrow(),
  );
});
