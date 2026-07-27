/*
 * SPDX-License-Identifier: MIT
 */

#include <kernel.h>
#include <kernel_cfg.h>
#include <t_syslog.h>

#include "myapp.h"

void main_task(intptr_t exinf)
{
    (void)exinf;

    syslog(LOG_NOTICE, "SPIKE-RT myapp started.");

    while (1) {
        dly_tsk(1000 * 1000);
    }
}
