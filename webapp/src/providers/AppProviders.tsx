import type { PropsWithChildren } from "react"
import { App as AntdApp, ConfigProvider } from "antd"
import { ThemeProvider, createGlobalStyle } from "styled-components"
import { appTheme } from "../theme/appTheme"

const BaseStyle = createGlobalStyle`
  @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap");

  html,
  body,
  #root {
    min-height: 100%;
  }

  body {
    margin: 0;
    min-width: 320px;
    font-family: "Space Grotesk", "PingFang SC", "Microsoft YaHei", sans-serif;
    color: ${appTheme.colors.text};
    background:
      radial-gradient(circle at top left, rgba(255, 177, 122, 0.2), transparent 32%),
      radial-gradient(circle at right center, rgba(108, 151, 255, 0.18), transparent 28%),
      linear-gradient(160deg, #101726 0%, #18233a 46%, #0b1018 100%);
    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  button,
  input,
  textarea,
  select {
    font: inherit;
  }
`

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: appTheme.colors.accent,
          colorSuccess: appTheme.colors.success,
          colorWarning: appTheme.colors.warning,
          colorError: appTheme.colors.danger,
          colorText: appTheme.colors.text,
          colorTextSecondary: appTheme.colors.textMuted,
          colorBgBase: appTheme.colors.background,
          borderRadius: 16,
          fontFamily:
            '"Space Grotesk", "PingFang SC", "Microsoft YaHei", sans-serif',
        },
      }}
    >
      <ThemeProvider theme={appTheme}>
        <BaseStyle />
        <AntdApp>{children}</AntdApp>
      </ThemeProvider>
    </ConfigProvider>
  )
}
