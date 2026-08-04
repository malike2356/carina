import type { SensorName, SensorSignal } from '../types.js';
import { runCarinaSensor } from './carina_sensor.js';
import { runScoutSensor } from './scout_sensor.js';
import { runHostSensor } from './host_sensor.js';
import { runNetworkSensor } from './network_sensor.js';
import { runConnectedSystemsSensor } from './connected_systems_sensor.js';
import { runDevicesSensor } from './devices_sensor.js';
import { runDeployedAgentsSensor } from './deployed_agents_sensor.js';
import { runSupplyChainSensor } from './supply_chain_sensor.js';

export async function runSensor(name: SensorName, deep = false): Promise<SensorSignal[]> {
  switch (name) {
    case 'carina':
      return runCarinaSensor();
    case 'scout':
      return runScoutSensor();
    case 'host':
      return runHostSensor(deep);
    case 'network':
      return runNetworkSensor();
    case 'connected_systems':
      return runConnectedSystemsSensor();
    case 'devices':
      return runDevicesSensor();
    case 'deployed_agents':
      return runDeployedAgentsSensor();
    case 'supply_chain':
      return runSupplyChainSensor();
    default:
      return [];
  }
}

export async function runAllSensors(mode: 'quick' | 'full' | 'deep'): Promise<Partial<Record<SensorName, SensorSignal[]>>> {
  const deep = mode === 'deep';
  const names: SensorName[] =
    mode === 'quick'
      ? ['carina', 'scout', 'network']
      : ['carina', 'scout', 'host', 'network', 'connected_systems', 'devices', 'deployed_agents', 'supply_chain'];

  const results: Partial<Record<SensorName, SensorSignal[]>> = {};
  for (const name of names) {
    results[name] = await runSensor(name, deep);
  }
  return results;
}

export {
  runCarinaSensor,
  runScoutSensor,
  runHostSensor,
  runNetworkSensor,
  runConnectedSystemsSensor,
  runDevicesSensor,
  runDeployedAgentsSensor,
  runSupplyChainSensor,
};
