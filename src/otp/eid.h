#ifndef EID_H
#define EID_H

#include <stdint.h>

void printHex(uint8_t *hex, int offset);
void writeHex(uint8_t *hex, int offset, char *output);
int generateEID(char *ikString, int scaler, int beacon_time_seconds, unsigned char *eid);
#endif
