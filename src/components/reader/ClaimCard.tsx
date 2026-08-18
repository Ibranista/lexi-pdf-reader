import { Box } from "@/components/atoms";
import { IconClose, Tap, Text } from "@/components/lexi-components";
import { CLAIM_LABEL, type FlaggedClaim } from "@/services/fact-check";
import { useProtoTheme } from "@/theme/proto";

const FLAG = "#C74A3E";
const FLAG_SOFT = "rgba(199,74,62,.10)";

export function ClaimCard({
  claim,
  onAsk,
  onClose,
}: {
  claim: FlaggedClaim;
  onAsk: (question: string) => void;
  onClose: () => void;
}) {
  const t = useProtoTheme();

  return (
    <Box
      bg={t.card}
      borderColor={t.line}
      borderWidth={1}
      gap={12}
      padding={16}
      rounded={18}
      style={{
        elevation: 12,
        shadowColor: "#14100C",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      }}
    >
      <Box align="center" direction="row" gap={9}>
        <Box bg={FLAG_SOFT} paddingX={9} paddingY={4} rounded={20}>
          <Text color={FLAG} ls={0.4} size={10.5} upper weight="700">
            {CLAIM_LABEL[claim.kind]}
          </Text>
        </Box>
        <Box flex={1} />
        <Tap onPress={onClose} scale={0.9}>
          <Box
            align="center"
            height={28}
            justify="center"
            rounded={14}
            width={28}
          >
            <IconClose color={t.sub} size={14} />
          </Box>
        </Tap>
      </Box>

      <Box
        paddingLeft={11}
        style={{ borderLeftColor: FLAG, borderLeftWidth: 3 }}
      >
        <Text color={t.sub} italic lh={19} numberOfLines={3} serif size={12.5}>
          {`“${claim.quote}”`}
        </Text>
      </Box>

      <Text color={t.ink} lh={20} size={13.5}>
        {claim.note}
      </Text>

      <Tap
        onPress={() =>
          onAsk(
            `You flagged this line on my page: “${claim.quote}”. The note said: ${claim.note}. Is that fair, given what this book actually argues?`,
          )
        }
        scale={0.97}
        style={{ alignSelf: "flex-start" }}
      >
        <Box
          bg={t.accentSoft}
          paddingX={14}
          paddingY={9}
          rounded={20}
        >
          <Text color={t.accentText} size={12.5} weight="600">
            Ask Liqrai about this
          </Text>
        </Box>
      </Tap>

      <Text color={t.faint} lh={15} size={10.5}>
        Checked automatically against one page, so it can be wrong — especially
        where the book makes its case elsewhere. Worth a look, not a verdict.
      </Text>
    </Box>
  );
}
