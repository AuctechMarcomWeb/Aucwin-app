import { Image, View } from "react-native";

/** AucWin logo images (same files as the website). */
const LOGO = { color: require("../../assets/brand/logo.png"), white: require("../../assets/brand/logo-white.png") };
const MARK = { color: require("../../assets/brand/mark.png"), white: require("../../assets/brand/mark-white.png") };
const LOGO_RATIO = 720 / 165;
const MARK_RATIO = 256 / 154;

/** Full logo with the "AucWin" name and tagline. */
export function BrandLogo({ width = 220, variant = "color", style }) {
  return <Image source={LOGO[variant]} style={[{ width, height: width / LOGO_RATIO }, style]} resizeMode="contain" accessibilityLabel="AucWin" />;
}

/** Just the AV mark. */
export function BrandMark({ width = 40, variant = "color", style }) {
  return <Image source={MARK[variant]} style={[{ width, height: width / MARK_RATIO }, style]} resizeMode="contain" accessibilityLabel="AucWin" />;
}

/** Mark inside a rounded navy tile, like the phone's app icon. */
export function BrandTile({ size = 44, style }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: "#0F2F58", alignItems: "center", justifyContent: "center" }, style]}>
      <BrandMark width={size * 0.7} variant="white" />
    </View>
  );
}
