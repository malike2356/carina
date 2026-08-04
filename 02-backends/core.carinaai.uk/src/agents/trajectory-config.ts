export interface TrajectoryCompressionConfig {
  enabled: boolean;
  maxToolResultChars: number;
  maxTrajectoryChars: number;
  keepRecentToolRounds: number;
  compressAfterToolResults: number;
  summaryMaxChars: number;
}

export function loadTrajectoryConfig(): TrajectoryCompressionConfig {
  return {
    enabled: process.env.CARINA_TRAJECTORY_COMPRESSION !== 'false',
    maxToolResultChars: parseInt(process.env.CARINA_TRAJECTORY_TOOL_MAX_CHARS ?? '4000', 10),
    maxTrajectoryChars: parseInt(process.env.CARINA_TRAJECTORY_MAX_CHARS ?? '120000', 10),
    keepRecentToolRounds: parseInt(process.env.CARINA_TRAJECTORY_KEEP_RECENT ?? '4', 10),
    compressAfterToolResults: parseInt(process.env.CARINA_TRAJECTORY_COMPRESS_AFTER ?? '6', 10),
    summaryMaxChars: parseInt(process.env.CARINA_TRAJECTORY_SUMMARY_MAX_CHARS ?? '600', 10),
  };
}
