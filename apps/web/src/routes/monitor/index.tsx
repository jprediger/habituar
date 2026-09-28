import { createFileRoute } from '@tanstack/react-router'
import { MonitorHomeScreen } from '../../monitor/monitor-home-screen.js'

export const Route = createFileRoute('/monitor/')({ component: MonitorHomeScreen })
