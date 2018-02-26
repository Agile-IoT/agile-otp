/*
 * eid.c
 *
 *  Created on: Feb 6, 2018
 *      Author: Eduard Brehm
 */

#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <math.h>

#include "eid.h"

#include <openssl/conf.h>
#include <openssl/evp.h>
#include <openssl/err.h>

int modulus(double a, double b) {
	int result = (int) (a / b);
	return a - (result) * b;
}

void printHex(uint8_t *hex, int offset) {
	int i = 0;
	for (i = 0; i < 16; ++i) {
		if (offset > 0 && i >= offset) {
			break;
		} else {
			printf("%02x ", hex[i]);
		}
	};
	printf("\n");
}

void writeHex(unsigned char *hex, int offset, char *output) {
	int j = 0;
	int i = 0;
	for (i = 0; i < 16; ++i) {
		if (offset > 0 && i >= offset) {
			break;
		} else {
			char tmp[2];
			sprintf(tmp, "%02x", hex[i]);
			memcpy(&output[j], tmp, 2);
			j += 2;
		}
	}
}

uint8_t *parseIk(char *ikString) {
	uint8_t ik[16] = { 0 };
	char subString[3];
	subString[2] = '\0';
	int j = 0;
	int i = 0;
	for (i = 0; i < 16 * 2; i += 2) {
		memcpy(subString, &ikString[i], 2);
		unsigned int intVal;
		if (sscanf(subString, "%xu", &intVal) != 1) {
			fprintf(stderr, "error - not a hex integer");
		}
		ik[j] = intVal;
		++j;
	}

	uint8_t *result = malloc(sizeof(ik));
	if (result != 0) {
		memmove(result, ik, sizeof(ik));
	}

	return result;
}

int encrypt(unsigned char *plaintext, int plaintext_len, unsigned char *key,
		unsigned char *ciphertext) {
	ERR_load_crypto_strings();
	OpenSSL_add_all_algorithms();
	OPENSSL_config(NULL);

	EVP_CIPHER_CTX *ctx;

	int len;

	int ciphertext_len;

	if (!(ctx = EVP_CIPHER_CTX_new()))
		handleErrors();

	if (1 != EVP_EncryptInit_ex(ctx, EVP_aes_128_ecb(), NULL, key, NULL))
		handleErrors();

	if (1 != EVP_EncryptUpdate(ctx, ciphertext, &len, plaintext, plaintext_len))
		handleErrors();
	ciphertext_len = len;

	if (1 != EVP_EncryptFinal_ex(ctx, ciphertext + len, &len))
		handleErrors();
	ciphertext_len += len;

	EVP_CIPHER_CTX_free(ctx);

	return ciphertext_len;
}

int generateEID(char *ikString, int scaler, int beacon_time_seconds, unsigned char *eid) {

	uint8_t *ik = parseIk(ikString);
	//printf("Init Key Data: ");
	//printHex(ik, 0);

	uint8_t tkdata[16] = { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, //"\x00" * 11
			0xff,	//"\xFF"
			0x00, 0x00, //"\x00" * 2
			modulus((double) (beacon_time_seconds / (pow(2, 24))), 256), //chr((beacon_time_seconds / (2 ** 24)) % 256)
			modulus((double) (beacon_time_seconds / (pow(2, 16))), 256) //chr((beacon_time_seconds / (2 ** 16)) % 256)
			};
	//printf("Temporary Key Data: ");
	//printHex(tkdata, 0);

	unsigned char tk[128];
	encrypt(tkdata, 16, ik, tk);
	//printf("Temporary Key: ");
	//printHex(tk, 0);

	beacon_time_seconds = (beacon_time_seconds / pow(2, 0)) * pow(2, 0);
	uint8_t eiddata[16] = { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
			0x00, 0x00,
			0x00, //"\x00" * 11
			scaler, modulus((double) (beacon_time_seconds / (pow(2, 24))), 256),
			modulus((double) (beacon_time_seconds / (pow(2, 16))), 256),
			modulus((double) (beacon_time_seconds / (pow(2, 8))), 256), modulus(
					(double) (beacon_time_seconds / (pow(2, 0))), 256) };
	//printf("Ephermal Id Data: ");
	//printHex(eiddata, 0);

	encrypt(eiddata, 16, tk, eid);
	//printf("Ephermal Id: ");
	//printHex(eid, 0);

	return 0;
}
