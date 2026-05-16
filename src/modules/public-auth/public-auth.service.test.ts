import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCodeInput,
  parsePhoneInput,
  parseRegisterInput,
} from "@backend/modules/public-auth/public-auth.service";
import { ValidationError } from "@backend/shared/errors/app-error";

test("parseRegisterInput requires name, birth date and normalizes phone", () => {
  assert.deepEqual(
    parseRegisterInput({
      firstName: " Иван ",
      lastName: " Петров ",
      birthDate: "1999-04-20",
      phone: "+7 (999) 123-45-67",
    }),
    {
      firstName: "Иван",
      lastName: "Петров",
      birthDate: "1999-04-20",
      phone: "79991234567",
    },
  );
});

test("parseRegisterInput rejects future birth dates and missing names", () => {
  assert.throws(
    () =>
      parseRegisterInput({
        firstName: "",
        lastName: "Петров",
        birthDate: "1999-04-20",
        phone: "+7 (999) 123-45-67",
      }),
    ValidationError,
  );
  assert.throws(
    () =>
      parseRegisterInput({
        firstName: "Иван",
        lastName: "Петров",
        birthDate: "2999-04-20",
        phone: "+7 (999) 123-45-67",
      }),
    ValidationError,
  );
});

test("parsePhoneInput and parseCodeInput validate public auth payloads", () => {
  assert.equal(parsePhoneInput({ phone: "8 999 123-45-67" }), "79991234567");
  assert.equal(parseCodeInput({ code: "123456" }), "123456");
  assert.throws(() => parseCodeInput({ code: "12345" }), ValidationError);
});
