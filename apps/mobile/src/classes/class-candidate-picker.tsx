import { SPACING } from '@habituar/design-tokens/spacing'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '../components/ui/button'
import { ListRow } from '../components/ui/list-row'
import { SearchField } from '../components/ui/search-field'
import { Text } from '../components/ui/text'
import { useThemeTokens } from '../theme/tokens'

type Candidate<Id extends string> = Readonly<{ id: Id; name: string; description?: string }>

/** Seletor pesquisável, restrito a candidatos autorizados pela API. */
export function ClassCandidatePicker<Id extends string>({ title, items, onSelect, onClose }: Readonly<{
  title: string
  items: readonly Candidate<Id>[]
  onSelect: (item: Candidate<Id>) => void
  onClose: () => void
}>) {
  const { t } = useTranslation('classes')
  const { colors } = useThemeTokens()
  const [search, setSearch] = useState('')
  const normalized = search.trim().toLocaleLowerCase('pt-BR')
  const filtered = items.filter(item => `${item.name} ${item.description ?? ''}`.toLocaleLowerCase('pt-BR').includes(normalized))
  const visible = filtered.slice(0, 50)

  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={[styles.page, { backgroundColor: colors.surface }]} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.header}>
        <Text accessibilityRole="header" size="title" weight="bold">{title}</Text>
        <Button variant="outline" size="inlineBody" label={t('cancel')} onPress={onClose} />
      </View>
      <SearchField label={t('search')} value={search} onChangeText={setSearch} onSubmit={() => undefined} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.results}>
        {visible.length === 0 && <Text tone="muted">{t('noCandidates')}</Text>}
        {visible.map(item => <ListRow key={item.id} title={item.name} description={item.description} onPress={() => { onSelect(item) }} />)}
        {filtered.length > visible.length && <Text tone="muted">{t('limitCandidates')}</Text>}
      </ScrollView>
    </SafeAreaView>
  </Modal>
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: SPACING.xl, gap: SPACING.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.md },
  results: { paddingBottom: SPACING.xxl },
})
