# ORÁCULO — app mobile

> **Nota de proveniência (2026-09-24):** o código-fonte original deste app foi
> gerado numa sessão de code-interpreter do ChatGPT e nunca foi versionado em
> nenhum repositório Git. Quando a sessão expirou, o código-fonte se perdeu —
> só sobrou o app compilado (APKs) e o backend (que roda em produção e está
> intacto). Este repositório é uma **reconstrução**, feita a partir de:
>
> - `package.json` / `app.json` exatos, recuperados dos logs de build do EAS;
> - o bundle JavaScript minificado extraído do APK (`index.android.bundle`),
>   usado como referência de comportamento e nomes de tela;
> - o contrato real da API, lido diretamente do código do backend
>   (`/opt/vigia-svin` na VPS de produção);
> - paleta de cores e strings em PT-BR extraídas do bundle, para manter
>   fidelidade visual e de texto com o app original.
>
> **A partir de agora, todo commit fica aqui.** Nunca mais dependa de uma
> sessão de chat efêmera para guardar código de produção.

## Stack

- Expo SDK 57 / React Native 0.86
- TypeScript
- React Navigation (bottom tabs + native stack)
- `expo-updates` para OTA (canal já configurado em `app.json`)

## Backend

API privada em `https://vigia.85-155-182-151.nip.io` (pacote `com.fireteam.vigia`).
