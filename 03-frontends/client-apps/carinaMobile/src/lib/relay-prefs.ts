import AsyncStorage from '@react-native-async-storage/async-storage';

const SMS_KEY = 'carina.relay.sms';
const CALL_KEY = 'carina.relay.call';
const NOTIF_KEY = 'carina.relay.notification';
const SENDERS_KEY = 'carina.relay.senders';
const START_HOUR_KEY = 'carina.relay.privacy.start';
const END_HOUR_KEY = 'carina.relay.privacy.end';

export interface RelayPrefs {
  smsEnabled: boolean;
  callEnabled: boolean;
  notificationEnabled: boolean;
  allowedSenders: string[];
  privacyStartHour: number;
  privacyEndHour: number;
}

const defaults: RelayPrefs = {
  smsEnabled: false,
  callEnabled: false,
  notificationEnabled: false,
  allowedSenders: [],
  privacyStartHour: 7,
  privacyEndHour: 22,
};

export async function loadRelayPrefs(): Promise<RelayPrefs> {
  const [sms, call, notif, senders, start, end] = await Promise.all([
    AsyncStorage.getItem(SMS_KEY),
    AsyncStorage.getItem(CALL_KEY),
    AsyncStorage.getItem(NOTIF_KEY),
    AsyncStorage.getItem(SENDERS_KEY),
    AsyncStorage.getItem(START_HOUR_KEY),
    AsyncStorage.getItem(END_HOUR_KEY),
  ]);

  return {
    smsEnabled: sms === 'true',
    callEnabled: call === 'true',
    notificationEnabled: notif === 'true',
    allowedSenders: senders ? (JSON.parse(senders) as string[]) : [],
    privacyStartHour: start ? Number(start) : defaults.privacyStartHour,
    privacyEndHour: end ? Number(end) : defaults.privacyEndHour,
  };
}

export async function saveRelayPrefs(prefs: RelayPrefs): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(SMS_KEY, prefs.smsEnabled ? 'true' : 'false'),
    AsyncStorage.setItem(CALL_KEY, prefs.callEnabled ? 'true' : 'false'),
    AsyncStorage.setItem(NOTIF_KEY, prefs.notificationEnabled ? 'true' : 'false'),
    AsyncStorage.setItem(SENDERS_KEY, JSON.stringify(prefs.allowedSenders)),
    AsyncStorage.setItem(START_HOUR_KEY, String(prefs.privacyStartHour)),
    AsyncStorage.setItem(END_HOUR_KEY, String(prefs.privacyEndHour)),
  ]);
}
