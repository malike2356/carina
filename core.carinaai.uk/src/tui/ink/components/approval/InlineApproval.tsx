import React from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../../theme/colors.js';

interface InlineApprovalProps {
  toolName: string;
  args: Record<string, unknown>;
  riskLevel: 'medium';
  onApprove: () => void;
  onDeny: () => void;
  onSudo: () => void;
}

export function InlineApproval({ toolName, args, onApprove, onDeny, onSudo }: InlineApprovalProps) {
  useInput((input) => {
    if (input === 'y' || input === 'Y') onApprove();
    if (input === 'n' || input === 'N') onDeny();
    if (input === 's' || input === 'S') onSudo();
  });

  const argsPreview = JSON.stringify(args, null, 2)
    .split('\n')
    .slice(0, 6)
    .join('\n');

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.warning}
      paddingX={1}
      marginY={1}
    >
      <Text color={colors.warning} bold>
        [Approval Required] {toolName}
      </Text>
      <Box marginTop={1}>
        <Text dimColor>{argsPreview}</Text>
      </Box>
      <Box marginTop={1}>
        <Text>
          <Text color={colors.success}>[Y]</Text> Approve{'  '}
          <Text color={colors.error}>[N]</Text> Deny{'  '}
          <Text color={colors.accent}>[S]</Text> Sudo (approve similar for 5m)
        </Text>
      </Box>
    </Box>
  );
}
