/*
 * SPDX-License-Identifier: MIT
 */

#ifndef MYAPP_H
#define MYAPP_H

#include <kernel.h>

#define MAIN_PRIORITY   5
#define MAIN_STACK_SIZE 4096

#ifndef TOPPERS_MACRO_ONLY
extern void main_task(intptr_t exinf);
#endif

#endif
