import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function Frame({ size = 20, children }: { size?: number; children: ReactNode }) {
  return (
    <Svg fill="none" height={size} viewBox="0 0 20 20" width={size}>
      {children}
    </Svg>
  );
}

export function IconSliders({ size, color = '#000', strokeWidth = 1.6, bg = 'transparent' }: IconProps & { bg?: string }) {
  return (
    <Frame size={size}>
      <Path d="M3 6h14M3 14h14" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
      <Circle cx="8" cy="6" fill={bg} r="2.2" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="13" cy="14" fill={bg} r="2.2" stroke={color} strokeWidth={strokeWidth} />
    </Frame>
  );
}

export function IconSun({ size, color = '#000', strokeWidth = 1.5 }: IconProps) {
  return (
    <Frame size={size}>
      <Circle cx="10" cy="10" r="4" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={strokeWidth}
      />
    </Frame>
  );
}

export function IconBrain({ size, color = '#000', strokeWidth = 1.5 }: IconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M7.6 3.6a2.7 2.7 0 0 0-2.8 2.7c-1.1.4-1.8 1.4-1.8 2.5 0 .8.3 1.5.9 2-.3.4-.4.9-.4 1.4a2.7 2.7 0 0 0 2.7 2.7c.4.8 1.2 1.3 2.1 1.3 1.3 0 2-.9 2-2.2V5.8c0-1.3-.7-2.2-2-2.2-.1 0-.1 0-.2 0Z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M12.4 3.6a2.7 2.7 0 0 1 2.8 2.7c1.1.4 1.8 1.4 1.8 2.5 0 .8-.3 1.5-.9 2 .3.4.4.9.4 1.4a2.7 2.7 0 0 1-2.7 2.7c-.4.8-1.2 1.3-2.1 1.3-1.3 0-2-.9-2-2.2V5.8c0-1.3.7-2.2 2-2.2.1 0 .1 0 .2 0Z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Frame>
  );
}

export function IconSearch({ size, color = '#000', strokeWidth = 1.7 }: IconProps) {
  return (
    <Frame size={size}>
      <Circle cx="9" cy="9" r="5.5" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M13.5 13.5L17 17" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Frame>
  );
}

export function IconBack({ size, color = '#000', strokeWidth = 1.8 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M12 4l-6 6 6 6" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Frame>
  );
}

export function IconChevron({ size, color = '#000', strokeWidth = 1.8 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M7 4l6 6-6 6" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Frame>
  );
}

export function IconPlus({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M10 4v12M4 10h12" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Frame>
  );
}

export function IconSpark({ size, color = '#000' }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M10 2l1.8 6.2L18 10l-6.2 1.8L10 18l-1.8-6.2L2 10l6.2-1.8Z" fill={color} />
    </Frame>
  );
}

export function IconFolder({ size, color = '#000', strokeWidth = 1.6 }: IconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M2.5 5.5A1.5 1.5 0 0 1 4 4h4l2 2.5h6A1.5 1.5 0 0 1 17.5 8v6A1.5 1.5 0 0 1 16 15.5H4A1.5 1.5 0 0 1 2.5 14Z"
        stroke={color}
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Frame>
  );
}

export function IconCheck({ size, color = '#000', strokeWidth = 2.2 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M4 10.5l4 4L16 6" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Frame>
  );
}

export function IconClose({ size, color = '#000', strokeWidth = 1.8 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M5 5l10 10M15 5L5 15" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Frame>
  );
}

export function IconBookmark({ size, color = '#000', strokeWidth = 1.6, fill = 'none' }: IconProps & { fill?: string }) {
  return (
    <Frame size={size}>
      <Path d="M6 3h8v14l-4-3-4 3Z" fill={fill} stroke={color} strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Frame>
  );
}

export function IconPencil({ size, color = '#000', strokeWidth = 1.6 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M4 16l1-4 8-8 3 3-8 8-4 1Z" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Frame>
  );
}

export function IconGlobe({ size, color = '#000', strokeWidth = 1.5 }: IconProps) {
  return (
    <Frame size={size}>
      <Circle cx="10" cy="10" r="7.2" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M2.8 10h14.4M10 2.8c2.2 2 3.2 4.4 3.2 7.2s-1 5.2-3.2 7.2c-2.2-2-3.2-4.4-3.2-7.2s1-5.2 3.2-7.2Z"
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </Frame>
  );
}

export function IconGradCap({ size, color = '#000', strokeWidth = 1.7 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M3 6l7-3 7 3-7 3Z" stroke={color} strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Path
        d="M6 8v4c0 1.2 1.8 2.5 4 2.5s4-1.3 4-2.5V8"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Frame>
  );
}

export function IconType({ size, color = '#000', strokeWidth = 1.6 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M4 15.5 8.5 4h1L14 15.5M5.6 11.5h6.8M16 8v7.5" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Frame>
  );
}

export function IconReflow({ size, color = '#000', strokeWidth = 1.6 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M3 5h14M3 9h14M3 13.5h6M3 17.5h14" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
      <Path
        d="M17 11v1a1.5 1.5 0 0 1-1.5 1.5H12m1.6-1.6L12 13.5l1.6 1.6"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Frame>
  );
}

export function IconChat({ size, color = '#000', strokeWidth = 1.6 }: IconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M8 3.5a4.5 4.5 0 1 0 0 9h.5V16l3.5-3.5h.5a4.5 4.5 0 0 0 0-9Z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Frame>
  );
}

export function IconSync({ size, color = '#000', strokeWidth = 1.6 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M16 9a6 6 0 0 0-11-2M4 11a6 6 0 0 0 11 2" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Path d="M16 4v4h-4M4 16v-4h4" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Frame>
  );
}

export function IconLeaf({ size, color = '#000', strokeWidth = 1.6 }: IconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M10 17c0-6 2.2-10.4 7-13-1 7-2.4 11.2-7 13Z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M10 17c-.2-3.6-1.8-6.4-6.4-8.2 1.4 4.6 3 7.2 6.4 8.2Z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Frame>
  );
}

export function IconFocus({ size, color = '#000', strokeWidth = 1.6 }: IconProps) {
  return (
    <Frame size={size}>
      <Circle cx="10" cy="10" r="6.6" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="10" cy="10" fill={color} r="2.2" />
    </Frame>
  );
}

export function IconNoteDoc({ size, color = '#000', strokeWidth = 1.6 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M4 3h12v11l-3 3H4Z" stroke={color} strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Path d="M13 17v-3h3" stroke={color} strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Frame>
  );
}

export function IconCards({ size, color = '#000', strokeWidth = 1.5 }: IconProps) {
  return (
    <Frame size={size}>
      <Rect height="11" rx="2" stroke={color} strokeLinejoin="round" strokeWidth={strokeWidth} width="12" x="4" y="5.5" />
      <Path d="M6.5 3.5h10a1 1 0 0 1 1 1v9" opacity={0.5} stroke={color} strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Path d="M7.5 10h5M7.5 12.8h3" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Frame>
  );
}

export function IconGraph({ size, color = '#000', strokeWidth = 1.5 }: IconProps) {
  return (
    <Frame size={size}>
      <Circle cx="10" cy="4.5" r="2" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="4.5" cy="14.5" r="2" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="15.5" cy="14.5" r="2" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M9 6.3l-3.4 6.4M11 6.3l3.4 6.4M6.5 14.5h7" stroke={color} strokeWidth={strokeWidth} />
    </Frame>
  );
}

export function IconWave({ size, color = '#000', strokeWidth = 1.7 }: IconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M3 12c2.5 0 3.5-6 6-6s3.5 8 6 8 2-4 2-4"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Frame>
  );
}

export function IconSend({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M10 16V4M5 9l5-5 5 5" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Frame>
  );
}

export function IconExternal({ size, color = '#000', strokeWidth = 2 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M5 15 15 5M8 5h7v7" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </Frame>
  );
}

export function IconStar({ size, color = '#000', strokeWidth = 1.7 }: IconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M10 2.5 11.8 8l5.7.1-4.6 3.5 1.7 5.5L10 13.7l-4.6 3.4 1.7-5.5L2.5 8.1 8.2 8Z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Frame>
  );
}

export function IconHighlighter({ size, color = '#000', strokeWidth = 1.7 }: IconProps) {
  return (
    <Frame size={size}>
      <Path d="M4 13l7-7 3 3-7 7H4Z" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <Path d="M4 17h12" stroke={color} strokeLinecap="round" strokeWidth={strokeWidth} />
    </Frame>
  );
}
