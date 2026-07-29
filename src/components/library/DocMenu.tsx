import { File } from "expo-file-system";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { Box, TextInput } from "@/components/atoms";
import {
  IconClose,
  IconExternal,
  IconPencil,
  IconTrash,
  SectionLabel,
  Tap,
  Text,
} from "@/components/lexi-components";
import { useToastStore } from "@/stores/app-store";
import {
  useCollectionsStore,
  type FilableDoc,
} from "@/stores/collections-store";
import { useRecentsStore } from "@/stores/recents-store";
import { useProtoTheme } from "@/theme/proto";

const DANGER = "#C0554A";

function uriExtension(uri: string): string {
  const name = decodeURIComponent(uri.slice(uri.lastIndexOf("/") + 1));
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot) : "";
}

export function DocMenu({
  doc,
  onChanged,
  onClose,
}: {
  doc: FilableDoc;
  onChanged: () => void;
  onClose: () => void;
}) {
  const t = useProtoTheme();
  const { t: tr } = useTranslation("home");
  const showToast = useToastStore((s) => s.showToast);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(doc.name);
  const [armed, setArmed] = useState(false);

  const share = async () => {
    try {
      const Sharing = await import("expo-sharing");
      if (!(await Sharing.isAvailableAsync())) throw new Error("unavailable");
      onClose();
      await Sharing.shareAsync(doc.uri, { dialogTitle: doc.name });
    } catch {
      showToast(tr("library.docMenu.shareFailed"));
    }
  };

  const rename = () => {
    const next = name.trim();
    if (!next || next === doc.name) {
      onClose();
      return;
    }
    try {
      const file = new File(doc.uri);
      file.rename(`${next}${uriExtension(doc.uri)}`);
      useCollectionsStore
        .getState()
        .rename(doc.uri, { uri: file.uri, name: next });
      useRecentsStore.getState().rename(doc.uri, { uri: file.uri, name: next });
      onChanged();
      onClose();
    } catch {
      showToast(tr("library.docMenu.renameFailed"));
    }
  };

  const destroy = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    try {
      new File(doc.uri).delete();
      useCollectionsStore.getState().forget(doc.uri);
      useRecentsStore.getState().remove(doc.uri);
      showToast(tr("library.docMenu.deletedToast", { name: doc.name }));
      onChanged();
      onClose();
    } catch {
      showToast(tr("library.docMenu.deleteFailed"));
    }
  };

  const action = (
    icon: React.ReactNode,
    label: string,
    onPress: () => void,
    color?: string,
  ) => (
    <Tap onPress={onPress} scale={0.98}>
      <Box
        align="center"
        bg={t.chip}
        direction="row"
        gap={9}
        paddingX={10}
        paddingY={9}
        rounded={8}
      >
        {icon}
        <Text color={color ?? t.ink} size={12} weight="600">
          {label}
        </Text>
      </Box>
    </Tap>
  );

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible
    >
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <Box
          bg={t.card}
          borderColor={t.line}
          borderWidth={1}
          gap={5}
          padding={7}
          rounded={12}
          style={styles.menu}
        >
          <Box align="center" direction="row" paddingBottom={1}>
            <Box flex={1}>
              <SectionLabel size={9}>
                {tr("library.docMenu.label")}
              </SectionLabel>
            </Box>
            <Tap onPress={onClose} scale={0.9}>
              <Box align="center" height={20} justify="center" width={20}>
                <IconClose color={t.sub} size={14} />
              </Box>
            </Tap>
          </Box>
          <Box>
            <Text
              numberOfLines={2}
              size={12}
              style={{ marginTop: 3 }}
              weight="600"
            >
              {doc.name}
            </Text>
          </Box>

          {renaming ? (
            <Box gap={7} paddingTop={3}>
              <TextInput
                autoFocus
                backgroundColor={t.chip}
                borderColor={t.line}
                borderWidth={1}
                fontSize={12.5}
                onChangeText={setName}
                onSubmitEditing={rename}
                placeholder={tr("library.docMenu.renamePlaceholder")}
                placeholderTextColor={t.faint}
                py={9}
                rounded={8}
                textColor={t.ink}
                value={name}
              />
              <Tap onPress={rename} scale={0.97}>
                <Box align="center" bg={t.accent} paddingY={9} rounded={8}>
                  <Text color={t.onAccent} size={12} weight="600">
                    {tr("library.docMenu.save")}
                  </Text>
                </Box>
              </Tap>
            </Box>
          ) : (
            <Box gap={3} paddingTop={3}>
              {action(
                <IconPencil color={t.sub} size={14} />,
                tr("library.docMenu.rename"),
                () => setRenaming(true),
              )}
              {action(
                <IconExternal color={t.sub} size={14} />,
                tr("library.docMenu.share"),
                share,
              )}
              {action(
                <IconTrash color={DANGER} size={14} />,
                armed
                  ? tr("library.docMenu.deleteConfirm")
                  : tr("library.docMenu.delete"),
                destroy,
                DANGER,
              )}
            </Box>
          )}
        </Box>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  menu: {
    maxWidth: 224,
    position: "absolute",
    right: 16,
    top: 88,
    width: "60%",
  },
});
