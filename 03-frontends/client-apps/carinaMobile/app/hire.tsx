import { Redirect, type Href } from 'expo-router';

/** Legacy path; Hire lives on the cloud tab bar. */
export default function HireRedirect() {
  return <Redirect href={'/(tabs)/hire' as Href} />;
}
