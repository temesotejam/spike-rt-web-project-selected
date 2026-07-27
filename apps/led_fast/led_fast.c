/*
 * SPDX-License-Identifier: MIT
 *
 * Derived from the SPIKE-RT v0.2.0 LED sample.
 */

#include <kernel.h>
#include <kernel_cfg.h>
#include <t_syslog.h>
#include "led_fast.h"
#include "spike/hub/light.h"
#include "spike/hub/display.h"

void main_task(intptr_t exinf)
{
  (void)exinf;
  char c = '0';

  syslog(LOG_NOTICE, "LED fast counter started.");

  while (1) {
    hub_display_off();
    hub_display_char(c);
    hub_light_on_color(PBIO_COLOR_GREEN);
    dly_tsk(250 * 1000);

    c++;
    if (c > '9') {
      c = '0';
    }
  }
}
