import { useMemo, useRef } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Button, IconByVariant, Text } from "@/components/atoms";
import {
  BottomSheetModal,
  type BottomSheetModalReference,
} from "@/components/modals";
import {
  LANGUAGE_OPTIONS,
  type LanguageOption,
} from "../../../constants/languageOptions";
import { useAppStore } from "@/stores/appStore";
import { palette } from "@/constants/colors";

type LanguageSelectorProps = {
  readonly modalTitle?: string;
};

function LanguageSelector({
  modalTitle = "Change Language",
}: LanguageSelectorProps) {
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const languagePickerRef = useRef<BottomSheetModalReference>(null);

  const languageLabel = useMemo(() => {
    return (
      LANGUAGE_OPTIONS.find((option: LanguageOption) => option.code === locale)
        ?.label ?? "English"
    );
  }, [locale]);

  return (
    <>
      <BottomSheetModal
        ref={languagePickerRef}
        enableDynamicSizing={false}
        snapPoints={["50%"]}
      >
        <Text size="md" weight="bold" color="dark.100">
          {modalTitle}
        </Text>

        <Box style={styles.listWrap}>
          {LANGUAGE_OPTIONS.map((option: LanguageOption) => {
            const selected = option.code === locale;
            return (
              <Pressable
                key={option.code}
                onPress={() => {
                  setLocale(option.code);
                  languagePickerRef.current?.dismiss();
                }}
                style={styles.languageOption}
              >
                <Text size="14" color="neutral.900">
                  {option.label}
                </Text>
                {selected ? (
                  <Box style={styles.languageCheck}>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  </Box>
                ) : null}
              </Pressable>
            );
          })}
        </Box>
      </BottomSheetModal>

      <Button
        alignSelf="flex-start"
        backgroundColor="white"
        gap={8}
        height={38}
        justify="center"
        onPress={() => languagePickerRef.current?.present()}
        px={14}
        py={8}
        rounded={9999}
        textColor="black"
        textSize="14"
        textWeight="medium"
        title={languageLabel}
        rightAdornment={
          <IconByVariant
            assetType="base"
            path="down-arrow"
            type="svg"
            width={7}
          />
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  languageCheck: {
    alignItems: "center",
    backgroundColor: palette.accent[500],
    borderRadius: 999,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  languageOption: {
    alignItems: "center",
    backgroundColor: "#F2F2F2",
    borderRadius: 9999,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 50,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  listWrap: {
    gap: 10,
    marginTop: 24,
  },
});

export type { LanguageSelectorProps };
export default LanguageSelector;
