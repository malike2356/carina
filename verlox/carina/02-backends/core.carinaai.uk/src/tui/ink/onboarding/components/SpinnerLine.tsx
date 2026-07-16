import React, { useState, useEffect } from 'react';
import { Text } from 'ink';
import { spinnerLabel } from '../../../../cli/theme/engine.js';

interface SpinnerLineProps {
  message?: string;
}

export function SpinnerLine({ message }: SpinnerLineProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 120);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text color="#d29922">
      {message ?? spinnerLabel(tick)}
    </Text>
  );
}
