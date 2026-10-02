import Svg, { Circle, G, Path } from 'react-native-svg';
import { colors } from '../theme/colors';

type Props = {
  size?: number;
  color?: string;
  dotColor?: string;
};

// ㄴ/L 모노그램. 원본: assets/brand/*.svg
export function LogoMark({
  size = 64,
  color = colors.white,
  dotColor = colors.yellow,
}: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G transform="translate(-6.25 1.25)">
        <Path
          d="M38 24V58Q38 72 52 72H58"
          fill="none"
          stroke={color}
          strokeWidth={11}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={73} cy={72} r={7} fill={dotColor} />
      </G>
    </Svg>
  );
}
