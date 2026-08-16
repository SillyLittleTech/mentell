#ifndef MENTELL_MACOS_NOTIFY_H
#define MENTELL_MACOS_NOTIFY_H

#ifdef __cplusplus
extern "C" {
#endif

/** NSCalendar weekday: 1 = Sunday … 7 = Saturday. Repeats weekly. */
void mentell_schedule_weekly(int weekday, int hour, int minute, const char *title, const char *body);
void mentell_cancel_weekly(void);

#ifdef __cplusplus
}
#endif

#endif
