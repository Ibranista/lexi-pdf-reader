import {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetView,
  BottomSheetModal as GorhomBottomSheetModal,
} from "@gorhom/bottom-sheet";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { BackHandler, StyleSheet } from "react-native";

export type BottomSheetModalReference = {
  dismiss: () => void;
  present: () => void;
  snapToIndex: (index: number) => void;
};

type Props = {
  readonly androidKeyboardInputMode?: "adjustPan" | "adjustResize";
  readonly backdropPressBehavior?: "close" | "none";
  readonly backgroundStyle?: any;
  readonly children: React.ReactNode;
  readonly containerStyle?: any;
  readonly handleIndicatorStyle?: any;
  readonly disableBackHandlerClose?: boolean;
  readonly enableContentPanningGesture?: boolean;
  readonly enableDynamicSizing?: boolean;
  readonly enableHandlePanningGesture?: boolean;
  readonly enablePanDownToClose?: boolean;
  readonly keyboardBehavior?: "extend" | "fillParent" | "interactive";
  readonly keyboardBlurBehavior?: "none" | "restore";
  readonly onChange?: (index: number) => void;
  readonly onClose?: () => void;
  readonly scrollable?: boolean;
  readonly snapPoints?: (number | string)[];
};

export const BottomSheetModal = forwardRef<BottomSheetModalReference, Props>(
  (
    {
      androidKeyboardInputMode = "adjustResize",
      backdropPressBehavior = "close",
      backgroundStyle,
      children,
      containerStyle,
      handleIndicatorStyle,
      disableBackHandlerClose = false,
      enableContentPanningGesture = true,
      enableDynamicSizing = true,
      enableHandlePanningGesture = true,
      enablePanDownToClose = true,
      keyboardBehavior = "interactive",
      keyboardBlurBehavior = "restore",
      onChange,
      onClose,
      scrollable = false,
      snapPoints,
    },
    reference,
  ) => {
    const bottomSheetReference = React.useRef<GorhomBottomSheetModal>(null);
    const [isOpen, setIsOpen] = useState(false);

    const computedSnapPoints = useMemo(
      () => snapPoints ?? ["90%"],
      [snapPoints],
    );

    useImperativeHandle(reference, () => ({
      dismiss: () => bottomSheetReference.current?.dismiss(),
      present: () => bottomSheetReference.current?.present(),
      snapToIndex: (index: number) =>
        bottomSheetReference.current?.snapToIndex(index),
    }));

    useEffect(() => {
      if (!isOpen) {
        return undefined;
      }

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (disableBackHandlerClose) {
            return true;
          }
          bottomSheetReference.current?.dismiss();
          return true;
        },
      );

      return () => {
        subscription.remove();
      };
    }, [disableBackHandlerClose, isOpen]);

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.4}
          pressBehavior={backdropPressBehavior}
        />
      ),
      [backdropPressBehavior],
    );

    return (
      <GorhomBottomSheetModal
        android_keyboardInputMode={androidKeyboardInputMode}
        backdropComponent={renderBackdrop}
        backgroundStyle={backgroundStyle}
        enableContentPanningGesture={enableContentPanningGesture}
        enableDynamicSizing={enableDynamicSizing}
        enableBlurKeyboardOnGesture
        enableHandlePanningGesture={enableHandlePanningGesture}
        enablePanDownToClose={enablePanDownToClose}
        handleIndicatorStyle={[styles.handle, handleIndicatorStyle]}
        index={0}
        keyboardBehavior={keyboardBehavior}
        keyboardBlurBehavior={keyboardBlurBehavior}
        onChange={(index) => {
          setIsOpen(index >= 0);
          onChange?.(index);
        }}
        onDismiss={() => {
          setIsOpen(false);
          onClose?.();
        }}
        ref={bottomSheetReference}
        snapPoints={computedSnapPoints}
      >
        {scrollable ? (
          <BottomSheetScrollView
            bounces={false}
            contentContainerStyle={[styles.content, containerStyle]}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </BottomSheetScrollView>
        ) : (
          <BottomSheetView style={[styles.content, containerStyle]}>
            {children}
          </BottomSheetView>
        )}
      </GorhomBottomSheetModal>
    );
  },
);

BottomSheetModal.displayName = "BottomSheetModal";

export default BottomSheetModal;

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: "#ccc",
    borderRadius: 4,
    height: 4,
    width: 40,
  },
});
