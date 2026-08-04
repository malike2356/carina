// Temporary: exclude llama.rn from Android release so the APK can launch
// without New Architecture codegen. Re-enable once FCM + New Arch are stable.
module.exports = {
  dependencies: {
    'llama.rn': {
      platforms: {
        android: null,
      },
    },
  },
};
