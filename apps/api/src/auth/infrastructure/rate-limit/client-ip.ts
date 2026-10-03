import { isIP } from 'node:net';

export function normalizeClientIp(ip: string): string {
  const family = isIP(ip);
  if (!family) throw new Error('유효한 클라이언트 IP가 필요합니다.');
  if (family === 4) return ip;
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([0-9a-f]+):([0-9a-f]+)$/.exec(canonical);
  if (!mapped) return canonical;
  const value = parseInt(mapped[1]!, 16) * 65536 + parseInt(mapped[2]!, 16);
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}

export function readTrustedProxyCidrs(value?: string): string[] | false {
  if (!value?.trim()) return false;
  const cidrs = value.split(',').map((item) => item.trim());
  for (const cidr of cidrs) {
    const [ip, prefix, extra] = cidr.split('/');
    const family = isIP(ip ?? '');
    if (
      !family ||
      extra !== undefined ||
      (prefix !== undefined &&
        (!/^\d+$/.test(prefix) ||
          Number(prefix) < 1 ||
          Number(prefix) > (family === 4 ? 32 : 128)))
    ) {
      throw new Error(
        'TRUSTED_PROXY_CIDRS에는 명시적인 IP 또는 CIDR만 허용합니다.',
      );
    }
  }
  return cidrs;
}
