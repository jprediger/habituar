/** Isola o relógio e a conversão local exigidos pelo seletor nativo de datas civis. */
export function getDatePickerBounds(value: string): Readonly<{ selected: Date; maximum: Date }> {
  const maximum = new Date()
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : maximum
  return { selected, maximum }
}
