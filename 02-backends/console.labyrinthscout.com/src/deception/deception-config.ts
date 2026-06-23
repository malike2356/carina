export interface RotationConfig {
  marker_interval_minutes: number;
  decoy_rotation_minutes: number;
  tool_name_rotation_minutes: number;
  marker_pool_size: number;
  decoy_pool_size: number;
  alert_on_decoy_leak: boolean;
  alert_on_stale_marker: boolean;
}

export const DEFAULT_ROTATION_CONFIG: RotationConfig = {
  marker_interval_minutes: 15,
  decoy_rotation_minutes: 60,
  tool_name_rotation_minutes: 30,
  marker_pool_size: 100,
  decoy_pool_size: 20,
  alert_on_decoy_leak: true,
  alert_on_stale_marker: true,
};
