import { render, screen } from '@testing-library/react-native'
import { APP_FONT_FAMILY } from '../../theme/tokens'
import { Text } from './text'

const SAMPLE = 'Que bom ter você de volta'

describe('app text', () => {
  it('renders in the app font instead of falling back to the system one', () => {
    render(<Text>{SAMPLE}</Text>)

    expect(screen.getByText(SAMPLE)).toHaveStyle({ fontFamily: APP_FONT_FAMILY.regular })
  })

  it('asks for weight by changing the family, which is how React Native picks a cut', () => {
    render(<Text weight="bold">{SAMPLE}</Text>)

    // `fontWeight` não escolhe corte de família customizada: pedir negrito por peso daria
    // negrito sintético. Se esta asserção virar `fontWeight`, o texto embaça no aparelho.
    expect(screen.getByText(SAMPLE)).toHaveStyle({ fontFamily: APP_FONT_FAMILY.bold })
  })

  it('leaves every accessibility prop to the caller', () => {
    render(
      <Text accessibilityRole="header" tone="danger">
        {SAMPLE}
      </Text>,
    )

    expect(screen.getByRole('header', { name: SAMPLE })).toBeOnTheScreen()
  })
})
