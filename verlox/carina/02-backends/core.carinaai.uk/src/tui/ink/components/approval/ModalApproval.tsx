import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { colors } from '../../theme/colors.js';

interface ModalApprovalProps {
  toolName: string;
  args: Record<string, unknown>;
  riskLevel: 'high' | 'critical';
  riskReason: string;
  onApprove: () => void;
  onDeny: () => void;
}

export function ModalApproval({
  toolName,
  args,
  riskLevel,
  riskReason,
  onApprove,
  onDeny,
}: ModalApprovalProps) {
  const [confirmText, setConfirmText] = useState('');
  const isCritical = riskLevel === 'critical';
  const confirmWord = isCritical ? 'CONFIRM' : 'yes';
  const borderColor = isCritical ? colors.error : colors.warning;

  useInput((_input, key) => {
    if (key.escape) onDeny();
  });

  function handleSubmit(value: string) {
    if (value.trim() === confirmWord) {
      onApprove();
    }
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={borderColor}
      paddingX={2}
      paddingY={1}
      position="absolute"
    >
      <Text color={borderColor} bold>
        {isCritical ? 'CRITICAL APPROVAL REQUIRED' : 'HIGH-RISK APPROVAL REQUIRED'}
      </Text>
      <Box marginTop={1}>
        <Text bold>Tool: {toolName}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={colors.warning}>Risk: {riskReason}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Arguments:</Text>
        <Text wrap="wrap">{JSON.stringify(args, null, 2)}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>
          Type <Text color={borderColor} bold>{confirmWord}</Text> to approve, or press Escape to deny:
        </Text>
        <Box marginTop={1}>
          <Text color={borderColor}>{'> '}</Text>
          <TextInput
            value={confirmText}
            onChange={setConfirmText}
            onSubmit={handleSubmit}
          />
        </Box>
      </Box>
    </Box>
  );
}
