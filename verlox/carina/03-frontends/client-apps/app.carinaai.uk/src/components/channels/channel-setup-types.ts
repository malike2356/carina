export type ChannelSetupProps = {
  workerId: string;
  channelLabel: string;
  onComplete: () => void;
  onCancel?: () => void;
};
