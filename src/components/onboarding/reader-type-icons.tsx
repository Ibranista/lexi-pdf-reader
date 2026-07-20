import type { ComponentType } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { ReaderType } from '@/constants/onboarding';

interface ReaderTypeIconProps {
  color: string;
  size?: number;
}

function StudentIcon({ color, size = 18 }: ReaderTypeIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinejoin="round"
    >
      <Path d="M3 6l7-3 7 3-7 3Z" />
      <Path d="M6 8v4c0 1.2 1.8 2.5 4 2.5s4-1.3 4-2.5V8" strokeLinecap="round" />
    </Svg>
  );
}

function ResearcherIcon({ color, size = 18 }: ReaderTypeIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
    >
      <Circle cx={9} cy={9} r={5.5} />
      <Path d="M13.5 13.5L17 17" />
    </Svg>
  );
}

function ProfessionalIcon({ color, size = 18 }: ReaderTypeIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinejoin="round"
    >
      <Rect x={3} y={6} width={14} height={10} rx={2} />
      <Path d="M7 6V4.5A1.5 1.5 0 0 1 8.5 3h3A1.5 1.5 0 0 1 13 4.5V6" />
    </Svg>
  );
}

function CasualReaderIcon({ color, size = 18 }: ReaderTypeIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinejoin="round"
    >
      <Path d="M10 4c-2-1.5-5-1.5-6.5 0v11C5 13.5 8 13.5 10 15c2-1.5 5-1.5 6.5 0V4C15 2.5 12 2.5 10 4Z" />
      <Path d="M10 4v11" />
    </Svg>
  );
}

/** Maps each reader type to its selection-card icon. */
export const READER_TYPE_ICONS: Record<ReaderType, ComponentType<ReaderTypeIconProps>> = {
  student: StudentIcon,
  researcher: ResearcherIcon,
  professional: ProfessionalIcon,
  casual: CasualReaderIcon,
};
