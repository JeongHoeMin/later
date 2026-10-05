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

function includesAllMappedIpv4(ip: string, prefix: number): boolean {
  if (prefix > 96) return false;
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  const [left, right] = canonical.split('::');
  const head = left ? left.split(':') : [];
  const tail = right ? right.split(':') : [];
  const groups =
    right === undefined
      ? head
      : [
          ...head,
          ...Array<string>(8 - head.length - tail.length).fill('0'),
          ...tail,
        ];
  const address = BigInt(
    '0x' + groups.map((group) => group.padStart(4, '0')).join(''),
  );
  const mappedNetwork = 0xffffn << 32n;
  const shift = BigInt(128 - prefix);
  return address >> shift === mappedNetwork >> shift;
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
          Number(prefix) > (family === 4 ? 32 : 128) ||
          (family === 6 && includesAllMappedIpv4(ip!, Number(prefix)))))
    ) {
      throw new Error(
        'TRUSTED_PROXY_CIDRS에는 명시적인 IP 또는 CIDR만 허용합니다.',
      );
    }
  }
  return cidrs;
}
