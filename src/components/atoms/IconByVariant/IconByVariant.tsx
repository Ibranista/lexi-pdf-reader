import type { FC } from "react";
import type { SvgProps } from "react-native-svg";

import * as IconsaxIcons from "iconsax-react-nativejs";
import { createElement, useMemo } from "react";
import {
  Image,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
  View,
} from "react-native";
import * as z from "zod";

import { palette } from "@/constants/colors";
import { useTheme } from "@/theme";
import getAssetsContext from "@/theme/assets/getAssetsContext";
import type { AssetType } from "@/theme/assets/getAssetsContext";
import LogoMainSvg from "./LogoMainSvg";

type BaseProperties = {
  readonly assetType?: IconAssetType;
  readonly height?: number | string;
  readonly path: string;
  readonly width?: number | string;
};

type IconAssetType = "iconsax" | AssetType;
type Properties = RasterProperties | SvgProperties;

type RasterProperties = {
  readonly pointerEvents?: "auto" | "box-none" | "box-only" | "none";
  readonly preserveAspectRatio?: string;
  readonly style?: StyleProp<ImageStyle>;
  readonly type: "gif" | "jpeg" | "jpg" | "png" | "webp";
} & BaseProperties;

type SvgProperties = {
  readonly type?: "svg";
  readonly secondaryFill?: string;
} & BaseProperties &
  SvgProps;

const icons = getAssetsContext("icons");
const tabs = getAssetsContext("tabs");
const base = getAssetsContext("base");
const images = getAssetsContext("images");

const assetContexts = {
  base,
  images,
  icons,
  tabs,
} as const;

const iconsaxRegistry = IconsaxIcons as Record<string, unknown>;

const SVG_EXTENSION = "svg";
const SIZE = 24;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function FallbackIcon(_props: SvgProps): null {
  return null;
}

const kebabToPascalCase = (value: string) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");

const normalizeIconName = (value: string) =>
  value.replaceAll(/[\s_-]+/g, "").toLowerCase();

const resolveIconsaxComponent = (
  path: string,
): FC<Record<string, unknown>> | null => {
  const candidates = [
    path,
    kebabToPascalCase(path),
    path.replaceAll(/[\s_-]+/g, ""),
  ];

  const normalizedPath = normalizeIconName(path);

  for (const candidate of candidates) {
    const icon = iconsaxRegistry[candidate];
    if (icon !== undefined && icon !== null) {
      return icon as FC<Record<string, unknown>>;
    }
  }

  for (const [exportName, exportedValue] of Object.entries(iconsaxRegistry)) {
    if (normalizeIconName(exportName) === normalizedPath) {
      return exportedValue as FC<Record<string, unknown>>;
    }
  }

  return null;
};

const resolveIconComponent = (
  assetType: IconAssetType,
  path: string,
  variant: string,
): FC<SvgProps> => {
  if (assetType === "iconsax") {
    return FallbackIcon;
  }

  const schema = z.object({
    default: z.custom<FC<SvgProps>>(),
  });

  const context = assetContexts[assetType];
  const getModule = (p: string) => {
    const mod = context(p);
    return schema.parse(mod).default;
  };

  try {
    if (variant !== "default") {
      try {
        return getModule(`./${variant}/${path}.${SVG_EXTENSION}`);
      } catch {}
    }
    return getModule(`./${path}.${SVG_EXTENSION}`);
  } catch (error) {
    console.warn(`Icon ${path} not found. Returning fallback.`, error);
    return FallbackIcon;
  }
};

const resolveRasterSource = (
  assetType: IconAssetType,
  path: string,
  extension: string,
  variant: string,
): ImageSourcePropType | null => {
  if (assetType === "iconsax") {
    return null;
  }

  const context = assetContexts[assetType];

  const tryResolve = (modulePath: string): ImageSourcePropType | null => {
    try {
      const module_ = context(modulePath) as
        | { default?: ImageSourcePropType }
        | ImageSourcePropType;
      if (
        module_ &&
        typeof module_ === "object" &&
        "default" in module_ &&
        module_.default
      ) {
        return module_.default;
      }
      return module_ as ImageSourcePropType;
    } catch {
      return null;
    }
  };

  if (variant !== "default") {
    const result = tryResolve(`./${variant}/${path}.${extension}`);
    if (result !== null) return result;
  }

  const result = tryResolve(`./${path}.${extension}`);
  if (result !== null) return result;

  console.warn(`Asset ${path}.${extension} not found.`);
  return null;
};

function IconByVariant({
  assetType = "icons",
  height = SIZE,
  path,
  type = "svg",
  width = SIZE,
  ...props
}: Properties) {
  const { variant } = useTheme();

  const IconComponent = useMemo(
    () =>
      type === "svg"
        ? resolveIconComponent(assetType, path, variant)
        : FallbackIcon,
    [assetType, path, type, variant],
  );

  const rasterSource = useMemo(
    () =>
      type === "svg"
        ? null
        : resolveRasterSource(assetType, path, type, variant),
    [assetType, path, type, variant],
  );

  if (assetType === "iconsax") {
    const IconsaxIcon = resolveIconsaxComponent(path);
    if (!IconsaxIcon) {
      console.warn(`Iconsax icon ${path} not found. Returning fallback.`);
      return null;
    }

    const resolvedSize =
      typeof width === "number"
        ? width
        : typeof height === "number"
          ? height
          : SIZE;
    const svgProps = props as SvgProps;
    const iconColor: string | undefined =
      typeof svgProps.color === "string"
        ? svgProps.color
        : typeof svgProps.stroke === "string"
          ? svgProps.stroke
          : undefined;

    return createElement(IconsaxIcon, {
      color: iconColor,
      size: resolvedSize,
    });
  }

  if (type !== "svg") {
    const { pointerEvents, style } = props as RasterProperties;
    return (
      <View
        pointerEvents={pointerEvents}
        style={[{ height: height as number, width: width as number }, style]}
      >
        <Image
          resizeMode="cover"
          source={rasterSource ?? undefined}
          style={{ height: "100%", width: "100%" }}
        />
      </View>
    );
  }

  const svgProps = props as SvgProps;
  const isLogoMain = assetType === "base" && path === "Logo-main";
  const getContrastColor = (hexColor: string) => {
    const hex = hexColor.trim().replace(/^#/, "");
    if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex)) {
      return "#000000";
    }

    const normalized =
      hex.length === 3
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex;
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.6 ? "#000000" : "#FFFFFF";
  };

  if (isLogoMain) {
    const logoProps = props as SvgProperties;
    const primaryColor =
      typeof svgProps.fill === "string"
        ? svgProps.fill
        : typeof svgProps.color === "string"
          ? svgProps.color
          : palette.accent[500];

    const hasCustomPrimary =
      typeof svgProps.fill === "string" || typeof svgProps.color === "string";

    const secondaryColor =
      typeof logoProps.secondaryFill === "string"
        ? logoProps.secondaryFill
        : hasCustomPrimary
          ? getContrastColor(primaryColor)
          : "#000000";

    const {
      fill: _fill,
      color: _color,
      secondaryFill,
      ...restSvgProps
    } = logoProps;

    return createElement(LogoMainSvg, {
      height,
      width,
      ...restSvgProps,
      primaryColor,
      secondaryColor,
    });
  }

  return createElement(IconComponent, {
    height,
    width,
    ...(props as SvgProps),
  });
}

export default IconByVariant;
