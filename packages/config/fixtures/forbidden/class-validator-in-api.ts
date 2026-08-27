import { IsString } from 'class-validator'

export class InvalidDto {
  @IsString()
  name = ''
}
