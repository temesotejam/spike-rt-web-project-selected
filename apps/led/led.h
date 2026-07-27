/*
 * SPDX-License-Identifier: MIT
 *
 * Copyright (c) 2022-2024 Embedded and Real-Time Systems Laboratory,
 *            Graduate School of Information Science, Nagoya Univ., JAPAN
 */

#ifndef __LED_H__
#define __LED_H__

#include <kernel.h>

#define MAIN_PRIORITY 5

#ifndef TASK_PORTID
#define TASK_PORTID 1
#endif

#ifndef STACK_SIZE
#define STACK_SIZE 4096
#endif

#ifndef TOPPERS_MACRO_ONLY
extern void main_task(intptr_t exinf);
#endif

#endif
