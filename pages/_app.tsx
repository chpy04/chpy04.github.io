import "../styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "next-themes";

const App = ({ Component, pageProps }: AppProps) => {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
      <Component {...pageProps} />
    </ThemeProvider>
  );
};

export default App;
