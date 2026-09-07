import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { RequestContext } from '../platform/request-context.js'
import { AuthenticatedRequest } from './authentication.guard.js'

type RequestWithRouteData = AuthenticatedRequest & {
  params?: Record<string, string | undefined>
  body?: Record<string, unknown>
}

/**
 * Único ponto de produção que instala o tenant no `RequestContext` — o equivalente real
 * do `TestTenantHeaderInterceptor` usado em tenant-provenance.test.ts. Só instala
 * quando a requisição já tem ator autenticado (`AuthenticationGuard` já rodou) e uma
 * instituição identificável na rota. Rotas de autenticação não passam por aqui porque
 * `AuthenticationService` nunca chama `Database.withTenant` — só `withTenantOutsideRequest`
 * com o contexto de sistema.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly requestContext: RequestContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithRouteData>()
    const institutionId = request.params?.institutionId ?? extractInstitutionIdFromBody(request.body)

    if (request.actor === undefined || institutionId === undefined) {
      return next.handle()
    }

    const tenant = {
      institutionId,
      actorId: request.actor.userId,
      sessionId: request.actor.sessionId,
    }

    return new Observable((subscriber) => {
      this.requestContext.run({ ...this.requestContext.get(), tenant }, () => {
        next.handle().subscribe(subscriber)
      })
    })
  }
}

function extractInstitutionIdFromBody(body: Record<string, unknown> | undefined): string | undefined {
  const value = body?.institutionId
  return typeof value === 'string' ? value : undefined
}
