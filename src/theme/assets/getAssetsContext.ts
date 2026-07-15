export type AssetType = "base" | "icons" | "images" | "tabs";

const getAssetsContext = (type: AssetType) =>
  type === "images"
    ? require.context("./images", true, /\.(png|jpg|jpeg|gif|webp)$/)
    : type === "tabs"
      ? require.context("./tabs", true, /\.svg$/)
      : type === "base"
        ? require.context("./base", true, /\.(svg|png|jpg|jpeg|gif|webp)$/)
        : require.context("./icons", true, /\.svg$/);

export default getAssetsContext;
