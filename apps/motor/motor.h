/*
 * SPDX-License-Identifier: MIT
 *
 * Copyright (c) 2022-2024 Embedded and Real-Time Systems Laboratory,
 *            Graduate School of Information Science, Nagoya Univ., JAPAN
 */

#ifndef __MOTOR_H__
#define __MOTOR_H__

#include <kernel.h>

#define MAIN_PRIORITY 5
#define MAIN_STACK_SIZE 4096

#ifndef TOPPERS_MACRO_ONLY
extern void main_task(intptr_t exinf);
#endif

#endif
