import type { PackSkillInput } from '../property-uk/skills.js';

export const smartHomeSkills: PackSkillInput[] = [
  {
    name: 'home-assistant-scenes',
    description: 'Run Home Assistant scenes and automations',
    trigger: ['home assistant', 'ha scene', 'turn on lights', 'smart home'],
    steps: '1. ha-list-entities to discover devices.\n2. ha-get-state for target entity.\n3. ha-call-service after user confirmation.',
    toolsUsed: ['ha-list-entities', 'ha-get-state', 'ha-call-service'],
  },
  {
    name: 'openhue-lights',
    description: 'Control Philips Hue via OpenHue or HA',
    trigger: ['hue lights', 'openhue', 'philips hue', 'room lighting'],
    steps: '1. Prefer ha-call-service light.turn_on/off.\n2. If OPENHUE_BRIDGE_IP set, use http-request.\n3. Confirm room and brightness.',
    toolsUsed: ['ha-call-service', 'http-request'],
  },
  {
    name: 'climate-control',
    description: 'Adjust thermostats and HVAC via HA',
    trigger: ['thermostat', 'climate', 'heating', 'hvac'],
    steps: '1. ha-get-state on climate.* entities.\n2. ha-call-service climate.set_temperature.\n3. Report new setpoint.',
    toolsUsed: ['ha-get-state', 'ha-call-service'],
  },
  {
    name: 'security-arm',
    description: 'Arm/disarm alarms and check door sensors',
    trigger: ['alarm arm', 'door sensor', 'security system', 'motion sensor'],
    steps: '1. List binary_sensor entities.\n2. Report open doors/windows.\n3. Call alarm_control_panel services with confirmation.',
    toolsUsed: ['ha-list-entities', 'ha-call-service'],
  },
  {
    name: 'morning-routine',
    description: 'Orchestrate morning smart-home routine',
    trigger: ['morning routine', 'wake up scene', 'sunrise automation'],
    steps: '1. Gather user preferences.\n2. Sequence ha-call-service calls.\n3. Use kanban-heartbeat to verify completion.',
    toolsUsed: ['ha-call-service', 'kanban-heartbeat'],
  },
];
