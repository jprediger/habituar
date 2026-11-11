import type { PropsWithChildren } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet } from 'react-native'
import { useReduceMotion } from './ui/use-reduce-motion'

const ENTER_DURATION_MS = 240
const ENTER_DISTANCE = 12

/** Entrada curta para a nova visão ou período; a preferência do sistema remove o movimento. */
export function AgendaViewTransition({ children, contentKey }: PropsWithChildren<{ contentKey: string }>) {
  const reduceMotion = useReduceMotion()
  const [progress] = useState(() => new Animated.Value(1))

  const latest = useRef({ children, contentKey })
  useEffect(() => { latest.current = { children, contentKey } }, [children, contentKey])
  const [displayed, setDisplayed] = useState({ children, contentKey })

  useEffect(() => {
    if (displayed.contentKey === contentKey) return
    if (reduceMotion) {
      setDisplayed(latest.current)
      progress.setValue(1)
      return
    }
    let active = true
    const exit = Animated.timing(progress, { toValue: 0, duration: 120, useNativeDriver: true })
    exit.start(({ finished }) => {
      if (finished && active) setDisplayed(latest.current)
    })
    return () => { active = false; exit.stop() }
  }, [contentKey, displayed.contentKey, progress, reduceMotion])

  useEffect(() => {
    const entrance = Animated.timing(progress, {
      toValue: 1,
      duration: reduceMotion ? 0 : ENTER_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })
    entrance.start()
    return () => { entrance.stop() }
  }, [displayed.contentKey, progress, reduceMotion])

  return (
    <Animated.View style={[styles.content, {
      // A montagem pode ocupar o JS; o último quadro continua visível nesse intervalo.
      opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }),
      transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [ENTER_DISTANCE, 0] }) }],
    }]}>
      {displayed.contentKey === contentKey ? children : displayed.children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({ content: { flex: 1 } })
