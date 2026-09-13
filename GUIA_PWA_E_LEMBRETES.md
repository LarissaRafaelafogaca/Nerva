# Nerva — Guia do PWA e dos lembretes (notificações push)

Este guia explica como instalar o Nerva no celular como app e como testar os
lembretes de medicamento (push notifications), inclusive no iPhone.

---

## Visão geral

- O Nerva é um **PWA** (Progressive Web App): pode ser instalado na tela inicial
  do celular e abre em tela cheia, como um app.
- Os lembretes usam **Web Push** (padrão VAPID). O backend envia a notificação no
  horário da dose, e o celular a recebe **mesmo com o app fechado**.
- No **iPhone** o push só funciona se: (1) iOS 16.4+; (2) o app estiver
  **instalado na tela inicial**; (3) o acesso for por **HTTPS**; (4) a permissão
  for concedida a partir de um **toque** no botão "Ativar lembretes".

> Limitação honesta: o horário de entrega do push depende do sistema. Em modo de
> baixo consumo/bateria fraca o iOS pode atrasar. Para a apresentação, mantenha o
> iPhone carregado e sem modo de economia, e use o botão **"Testar lembrete
> agora"** como demonstração garantida.

---

## Rodar tudo localmente (no PC)

Abra 3 terminais (ou use o script `iniciar-tudo.ps1` na raiz):

```powershell
# 1) Banco (já instalado como serviço do Windows — normalmente já está rodando)

# 2) Backend
cd C:\Users\laris\Desktop\Nerva\backend
npm run dev            # http://localhost:4000

# 3) Front-end
cd C:\Users\laris\Desktop\Nerva
npm run dev            # http://localhost:5173
```

No PC, acesse **http://localhost:5173**. O front-end faz proxy de `/api` para o
backend automaticamente (configurado no `vite.config.js`).

---

## Testar no celular (iPhone/Android) — precisa de HTTPS

Celulares não confiam em `http://IP-local`, e o iPhone exige HTTPS para push.
Por isso usamos um **túnel HTTPS**. Configuramos o **ngrok com URL FIXA**:

```
https://ride-amends-purging.ngrok-free.dev
```

Essa URL **não muda** (mesmo reiniciando o PC), e já está cadastrada no Google
para o login funcionar.

### Forma fácil: rode o script `iniciar-tudo.ps1` (sobe tudo de uma vez).

### Forma manual:

1. Suba backend e front-end (passos acima).
2. Abra o túnel fixo apontando para o front-end (porta 5173):

```powershell
& "C:\Users\laris\AppData\Local\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe" http 5173 --url=https://ride-amends-purging.ngrok-free.dev
```

Acesse no celular: **https://ride-amends-purging.ngrok-free.dev**

> Na primeira visita, o ngrok grátis mostra uma tela de aviso ("You are about to
> visit..."). Toque em **Visit Site** (aparece uma vez por navegador).

### 3. No iPhone (Safari):

1. Abra a URL `https://....trycloudflare.com` no **Safari**.
2. Faça login (ou crie a conta).
3. Toque em **Compartilhar** (ícone de quadrado com seta) → **Adicionar à Tela de
   Início**. Confirme.
4. **Feche o Safari** e abra o Nerva pelo **ícone na tela inicial** (isso é
   obrigatório no iOS para o push funcionar).
5. Vá em **Configurações → Notificações** e toque em **Ativar lembretes**.
   Aceite a permissão quando o iOS pedir.
6. Toque em **Testar lembrete agora** — a notificação deve aparecer.

### No Android (Chrome):

1. Abra a URL no Chrome, faça login.
2. Menu (⋮) → **Adicionar à tela inicial / Instalar app**.
3. Abra pelo ícone, vá em Configurações → **Ativar lembretes** → aceite a permissão.
4. **Testar lembrete agora** para confirmar.

---

## Como os lembretes automáticos funcionam

- Cadastre um medicamento com horários (ex.: 08:00 e 20:00).
- O backend gera as doses do dia e, quando o horário chega, um agendador
  (`node-cron`, roda a cada minuto) envia o push "Está na hora de tomar ...".
- Cada dose é notificada **uma vez** (janela de até 30 min após o horário; depois
  vira "perdida" pelo outro processo).
- Ao tocar na notificação, o app abre no painel.

Para a **demonstração**, você pode:
- Cadastrar um medicamento com um horário 1–2 minutos à frente e esperar o push
  automático; **ou**
- Usar o botão **"Testar lembrete agora"** (dispara na hora, sem esperar).

---

## Perguntas frequentes

**A notificação não chegou no iPhone.**
Confirme: abriu pelo ícone da tela inicial (não pelo Safari)? Concedeu a
permissão? O iPhone está sem modo de baixo consumo? A URL do túnel ainda é a
mesma de quando você instalou? (Se reiniciou o túnel, reinstale com a nova URL.)

**Preciso do túnel toda vez?**
Para testar em celular, sim (ou publicar o app num servidor HTTPS real). No PC,
`localhost` já funciona sem túnel.

**As chaves de push (VAPID)** ficam em `backend/.env` (`VAPID_PUBLIC_KEY` /
`VAPID_PRIVATE_KEY`). Não precisa mexer; já foram geradas.
