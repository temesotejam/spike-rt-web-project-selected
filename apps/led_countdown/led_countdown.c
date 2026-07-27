/*
 * SPDX-License-Identifier: MIT
 *
 * Derived from the SPIKE-RT v0.2.0 LED sample.
 */

#include <kernel.h>
#include <kernel_cfg.h>
#include <t_syslog.h>
#include "led_countdown.h"
#include "spike/hub/light.h"
#include "spike/hub/display.h"

void main_task(intptr_t exinf)
{
  (void)exinf;
  char c = '9';

  syslog(LOG_NOTICE, "LED countdown started.");

  while (1) {
    hub_display_off();
    hub_display_char(c);
    hub_light_on_color(PBIO_COLOR_RED);
    dly_tsk(1000 * 1000);

    c--;
    if (c < '0') {
      c = '9';
    }
  }
}
