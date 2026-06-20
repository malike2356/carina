#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(NotificationRelayModule, NSObject)
RCT_EXTERN_METHOD(configure:(NSString *)apiUrl
                  deviceToken:(NSString *)deviceToken
                  apiKey:(NSString *)apiKey
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setNotificationRelayEnabled:(BOOL)enabled
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setAllowedSources:(NSArray<NSString *> *)sources
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setPrivacyHours:(NSInteger)startHour
                  endHour:(NSInteger)endHour
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getSettings:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(forwardNotification:(NSString *)title
                  body:(NSString *)body
                  source:(NSString *)source
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
@end
