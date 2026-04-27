export function appendFormValue(
  formData: FormData,
  name: string,
  value: string | number | boolean | null | undefined,
) {
  if (value === null || value === undefined) {
    return;
  }

  formData.append(name, String(value));
}

export function appendFormValues(
  formData: FormData,
  name: string,
  values: Array<string | number | boolean | null | undefined>,
) {
  for (const value of values) {
    appendFormValue(formData, name, value);
  }
}
