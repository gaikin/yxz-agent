import "styled-components"
import type { appTheme } from "./appTheme"

type AppTheme = typeof appTheme

declare module "styled-components" {
  export interface DefaultTheme extends AppTheme {}
}
