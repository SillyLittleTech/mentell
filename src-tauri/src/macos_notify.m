#import "macos_notify.h"
#import <UserNotifications/UserNotifications.h>
#import <Foundation/Foundation.h>

static NSString *const kMentellWeeklyId = @"mentell.weekly";

void mentell_schedule_weekly(int weekday, int hour, int minute, const char *title, const char *body) {
  if (!title || !body) return;
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  NSString *titleStr = [NSString stringWithUTF8String:title];
  NSString *bodyStr = [NSString stringWithUTF8String:body];
  int wd = weekday;
  int h = hour;
  int m = minute;

  [center requestAuthorizationWithOptions:(UNAuthorizationOptionAlert | UNAuthorizationOptionSound)
                        completionHandler:^(BOOL granted, NSError *_Nullable error) {
                          (void)error;
                          if (!granted) {
                            return;
                          }
                          UNMutableNotificationContent *content = [UNMutableNotificationContent new];
                          content.title = titleStr;
                          content.body = bodyStr;
                          content.sound = [UNNotificationSound defaultSound];

                          NSDateComponents *comps = [NSDateComponents new];
                          comps.weekday = wd;
                          comps.hour = h;
                          comps.minute = m;

                          UNCalendarNotificationTrigger *trigger =
                              [UNCalendarNotificationTrigger triggerWithDateMatchingComponents:comps repeats:YES];
                          UNNotificationRequest *req =
                              [UNNotificationRequest requestWithIdentifier:kMentellWeeklyId
                                                                   content:content
                                                                   trigger:trigger];
                          [center addNotificationRequest:req withCompletionHandler:nil];
                        }];
}

void mentell_cancel_weekly(void) {
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center removePendingNotificationRequestsWithIdentifiers:@[ kMentellWeeklyId ]];
}
