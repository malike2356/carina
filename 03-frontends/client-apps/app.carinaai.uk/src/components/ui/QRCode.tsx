'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCodeCanvas({ value, size = 192, className }: QRCodeProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    void QRCode.toCanvas(ref.current, value, {
      width: size,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    }).catch(() => {});
  }, [size, value]);

  return <canvas ref={ref} width={size} height={size} className={className} />;
}
