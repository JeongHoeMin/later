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

describe('전체 mapped IPv4 대역 경계', () => {
  it.each([
    '::ffff:0:0/96',
    '::ffff:0.0.0.0/96',
    '0:0:0:0:0:FFFF:0000:0000/96',
    '::ffff:203.0.113.10/96',
    '::ffff:0:0/80',
    '::fffe:0:0/95',
    '::/1',
    '::/80',
  ])('임의 IPv4를 전부 신뢰하는 %s를 거부한다', (value) => {
    expect(() => readTrustedProxyCidrs(value)).toThrow('TRUSTED_PROXY_CIDRS');
  });
  it.each([
    '::ffff:192.0.2.0/120',
    '::ffff:127.0.0.1/128',
    '::ffff:0:0/97',
    '::/96',
    '2001:db8::/32',
    '8000::/1',
  ])('전체 IPv4를 포함하지 않는 명시 범위 %s를 허용한다', (value) => {
    expect(readTrustedProxyCidrs(value)).toEqual([value]);
  });
});
