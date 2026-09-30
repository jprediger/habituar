import DateTimePicker from '@react-native-community/datetimepicker'
import { useState } from 'react'
import { Platform, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button'
import { FormField } from '../components/ui/form-field'
import { Text } from '../components/ui/text'
import { getDatePickerBounds } from './date-picker-adapter'

type DatePickerFieldProps = Readonly<{ id: string; label: string; value: string; onChange: (value: string) => void; error?: string | undefined }>

/** Controla a seleção de datas civis sem converter o dia pelo fuso local. */
export function DatePickerField({ id, label, value, onChange, error }: DatePickerFieldProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const { selected, maximum } = getDatePickerBounds(value)
  const display = value ? value.split('-').reverse().join('/') : t('students.selectDate')
  return <FormField id={id} label={label} isRequired error={error}>
    {(control) => <View>
      <Button variant="outline" label={display} accessibilityLabel={`${control.accessibilityLabel}: ${display}`} onPress={() => { setIsOpen(true) }} />
      {isOpen && <DateTimePicker mode="date" value={selected} maximumDate={maximum} display={Platform.OS === 'ios' ? 'spinner' : 'default'} onDismiss={() => { setIsOpen(false) }} onValueChange={(_event, date) => {
        if (Platform.OS !== 'ios') setIsOpen(false)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        onChange(`${String(year)}-${month}-${day}`)
      }} />}
      {isOpen && Platform.OS === 'ios' && <Button variant="link" label={t('students.dateDone')} onPress={() => { setIsOpen(false) }} />}
      {value && <Text size="caption" tone="muted">{display}</Text>}
    </View>}
  </FormField>
}
