import type { PropsWithChildren } from "react";
import type { ViewStyle } from "react-native";

import { Modal, Pressable, StyleSheet, View } from "react-native";

type CenterModalProps = PropsWithChildren<{
  readonly containerStyle?: ViewStyle;
  readonly margin?: number;
  readonly marginBottom?: number;
  readonly marginHorizontal?: number;
  readonly marginLeft?: number;
  readonly marginRight?: number;
  readonly marginTop?: number;
  readonly marginVertical?: number;
  readonly onClose: () => void;
  readonly onShow?: () => void;
  readonly position?: "center" | "top";
  readonly visible: boolean;
}>;

function CenterModal({
  children,
  containerStyle = undefined,
  margin,
  marginBottom,
  marginHorizontal,
  marginLeft,
  marginRight,
  marginTop,
  marginVertical,
  onClose,
  onShow,
  position = "center",
  visible,
}: CenterModalProps) {
  const marginStyle: ViewStyle = {
    ...(margin !== undefined && { margin }),
    ...(marginBottom !== undefined && { marginBottom }),
    ...(marginHorizontal !== undefined && { marginHorizontal }),
    ...(marginLeft !== undefined && { marginLeft }),
    ...(marginRight !== undefined && { marginRight }),
    ...(marginTop !== undefined && { marginTop }),
    ...(marginVertical !== undefined && { marginVertical }),
  };
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      onShow={onShow}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={[styles.backdrop, position === "top" && styles.backdropTop]}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.container, marginStyle, containerStyle]}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  backdropTop: {
    justifyContent: "flex-start",
    paddingTop: 60,
  },
  container: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    width: "100%",
  },
});

export default CenterModal;
