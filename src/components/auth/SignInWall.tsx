/**
 * Shown the first time an AI action is refused for want of an account.
 *
 * Everything the reader has done so far — highlights, notes, bookmarks, words —
 * is already saved locally and is not being held hostage; only Lexi is. The
 * copy says so, because a wall that looks like it's taken your work is the
 * fastest way to lose someone at exactly the wrong moment.
 */
import { router } from "expo-router";

import { Box } from "@/components/atoms";
import { Backdrop, IconSpark, Tap, Text } from "@/components/lexi-components";
import { useAuthStore, type WallReason } from "@/stores/auth-store";
import { useProtoTheme } from "@/theme/proto";

const COPY: Record<WallReason, { body: string; title: string }> = {
  quota: {
    body: "You've used the free credits for Lexi, translations and summaries. Sign in to keep going — your highlights and notes stay exactly where they are either way.",
    title: "Carry on with Lexi",
  },
  sync: {
    body: "Sign in to keep your highlights, notes and reading position on every device you read on.",
    title: "Read across your devices",
  },
};

export function SignInWall() {
  const t = useProtoTheme();
  const wall = useAuthStore((s) => s.wall);
  const closeWall = useAuthStore((s) => s.closeWall);
  const quota = useAuthStore((s) => s.quota);

  if (!wall) return null;
  const copy = COPY[wall];

  return (
    <>
      <Backdrop onPress={closeWall} opacity={0.45} />
      <Box
        bg={t.card}
        borderColor={t.line}
        borderWidth={1}
        gap={16}
        padding={22}
        rounded={22}
        style={{
          position: "absolute",
          left: 22,
          right: 22,
          top: "28%",
          zIndex: 60,
          shadowColor: "#14100C",
          shadowOffset: { width: 0, height: 22 },
          shadowOpacity: 0.4,
          shadowRadius: 64,
          elevation: 28,
        }}
      >
        <Box
          align="center"
          bg={t.accentSoft}
          height={40}
          justify="center"
          rounded={13}
          width={40}
        >
          <IconSpark color={t.accent} size={20} />
        </Box>

        <Box gap={7}>
          <Text serif size={19} weight="600">
            {copy.title}
          </Text>
          <Text color={t.sub} lh={20} size={13.5}>
            {copy.body}
          </Text>
          {quota ? (
            <Text color={t.faint} size={12}>
              {quota.used} of {quota.limit} credits used.
            </Text>
          ) : null}
        </Box>

        <Box gap={9}>
          <Tap
            onPress={() => {
              closeWall();
              router.push("/login");
            }}
            scale={0.97}
          >
            <Box align="center" bg={t.accent} paddingY={13} rounded={13}>
              <Text color={t.onAccent} size={14} weight="600">
                Sign in
              </Text>
            </Box>
          </Tap>
          <Tap onPress={closeWall} scale={0.97}>
            <Box align="center" paddingY={11}>
              <Text color={t.sub} size={13.5} weight="500">
                Keep reading without it
              </Text>
            </Box>
          </Tap>
        </Box>
      </Box>
    </>
  );
}
