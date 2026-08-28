import axe from 'axe-core'
import { expect } from 'vitest'

const REPORTABLE_IMPACTS: ReadonlySet<axe.ImpactValue> = new Set(['serious', 'critical'])

/**
 * Roda axe-core sobre o container e falha só para violações `serious`/`critical`.
 * `color-contrast` fica desligado de propósito: jsdom não calcula layout nem cor
 * renderizada, e esse gate já vive em `contrast.test.ts` dos tokens.
 */
export async function expectNoSeriousA11yViolations(container: Element): Promise<void> {
  const results = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
    },
  })

  const reportable = results.violations.filter(
    (violation) => violation.impact !== undefined && REPORTABLE_IMPACTS.has(violation.impact),
  )

  if (reportable.length > 0) {
    const details = reportable
      .map((violation) => `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help}`)
      .join('\n')

    expect.fail(`Violações de acessibilidade serious/critical:\n${details}`)
  }
}
