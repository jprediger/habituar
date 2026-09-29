import { Outlet, createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { InstitutionManagementLayout } from '../../management/institution-management.js'

export const Route = createFileRoute('/professional/management')({ component: ManagementLayoutRoute })

/** Gestão da equipe no ambiente profissional; o layout decide se a pessoa pode entrar. */
function ManagementLayoutRoute(): ReactElement {
  return (
    <InstitutionManagementLayout>
      <Outlet />
    </InstitutionManagementLayout>
  )
}
